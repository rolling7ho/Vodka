import type { BottleSummary, HomeSummary } from '../../../../shared/ipc'

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400 * 1000).toISOString()
}

const ART_CYBERPUNK = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 430" fill="none">
  <defs>
    <linearGradient id="cp-sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B0F1A"/>
      <stop offset="52%" stop-color="#1E132B"/>
      <stop offset="100%" stop-color="#3A1525"/>
    </linearGradient>
    <radialGradient id="cp-sun" cx="74%" cy="54%" r="36%">
      <stop offset="0%" stop-color="#FDE047" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#F43F5E" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#F43F5E" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cp-beam" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#22D3EE" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#22D3EE" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="920" height="430" fill="url(#cp-sky)"/>
  <circle cx="670" cy="215" r="190" fill="url(#cp-sun)"/>
  <path d="M510 430 L645 70 L705 70 L570 430 Z" fill="url(#cp-beam)"/>
  <path d="M0 320 L78 320 L78 235 L125 235 L125 290 L185 290 L185 160 L252 160 L252 260 L300 260 L300 112 L378 112 L378 275 L430 275 L430 185 L495 185 L495 300 L565 300 L565 130 L640 130 L640 245 L702 245 L702 95 L780 95 L780 265 L845 265 L845 190 L920 190 L920 430 L0 430 Z" fill="#0D0B14"/>
  <rect x="318" y="138" width="42" height="5" fill="#22D3EE"/>
  <rect x="318" y="152" width="26" height="4" fill="#22D3EE" opacity="0.7"/>
  <rect x="582" y="152" width="42" height="6" fill="#FDE047"/>
  <rect x="718" y="122" width="44" height="5" fill="#F43F5E"/>
  <rect x="202" y="182" width="32" height="4" fill="#F43F5E" opacity="0.8"/>
  <path d="M0 358 H920 M0 384 H920 M0 410 H920" stroke="#22D3EE" stroke-opacity="0.16" stroke-width="1"/>
  <path d="M360 330 L120 430 M440 330 L340 430 M520 330 L580 430 M600 330 L820 430" stroke="#F43F5E" stroke-opacity="0.22" stroke-width="1"/>
</svg>
`)

const LOGO_CYBERPUNK = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 92" fill="none">
  <g transform="skewX(-12)">
    <text x="36" y="54" fill="#FDE047" font-family="Impact, 'Arial Black', sans-serif" font-size="40" font-weight="900" letter-spacing="1.5">CYBERPUNK</text>
    <text x="38" y="52" stroke="#22D3EE" stroke-width="1.2" fill="none" font-family="Impact, 'Arial Black', sans-serif" font-size="40" font-weight="900" letter-spacing="1.5" opacity="0.7">CYBERPUNK</text>
  </g>
  <rect x="202" y="61" width="96" height="22" rx="3" fill="#22D3EE" fill-opacity="0.18" stroke="#22D3EE" stroke-width="1.4"/>
  <text x="250" y="77" text-anchor="middle" fill="#22D3EE" font-family="monospace" font-size="15" font-weight="700" letter-spacing="4">2077</text>
</svg>
`)

const ART_ELDEN_RING = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="er-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#13161B"/>
      <stop offset="55%" stop-color="#262119"/>
      <stop offset="100%" stop-color="#110E0B"/>
    </linearGradient>
    <radialGradient id="er-tree" cx="56%" cy="38%" r="48%">
      <stop offset="0%" stop-color="#FCD34D" stop-opacity="0.9"/>
      <stop offset="45%" stop-color="#D97706" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#D97706" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#er-bg)"/>
  <circle cx="358" cy="136" r="190" fill="url(#er-tree)"/>
  <path d="M342 360 C344 250 342 155 304 52 M356 360 C356 230 360 120 382 28 M366 360 C368 245 384 165 432 82 M348 210 C315 170 282 155 240 142" stroke="#FDE68A" stroke-width="3.2" stroke-linecap="round" opacity="0.82"/>
  <circle cx="358" cy="112" r="34" stroke="#FCD34D" stroke-width="2" opacity="0.7"/>
  <circle cx="338" cy="130" r="24" stroke="#FCD34D" stroke-width="1.5" opacity="0.5"/>
  <path d="M0 305 Q160 255 315 292 T640 272 L640 360 L0 360 Z" fill="#18130F"/>
  <path d="M0 330 Q210 295 420 322 T640 315 L640 360 L0 360 Z" fill="#0D0A08"/>
