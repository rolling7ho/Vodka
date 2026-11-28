import type { HomeGameItem, HomeSummary } from '../../../../shared/ipc'
import baldursGate3HeaderUrl from '../../assets/mock/baldurs-gate-3-header.jpg'
import baldursGate3LogoUrl from '../../assets/mock/baldurs-gate-3-logo.png'
import baldursGate3PortraitUrl from '../../assets/mock/baldurs-gate-3-portrait.jpg'
import cyberpunkHeroUrl from '../../assets/mock/cyberpunk-hero.jpg'
import cyberpunkLogoUrl from '../../assets/mock/cyberpunk-logo.png'
import cyberpunkPortraitUrl from '../../assets/mock/cyberpunk-portrait.jpg'
import eldenRingHeaderUrl from '../../assets/mock/elden-ring-header.jpg'
import eldenRingLogoUrl from '../../assets/mock/elden-ring-logo.png'
import eldenRingPortraitUrl from '../../assets/mock/elden-ring-portrait.jpg'
import forzaHorizon5HeaderUrl from '../../assets/mock/forza-horizon-5-header.jpg'
import forzaHorizon5LogoUrl from '../../assets/mock/forza-horizon-5-logo.png'
import forzaHorizon5PortraitUrl from '../../assets/mock/forza-horizon-5-portrait.jpg'
import hades2HeaderUrl from '../../assets/mock/hades-2-header.jpg'
import hades2LogoUrl from '../../assets/mock/hades-2-logo.png'
import hades2PortraitUrl from '../../assets/mock/hades-2-portrait.jpg'
import hollowKnightHeaderUrl from '../../assets/mock/hollow-knight-header.jpg'
import hollowKnightLogoUrl from '../../assets/mock/hollow-knight-logo.png'
import hollowKnightPortraitUrl from '../../assets/mock/hollow-knight-portrait.jpg'
import rdr2HeaderUrl from '../../assets/mock/rdr2-header.jpg'
import rdr2LogoUrl from '../../assets/mock/rdr2-logo.png'
import rdr2PortraitUrl from '../../assets/mock/rdr2-portrait.jpg'

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400 * 1000).toISOString()
}

export const MOCK_GAMES: HomeGameItem[] = [
  {
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
    artworkDataUrl: cyberpunkHeroUrl,
    portraitArtworkDataUrl: cyberpunkPortraitUrl,
    logoDataUrl: cyberpunkLogoUrl
  },
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
    artworkDataUrl: eldenRingHeaderUrl,
    portraitArtworkDataUrl: eldenRingPortraitUrl,
    logoDataUrl: eldenRingLogoUrl
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
    artworkDataUrl: baldursGate3HeaderUrl,
    portraitArtworkDataUrl: baldursGate3PortraitUrl,
    logoDataUrl: baldursGate3LogoUrl
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
    artworkDataUrl: hades2HeaderUrl,
    portraitArtworkDataUrl: hades2PortraitUrl,
    logoDataUrl: hades2LogoUrl
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
    lastPlayedIso: daysAgoIso(12),
    artworkDataUrl: rdr2HeaderUrl,
    portraitArtworkDataUrl: rdr2PortraitUrl,
    logoDataUrl: rdr2LogoUrl
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
    lastPlayedIso: daysAgoIso(26),
    artworkDataUrl: forzaHorizon5HeaderUrl,
    portraitArtworkDataUrl: forzaHorizon5PortraitUrl,
    logoDataUrl: forzaHorizon5LogoUrl
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
    lastPlayedIso: daysAgoIso(45),
    artworkDataUrl: hollowKnightHeaderUrl,
    portraitArtworkDataUrl: hollowKnightPortraitUrl,
    logoDataUrl: hollowKnightLogoUrl
  }
]

export const MOCK_HOME_SUMMARY: HomeSummary = {
  stats: {
    totalPlaytimeSeconds: Math.round(142.8 * 3600),
    lastTwoWeeksSeconds: Math.round(11.4 * 3600),
    gamesInstalled: MOCK_GAMES.length,
    pcsCount: 3,
    hoursHistory: [
      { date: daysAgoIso(30), value: 86.0 },
      { date: daysAgoIso(25), value: 89.4 },
      { date: daysAgoIso(20), value: 104.2 },
      { date: daysAgoIso(15), value: 109.1 },
      { date: daysAgoIso(10), value: 126.8 },
      { date: daysAgoIso(5), value: 132.2 },
      { date: daysAgoIso(0), value: 142.8 }
    ],
    recentHoursHistory: [
      { date: daysAgoIso(12), value: 0.7 },
      { date: daysAgoIso(10), value: 2.8 },
      { date: daysAgoIso(8), value: 0.9 },
      { date: daysAgoIso(6), value: 3.1 },
      { date: daysAgoIso(4), value: 1.4 },
      { date: daysAgoIso(2), value: 0.6 },
      { date: daysAgoIso(0), value: 2.4 }
    ],
    gamesHistory: [
      { date: daysAgoIso(30), value: 3 },
      { date: daysAgoIso(25), value: 4 },
      { date: daysAgoIso(20), value: 4 },
      { date: daysAgoIso(15), value: 5 },
      { date: daysAgoIso(10), value: 6 },
      { date: daysAgoIso(5), value: 6 },
      { date: daysAgoIso(0), value: MOCK_GAMES.length }
    ]
  },
  continuePlaying: MOCK_GAMES[0],
  recentlyPlayed: MOCK_GAMES.slice(1),
  allGames: MOCK_GAMES,
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
