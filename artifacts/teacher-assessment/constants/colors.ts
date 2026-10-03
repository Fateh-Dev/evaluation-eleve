export type ThemeId =
  | 'ocean'
  | 'sage'
  | 'lavender'
  | 'sunset'
  | 'slate'
  | 'forest'
  | 'rose'
  | 'amber'
  | 'midnight';

type Palette = {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  successSurface: string;
  successForeground: string;
  warningSurface: string;
  warningForeground: string;
  errorSurface: string;
  errorForeground: string;
  pendingSurface: string;
  pendingForeground: string;
  hero: string;
  heroForeground: string;
};

export type ThemeOption = {
  id: ThemeId;
  label: string;
  description: string;
  swatches: [string, string, string];
};

const sharedLight = {
  background: '#f7f8fa',
  foreground: '#1f2933',
  card: '#ffffff',
  cardForeground: '#1f2933',
  primaryForeground: '#ffffff',
  secondary: '#e9eef2',
  secondaryForeground: '#1f2933',
  muted: '#eef2f5',
  mutedForeground: '#687782',
  destructive: '#c94f4f',
  destructiveForeground: '#ffffff',
  border: '#d8e0e6',
  input: '#bdc9d1',
  successSurface: '#e4f3ec',
  successForeground: '#2f795f',
  warningSurface: '#fff2d4',
  warningForeground: '#8a641e',
  errorSurface: '#fbe3df',
  errorForeground: '#a24e42',
  pendingSurface: '#fff0e7',
  pendingForeground: '#9a5d25',
};

const sharedDark = {
  background: '#101820',
  foreground: '#f1f5f7',
  card: '#182630',
  cardForeground: '#f1f5f7',
  primaryForeground: '#ffffff',
  secondary: '#273943',
  secondaryForeground: '#f1f5f7',
  muted: '#24343e',
  mutedForeground: '#aab9bf',
  destructive: '#f07b77',
  destructiveForeground: '#291313',
  border: '#344852',
  input: '#4a5d66',
  successSurface: '#1e3b35',
  successForeground: '#9dd9c3',
  warningSurface: '#4a3b20',
  warningForeground: '#f4ca72',
  errorSurface: '#482a2c',
  errorForeground: '#ffaaa4',
  pendingSurface: '#4a3023',
  pendingForeground: '#ffc18f',
};

function createPalette(light: { primary: string; accent: string; accentForeground: string; hero: string }, dark: { primary: string; accent: string; accentForeground: string; hero: string }) {
  return {
    light: {
      ...sharedLight,
      text: sharedLight.foreground,
      tint: light.primary,
      primary: light.primary,
      accent: light.accent,
      accentForeground: light.accentForeground,
      hero: light.hero,
      heroForeground: '#ffffff',
    },
    dark: {
      ...sharedDark,
      text: sharedDark.foreground,
      tint: dark.primary,
      primary: dark.primary,
      accent: dark.accent,
      accentForeground: dark.accentForeground,
      hero: dark.hero,
      heroForeground: '#f1f5f7',
    },
  } satisfies { light: Palette; dark: Palette };
}

export const themeOptions: ThemeOption[] = [
  { id: 'ocean', label: 'Océan', description: 'Bleu profond et corail', swatches: ['#183143', '#ef765c', '#d9e8e4'] },
  { id: 'sage', label: 'Sauge', description: 'Vert calme et naturel', swatches: ['#245c52', '#66a182', '#dcefe6'] },
  { id: 'lavender', label: 'Lavande', description: 'Violet doux et moderne', swatches: ['#4d4675', '#9178c5', '#e9e2f7'] },
  { id: 'sunset', label: 'Solaire', description: 'Terracotta chaleureux', swatches: ['#713d32', '#e27d58', '#f8e2d4'] },
  { id: 'slate', label: 'Ardoise', description: 'Bleu-gris professionnel', swatches: ['#29445b', '#4b91b3', '#dcebf2'] },
  { id: 'forest', label: 'Forêt', description: 'Vert profond et frais', swatches: ['#254c3d', '#79a96b', '#e5efdc'] },
  { id: 'rose', label: 'Rose poudré', description: 'Prune douce et rosé', swatches: ['#653f56', '#c27691', '#f3e2e8'] },
  { id: 'amber', label: 'Ambre', description: 'Tons dorés et naturels', swatches: ['#654b25', '#d49a3a', '#f5ebd4'] },
  { id: 'midnight', label: 'Nuit', description: 'Indigo et bleu lumineux', swatches: ['#292d55', '#6d79cf', '#e3e7fb'] },
];

export const themePalettes = {
  ocean: createPalette(
    { primary: '#ef765c', accent: '#d9e8e4', accentForeground: '#183143', hero: '#183143' },
    { primary: '#ff967b', accent: '#24453f', accentForeground: '#d9f1e9', hero: '#1e3d50' },
  ),
  sage: createPalette(
    { primary: '#3f8b68', accent: '#dcefe6', accentForeground: '#245c52', hero: '#245c52' },
    { primary: '#78c49b', accent: '#24483d', accentForeground: '#d9f3e5', hero: '#1f463c' },
  ),
  lavender: createPalette(
    { primary: '#7561ae', accent: '#e9e2f7', accentForeground: '#4d4675', hero: '#4d4675' },
    { primary: '#b7a1ed', accent: '#3c345e', accentForeground: '#eee8ff', hero: '#3b345d' },
  ),
  sunset: createPalette(
    { primary: '#d86845', accent: '#f8e2d4', accentForeground: '#713d32', hero: '#713d32' },
    { primary: '#f19a72', accent: '#513027', accentForeground: '#ffe7dc', hero: '#522f26' },
  ),
  slate: createPalette(
    { primary: '#3f86a8', accent: '#dcebf2', accentForeground: '#29445b', hero: '#29445b' },
    { primary: '#78bdd8', accent: '#263f4c', accentForeground: '#dff4fc', hero: '#243e4e' },
  ),
  forest: createPalette(
    { primary: '#56834b', accent: '#e5efdc', accentForeground: '#254c3d', hero: '#254c3d' },
    { primary: '#98c77f', accent: '#2b4334', accentForeground: '#e4f3d9', hero: '#203a30' },
  ),
  rose: createPalette(
    { primary: '#a85e78', accent: '#f3e2e8', accentForeground: '#653f56', hero: '#653f56' },
    { primary: '#df91aa', accent: '#4b303f', accentForeground: '#fbe6ee', hero: '#422a3b' },
  ),
  amber: createPalette(
    { primary: '#a97925', accent: '#f5ebd4', accentForeground: '#654b25', hero: '#654b25' },
    { primary: '#e1b45f', accent: '#45391f', accentForeground: '#f9efda', hero: '#40351f' },
  ),
  midnight: createPalette(
    { primary: '#5865b5', accent: '#e3e7fb', accentForeground: '#292d55', hero: '#292d55' },
    { primary: '#929ef0', accent: '#303652', accentForeground: '#e9ecff', hero: '#242945' },
  ),
} satisfies Record<ThemeId, { light: Palette; dark: Palette }>;

const colors = { ...themePalettes.ocean, radius: 14 };

export default colors;