</svg>
`)

const LOGO_ELDEN_RING = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 68" fill="none">
  <circle cx="24" cy="34" r="13" stroke="#FCD34D" stroke-width="1.8" opacity="0.9"/>
  <circle cx="32" cy="34" r="9" stroke="#FDE68A" stroke-width="1.4" opacity="0.75"/>
  <line x1="28" y1="14" x2="28" y2="54" stroke="#FCD34D" stroke-width="1.6"/>
  <text x="52" y="42" fill="#FEF3C7" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="600" letter-spacing="4.5">ELDEN RING</text>
  <line x1="52" y1="49" x2="296" y2="49" stroke="#F59E0B" stroke-width="1" opacity="0.55"/>
</svg>
`)

const ART_BALDURS_GATE = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="bg3-sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#191016"/>
      <stop offset="55%" stop-color="#3B1622"/>
      <stop offset="100%" stop-color="#180D12"/>
    </linearGradient>
    <radialGradient id="bg3-moon" cx="50%" cy="44%" r="34%">
      <stop offset="0%" stop-color="#FDE68A" stop-opacity="0.85"/>
      <stop offset="48%" stop-color="#DC2626" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#DC2626" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg3-sky)"/>
  <circle cx="320" cy="158" r="145" fill="url(#bg3-moon)"/>
  <path d="M270 285 L320 112 L370 285 Z" stroke="#FBBF24" stroke-opacity="0.55" stroke-width="2" fill="none"/>
  <circle cx="320" cy="176" r="46" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1.5"/>
  <path d="M0 295 L110 250 L165 270 L238 205 L268 232 L320 175 L372 232 L405 205 L478 268 L535 245 L640 290 L640 360 L0 360 Z" fill="#120A0E"/>
</svg>
`)

const LOGO_BALDURS_GATE = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 72" fill="none">
  <text x="10" y="34" fill="#FDE68A" font-family="Georgia, 'Times New Roman', serif" font-size="23" font-weight="700" letter-spacing="2.5">BALDUR'S GATE</text>
  <text x="12" y="56" fill="#F87171" font-family="Georgia, 'Times New Roman', serif" font-size="15" font-weight="700" letter-spacing="6">III</text>
  <line x1="48" y1="51" x2="215" y2="51" stroke="#FBBF24" stroke-opacity="0.5" stroke-width="1.2"/>
</svg>
`)

const ART_HADES = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="hd-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A1B18"/>
      <stop offset="55%" stop-color="#12322A"/>
      <stop offset="100%" stop-color="#1D121F"/>
    </linearGradient>
    <radialGradient id="hd-glow" cx="50%" cy="52%" r="42%">
      <stop offset="0%" stop-color="#34D399" stop-opacity="0.72"/>
      <stop offset="55%" stop-color="#059669" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#059669" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#hd-bg)"/>
  <circle cx="320" cy="184" r="170" fill="url(#hd-glow)"/>
  <path d="M320 58 L392 178 L320 298 L248 178 Z" stroke="#A7F3D0" stroke-width="2.5" fill="#064E3B" fill-opacity="0.35"/>
  <path d="M320 96 L362 178 L320 260 L278 178 Z" stroke="#FCD34D" stroke-width="1.8" fill="none"/>
  <path d="M0 302 L150 260 L290 294 L465 256 L640 298 L640 360 L0 360 Z" fill="#081110"/>
