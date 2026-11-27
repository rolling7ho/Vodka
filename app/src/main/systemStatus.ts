import { execFileSync } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { DiscoveredBottle, SystemStatus } from '../shared/ipc'

const GMAC_BUNDLE_ID = 'com.rolling7ho.Gmac'
const WHISKY_BUNDLE_ID = 'com.isaacmarovitz.Whisky'
const ROSETTA_RUNTIME_PATH = '/Library/Apple/usr/libexec/oah/libRosettaRuntime'

function readPlistAsJson(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const raw = execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function parseUrlEntry(entry: unknown): string | null {
  if (typeof entry === 'string') {
    if (entry.startsWith('file://')) {
      try {
        return resolve(fileURLToPath(entry))
      } catch {
        return null
      }
    }
    return resolve(entry)
  }

  if (typeof entry === 'object' && entry !== null && 'relative' in entry) {
    const relative = (entry as { relative?: unknown }).relative
    if (typeof relative === 'string') {
      try {
        return resolve(fileURLToPath(relative))
      } catch {
        return null
      }
    }
  }

  return null
}

function readRegisteredBottlePaths(plistPath: string): string[] {
  const json = readPlistAsJson(plistPath)
  if (!json || !Array.isArray(json.paths)) {
    return []
  }

  const paths: string[] = []
  for (const entry of json.paths) {
    const parsed = parseUrlEntry(entry)
    if (parsed) {
      paths.push(parsed)
    }
  }
  return paths
}

function isBottleDirectory(dirPath: string): boolean {
  try {
    return existsSync(join(dirPath, 'Metadata.plist'))
  } catch {
    return false
  }
}

function readBottleName(dirPath: string): string {
  const metadata = readPlistAsJson(join(dirPath, 'Metadata.plist'))
  if (metadata) {
    if (typeof metadata.info === 'object' && metadata.info !== null) {
      const infoName = (metadata.info as { name?: unknown }).name
      if (typeof infoName === 'string' && infoName.trim().length > 0) {
        return infoName.trim()
      }
    }
    if (typeof metadata.name === 'string' && metadata.name.trim().length > 0) {
      return metadata.name.trim()
    }
  }
  return basename(dirPath)
}

function findNewestDownloadedToolkit(downloadsDir: string): string | null {
  if (!existsSync(downloadsDir)) {
    return null
  }

  try {
    let bestFile: string | null = null
    let bestMtime = -1

    for (const entry of readdirSync(downloadsDir)) {
      const lower = entry.toLowerCase()
      if (!lower.endsWith('.dmg')) {
        continue
      }
      if (
        !lower.includes('game_porting_toolkit') &&
        !lower.includes('game porting toolkit') &&
        !lower.includes('evaluation_environment') &&
        !lower.includes('evaluation environment') &&
        !lower.includes('gptk')
      ) {
        continue
      }

      const fullPath = join(downloadsDir, entry)
      try {
        const stats = statSync(fullPath)
        if (stats.isFile() && stats.mtimeMs > bestMtime) {
          bestMtime = stats.mtimeMs
          bestFile = entry
        }
      } catch {
        // Ignore unreadable entries.
      }
    }

    return bestFile
  } catch {
    return null
  }
}

function findLegacyWhiskyBottles(home: string, gmacRegistryPlist: string): DiscoveredBottle[] {
  const legacyContainer = join(home, 'Library', 'Containers', WHISKY_BUNDLE_ID)
  if (!existsSync(legacyContainer)) {
    return []
  }

  const existingGmac = new Set(readRegisteredBottlePaths(gmacRegistryPlist))
  const candidates: string[] = []

  candidates.push(...readRegisteredBottlePaths(join(legacyContainer, 'BottleVM.plist')))

  const legacyBottlesDir = join(legacyContainer, 'Bottles')
  if (existsSync(legacyBottlesDir)) {
    try {
      for (const entry of readdirSync(legacyBottlesDir)) {
        candidates.push(resolve(join(legacyBottlesDir, entry)))
      }
    } catch {
      // Ignore unreadable directory.
    }
  }

  const seen = new Set<string>()
  const bottles: DiscoveredBottle[] = []

  for (const candidate of candidates) {
    if (existingGmac.has(candidate) || seen.has(candidate)) {
      continue
    }
    seen.add(candidate)
    if (!isBottleDirectory(candidate)) {
      continue
    }
    bottles.push({
      id: candidate,
      name: readBottleName(candidate),
      path: candidate
    })
  }

  return bottles.sort((a, b) => a.name.localeCompare(b.name))
}

function detectSteamInstalled(home: string, gmacRegistryPlist: string): boolean {
  const candidateDirs = new Set<string>(readRegisteredBottlePaths(gmacRegistryPlist))
  const gmacBottlesDir = join(home, 'Library', 'Containers', GMAC_BUNDLE_ID, 'Bottles')

  if (existsSync(gmacBottlesDir)) {
    try {
      for (const entry of readdirSync(gmacBottlesDir)) {
        candidateDirs.add(resolve(join(gmacBottlesDir, entry)))
      }
    } catch {
      // Ignore unreadable directory.
    }
  }

  for (const bottlePath of candidateDirs) {
    const steamExe = join(bottlePath, 'drive_c', 'Program Files (x86)', 'Steam', 'steam.exe')
    if (existsSync(steamExe)) {
      return true
    }
  }

  return false
}

export function getSystemStatus(): SystemStatus {
  const home = homedir()
  const detectedToolkitFile = findNewestDownloadedToolkit(join(home, 'Downloads'))

  if (process.env.GMAC_FRESH_INSTALL === '1') {
    return {
      rosettaInstalled: false,
      engineInstalled: false,
      toolkitInstalled: false,
      detectedToolkitFile,
      legacyWhiskyBottles: [],
      steamInstalled: false
    }
  }

  const librariesDir = join(home, 'Library', 'Application Support', GMAC_BUNDLE_ID, 'Libraries')
  const gmacRegistryPlist = join(home, 'Library', 'Containers', GMAC_BUNDLE_ID, 'BottleVM.plist')

  const rosettaInstalled = existsSync(ROSETTA_RUNTIME_PATH)

  const engineInstalled =
    existsSync(join(librariesDir, 'WhiskyWineVersion.plist')) &&
    existsSync(join(librariesDir, 'Wine', 'bin', 'wine64'))

  const toolkitInstalled =
    existsSync(join(librariesDir, 'Wine', 'lib', 'wine', 'x86_64-unix', 'dxgi.so')) &&
    existsSync(join(librariesDir, 'Wine', 'lib', 'external', 'libd3dshared.dylib'))

  const legacyWhiskyBottles = findLegacyWhiskyBottles(home, gmacRegistryPlist)
  const steamInstalled = detectSteamInstalled(home, gmacRegistryPlist)

  return {
    rosettaInstalled,
    engineInstalled,
    toolkitInstalled,
    detectedToolkitFile,
    legacyWhiskyBottles,
    steamInstalled
  }
}
