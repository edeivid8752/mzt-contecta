// Preferencias de apariencia locales. No constituyen datos de una cuenta real.
const STORAGE_KEY = 'mzt-conecta-appearance-v1';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const THEMES = Object.freeze({
  conecta: {name: 'MZT Conecta', description: 'Azul original de la comunidad', sidebar: '#052746', primary: '#087ca2', accent: '#06aaca', background: '#f5f8fb'},
  guinda: {name: 'Guinda institucional', description: 'Guinda y dorado de Acceso Lince', sidebar: '#561323', primary: '#9d253c', accent: '#d0a76b', background: '#fbf6f7'},
  medianoche: {name: 'Azul medianoche', description: 'Sobrio, profundo y elegante', sidebar: '#0d1e3c', primary: '#284b86', accent: '#78a8ee', background: '#f3f6fc'},
  ciruela: {name: 'Ciruela imperial', description: 'Un toque creativo y sofisticado', sidebar: '#351b40', primary: '#714383', accent: '#b781c6', background: '#faf5fb'},
  terracota: {name: 'Terracota noble', description: 'Cálido y cercano a tu ciudad', sidebar: '#573126', primary: '#aa563c', accent: '#df9674', background: '#fff7f3'}
});

const FIELDS = ['sidebar', 'primary', 'accent', 'background'];
const DEFAULT = Object.freeze({preset: 'conecta', custom: {...THEMES.conecta}});

function validPalette(value) {
  return value && typeof value === 'object' && FIELDS.every(key => HEX_COLOR.test(value[key] || ''));
}

function getStored() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data || typeof data !== 'object') return {...DEFAULT};
    return {
      preset: data.preset === 'custom' || THEMES[data.preset] ? data.preset : 'conecta',
      custom: validPalette(data.custom) ? Object.fromEntries(FIELDS.map(key => [key, data.custom[key].toLowerCase()])) : {...THEMES.conecta}
    };
  } catch { return {...DEFAULT}; }
}

let selection = getStored();

function contrastText(hex) {
  const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
  const light = rgb.map(n => n <= 0.04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  const luminance = .2126 * light[0] + .7152 * light[1] + .0722 * light[2];
  return luminance > .38 ? '#163248' : '#ffffff';
}

export function activePalette() {
  return selection.preset === 'custom' ? selection.custom : THEMES[selection.preset];
}

export function themeSelection() { return {preset: selection.preset, custom: {...selection.custom}}; }

export function applyTheme() {
  const colors = activePalette();
  const root = document.documentElement;
  root.dataset.appearance = selection.preset;
  root.style.setProperty('--skin-sidebar', colors.sidebar);
  root.style.setProperty('--skin-primary', colors.primary);
  root.style.setProperty('--skin-accent', colors.accent);
  root.style.setProperty('--skin-background', colors.background);
  root.style.setProperty('--skin-on-primary', contrastText(colors.primary));
  root.style.setProperty('--cyan', colors.accent);
  root.style.setProperty('--paper', colors.background);
  return colors;
}

function save() {
  applyTheme();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selection)); }
  catch { /* La apariencia sigue activa durante esta visita. */ }
}

export function choosePreset(name) {
  if (!Object.hasOwn(THEMES, name)) return false;
  selection.preset = name;
  save();
  return true;
}

export function chooseCustom(value) {
  if (!validPalette(value)) return false;
  selection.custom = Object.fromEntries(FIELDS.map(key => [key, value[key].toLowerCase()]));
  selection.preset = 'custom';
  save();
  return true;
}

export function restoreDefault() {
  selection = {preset: 'conecta', custom: {...THEMES.conecta}};
  save();
}