</svg>
`)

const LOGO_HADES = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 66" fill="none">
  <path d="M22 14 L32 32 L22 50 L12 32 Z" fill="#34D399" stroke="#FCD34D" stroke-width="1.6"/>
  <text x="44" y="42" fill="#ECFDF5" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="800" letter-spacing="4">HADES</text>
  <text x="190" y="42" fill="#FCD34D" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="800" letter-spacing="2">II</text>
</svg>
`)

const ART_RDR2 = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="rd-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7C1D18"/>
      <stop offset="55%" stop-color="#DC2626"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#rd-sky)"/>
  <circle cx="430" cy="212" r="88" fill="#FEF3C7" opacity="0.88"/>
  <path d="M0 245 L110 218 L185 232 L265 182 L322 182 L365 224 L485 204 L575 232 L640 215 L640 360 L0 360 Z" fill="#2A0B0A"/>
  <path d="M0 292 L195 270 L390 288 L640 268 L640 360 L0 360 Z" fill="#140505"/>
</svg>
`)

const LOGO_RDR2 = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 74" fill="none">
  <rect x="6" y="8" width="212" height="24" rx="2" fill="#140505" fill-opacity="0.72"/>
  <text x="14" y="25" fill="#FEF3C7" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-weight="800" letter-spacing="2.8">RED DEAD</text>
  <text x="10" y="54" fill="#FFFFFF" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="800" letter-spacing="1.6">REDEMPTION II</text>
</svg>
`)

const ART_FORZA = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="fz-sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1E1B4B"/>
      <stop offset="48%" stop-color="#BE185D"/>
      <stop offset="100%" stop-color="#FB923C"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#fz-sky)"/>
  <circle cx="320" cy="210" r="76" fill="#FDE047" opacity="0.82"/>
  <path d="M0 232 L160 198 L275 226 L445 190 L640 225 L640 360 L0 360 Z" fill="#1E1428"/>
  <path d="M295 235 L110 360 L530 360 L345 235 Z" fill="#110C1A"/>
  <path d="M320 242 L320 360" stroke="#FDE047" stroke-width="3" stroke-dasharray="16 14"/>
</svg>
`)

const LOGO_FORZA = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 72" fill="none">
  <g transform="skewX(-14)">
    <text x="20" y="34" fill="#FFFFFF" font-family="Impact, 'Arial Black', sans-serif" font-size="26" font-weight="900" letter-spacing="3">FORZA</text>
    <rect x="20" y="42" width="168" height="20" rx="2" fill="#F43F5E"/>
    <text x="28" y="57" fill="#FFFFFF" font-family="sans-serif" font-size="13" font-weight="800" letter-spacing="3.5">HORIZON 5</text>
  </g>
</svg>
`)

const ART_HOLLOW_KNIGHT = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="hk-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#090D16"/>
      <stop offset="60%" stop-color="#162136"/>
      <stop offset="100%" stop-color="#070A12"/>
    </linearGradient>
    <radialGradient id="hk-lamp" cx="50%" cy="48%" r="36%">
      <stop offset="0%" stop-color="#E0F2FE" stop-opacity="0.88"/>
      <stop offset="42%" stop-color="#38BDF8" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#hk-bg)"/>
  <circle cx="320" cy="172" r="160" fill="url(#hk-lamp)"/>
  <ellipse cx="320" cy="170" rx="28" ry="34" fill="#F8FAFC"/>
  <ellipse cx="309" cy="172" rx="5.5" ry="9" fill="#090D16"/>
  <ellipse cx="331" cy="172" rx="5.5" ry="9" fill="#090D16"/>
  <path d="M0 288 Q160 250 320 278 T640 270 L640 360 L0 360 Z" fill="#05070D"/>
</svg>
`)

const LOGO_HOLLOW_KNIGHT = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 70" fill="none">
  <text x="10" y="34" fill="#F8FAFC" font-family="Georgia, 'Times New Roman', serif" font-size="23" font-weight="600" letter-spacing="3.5">HOLLOW</text>
  <text x="10" y="56" fill="#BAE6FD" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="600" letter-spacing="5.5">KNIGHT</text>
</svg>
`)

