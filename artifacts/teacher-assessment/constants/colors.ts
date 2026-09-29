/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#183143',
    tint: '#ef765c',

    // Core surfaces
    background: '#f7f4ef',
    foreground: '#183143',

    // Cards / elevated surfaces
    card: '#fffdfa',
    cardForeground: '#183143',

    // Primary action color (buttons, links, active states)
    primary: '#ef765c',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#e9e3d9',
    secondaryForeground: '#183143',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#eee9e1',
    mutedForeground: '#6c7a82',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#d9e8e4',
    accentForeground: '#183143',

    // Destructive actions (delete, error states)
    destructive: '#c94f4f',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#ded7cc',
    input: '#cfc6b9',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export default colors;
