export const viviTokens = {
  ink: '#202629', paper: '#f4efe7', muted: '#756f69', line: '#d9d0c4',
  accent: '#b85f49', accentDark: '#783d36', light: '#fffaf2',
  radius: { card: 20, control: 12 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  safeArea: { top: 0.12, right: 0.1, bottom: 0.18, left: 0.1 },
} as const;

export type PaletteName = keyof typeof palettes;
export const palettes = {
  memoryWarm: { sky: '#c8a693', wall: '#eee0c8', floor: '#b58b70', shadow: '#605d53', practical: '#f7ce86', accent: '#a6664e' },
  relationshipNight: { sky: '#30334b', wall: '#514455', floor: '#65515b', shadow: '#292c3d', practical: '#f0b47d', accent: '#d48778' },
  creepyDomestic: { sky: '#182d3b', wall: '#526370', floor: '#3a5361', shadow: '#1d303d', practical: '#cab185', accent: '#b95753' },
  socialTension: { sky: '#6d7370', wall: '#c6c3b7', floor: '#878b7e', shadow: '#4c5859', practical: '#f0d6aa', accent: '#a7584d' },
  workNight: { sky: '#1f3747', wall: '#536a74', floor: '#354d59', shadow: '#1c303b', practical: '#d5bb89', accent: '#c26055' },
  cityRain: { sky: '#304454', wall: '#6a7981', floor: '#415965', shadow: '#243947', practical: '#d7ad79', accent: '#bb7468' },
} as const;