export const MOCK_PCS: BottleSummary[] = [
  {
    name: 'Steam',
    path: '/Users/ivan/Mock/Bottles/steam',
    windowsVersion: 'Windows 10',
    graphicsBackend: 'recommended',
    isAvailable: true,
    icon: 'steam'
  },
  {
    name: 'Night City Rig',
    path: '/Users/ivan/Mock/Bottles/night-city',
    windowsVersion: 'Windows 10',
    graphicsBackend: 'd3dMetal',
    isAvailable: true,
    icon: 'bolt'
  },
  {
    name: 'Indie Vault',
    path: '/Users/ivan/Mock/Bottles/indie-vault',
    windowsVersion: 'Windows 10',
    graphicsBackend: 'recommended',
    isAvailable: true,
    icon: 'gamepad'
  }
]

export const MOCK_HOME_SUMMARY: HomeSummary = {
  stats: {
    totalPlaytimeSeconds: Math.round(142.8 * 3600),
    lastTwoWeeksSeconds: Math.round(11.4 * 3600),
    gamesInstalled: 14,
    pcsCount: 3,
    hoursHistory: [
      { date: daysAgoIso(30), value: 94.2 },
      { date: daysAgoIso(25), value: 101.6 },
      { date: daysAgoIso(20), value: 112.4 },
      { date: daysAgoIso(15), value: 121.0 },
      { date: daysAgoIso(10), value: 130.5 },
      { date: daysAgoIso(5), value: 137.9 },
      { date: daysAgoIso(0), value: 142.8 }
    ],
    recentHoursHistory: [
      { date: daysAgoIso(12), value: 1.1 },
      { date: daysAgoIso(10), value: 1.9 },
      { date: daysAgoIso(8), value: 1.4 },
      { date: daysAgoIso(6), value: 2.3 },
      { date: daysAgoIso(4), value: 1.7 },
      { date: daysAgoIso(2), value: 1.2 },
      { date: daysAgoIso(0), value: 1.8 }
    ],
    gamesHistory: [
      { date: daysAgoIso(30), value: 6 },
      { date: daysAgoIso(25), value: 7 },
      { date: daysAgoIso(20), value: 9 },
      { date: daysAgoIso(15), value: 10 },
      { date: daysAgoIso(10), value: 12 },
      { date: daysAgoIso(5), value: 13 },
      { date: daysAgoIso(0), value: 14 }
    ]
  },
  continuePlaying: {
    id: 'mock:cyberpunk-2077',
    name: 'Cyberpunk 2077',
    bottleName: 'Night City Rig',
    bottlePath: '/Users/ivan/Mock/Bottles/night-city',
    launchKind: 'steam',
    steamAppId: 1091500,
    programPath: null,
    totalPlaytimeSeconds: Math.round(48.6 * 3600),
    lastTwoWeeksSeconds: Math.round(6.2 * 3600),
    lastPlayedIso: hoursAgoIso(2),
    artworkDataUrl: ART_CYBERPUNK,
    logoDataUrl: LOGO_CYBERPUNK
  },
  recentlyPlayed: [
    {
      id: 'mock:elden-ring',
      name: 'Elden Ring',
      bottleName: 'Steam',
      bottlePath: '/Users/ivan/Mock/Bottles/steam',
      launchKind: 'steam',
      steamAppId: 1245620,
      programPath: null,
      totalPlaytimeSeconds: Math.round(39.2 * 3600),
      lastTwoWeeksSeconds: Math.round(3.1 * 3600),
      lastPlayedIso: hoursAgoIso(26),
      artworkDataUrl: ART_ELDEN_RING,
      logoDataUrl: LOGO_ELDEN_RING
    },
    {
      id: 'mock:baldurs-gate-3',
      name: "Baldur's Gate 3",
      bottleName: 'Steam',
      bottlePath: '/Users/ivan/Mock/Bottles/steam',
      launchKind: 'steam',
      steamAppId: 1086940,
      programPath: null,
      totalPlaytimeSeconds: Math.round(27.4 * 3600),
      lastTwoWeeksSeconds: Math.round(1.4 * 3600),
      lastPlayedIso: hoursAgoIso(52),
      artworkDataUrl: ART_BALDURS_GATE,
      logoDataUrl: LOGO_BALDURS_GATE
    },
    {
      id: 'mock:hades-2',
      name: 'Hades II',
      bottleName: 'Indie Vault',
      bottlePath: '/Users/ivan/Mock/Bottles/indie-vault',
      launchKind: 'steam',
      steamAppId: 1145350,
      programPath: null,
      totalPlaytimeSeconds: Math.round(14.8 * 3600),
      lastTwoWeeksSeconds: Math.round(0.7 * 3600),
      lastPlayedIso: hoursAgoIso(96),
      artworkDataUrl: ART_HADES,
      logoDataUrl: LOGO_HADES
    },
    {
      id: 'mock:rdr2',
      name: 'Red Dead Redemption 2',
      bottleName: 'Steam',
      bottlePath: '/Users/ivan/Mock/Bottles/steam',
      launchKind: 'steam',
      steamAppId: 1174180,
      programPath: null,
      totalPlaytimeSeconds: Math.round(8.3 * 3600),
      lastTwoWeeksSeconds: 0,
      lastPlayedIso: hoursAgoIso(144),
      artworkDataUrl: ART_RDR2,
      logoDataUrl: LOGO_RDR2
    },
    {
      id: 'mock:forza-horizon-5',
      name: 'Forza Horizon 5',
      bottleName: 'Night City Rig',
      bottlePath: '/Users/ivan/Mock/Bottles/night-city',
      launchKind: 'steam',
      steamAppId: 1551360,
      programPath: null,
      totalPlaytimeSeconds: Math.round(3.1 * 3600),
      lastTwoWeeksSeconds: 0,
      lastPlayedIso: hoursAgoIso(216),
      artworkDataUrl: ART_FORZA,
      logoDataUrl: LOGO_FORZA
    },
    {
      id: 'mock:hollow-knight',
      name: 'Hollow Knight',
      bottleName: 'Indie Vault',
      bottlePath: '/Users/ivan/Mock/Bottles/indie-vault',
      launchKind: 'steam',
      steamAppId: 367520,
      programPath: null,
      totalPlaytimeSeconds: Math.round(1.4 * 3600),
      lastTwoWeeksSeconds: 0,
      lastPlayedIso: hoursAgoIso(288),
      artworkDataUrl: ART_HOLLOW_KNIGHT,
      logoDataUrl: LOGO_HOLLOW_KNIGHT
    }
  ],
  launchers: [
    {
      id: 'steam',
      name: 'Steam',
      installed: true,
      bottleName: 'Steam',
      bottlePath: '/Users/ivan/Mock/Bottles/steam',
      executablePath: '/Users/ivan/Mock/Bottles/steam/drive_c/Program Files (x86)/Steam/steam.exe'
    },
    {
      id: 'epicGames',
      name: 'Epic Games Store',
      installed: true,
      bottleName: 'Night City Rig',
      bottlePath: '/Users/ivan/Mock/Bottles/night-city',
      executablePath: '/Users/ivan/Mock/Bottles/night-city/drive_c/Epic/EpicGamesLauncher.exe'
    },
    {
      id: 'battleNet',
      name: 'Battle.net',
      installed: true,
      bottleName: 'Steam',
      bottlePath: '/Users/ivan/Mock/Bottles/steam',
      executablePath: '/Users/ivan/Mock/Bottles/steam/drive_c/Battle.net/Battle.net.exe'
    },
    {
      id: 'eaApp',
      name: 'EA App',
      installed: false,
      bottleName: null,
      bottlePath: null,
      executablePath: null
    },
    {
      id: 'rockstar',
      name: 'Rockstar Games',
      installed: false,
      bottleName: null,
      bottlePath: null,
      executablePath: null
    },
    {
      id: 'ubisoft',
      name: 'Ubisoft Connect',
      installed: false,
      bottleName: null,
      bottlePath: null,
      executablePath: null
    }
  ]
}
