/**
 * Full-application themes.
 *
 * Structure:
 *  - Button color (accent): applies on top of EVERY theme.
 *  - Simple themes: clean static skins (Crimson, Rose, Amber, Royal, Forest, Ocean).
 *  - Effect themes: animated living backgrounds
 *    (Mirror, Matrix, PlayStation, Xbox, Versus + Pro/Elite/Ultra max-life variants).
 *
 * `midnight` is kept only as a legacy fallback for old installs.
 */

export type AppThemeId =
  | 'midnight'
  | 'crimson' | 'rose' | 'ember' | 'royal' | 'forest' | 'abyss'
  | 'mirror' | 'matrix'
  | 'playstation' | 'xbox' | 'versus'
  | 'playstation_pro' | 'xbox_elite' | 'versus_ultra';

export type FxKind =
  | 'none' | 'mirror' | 'matrix'
  | 'playstation' | 'xbox' | 'versus'
  | 'ps_pro' | 'xb_elite' | 'versus_ultra';

export type AppTheme = {
  id: AppThemeId;
  label: [string, string, string]; // EN, FR, AR
  accent: string; accentDark: string; accentLight: string;
  bg: string;
  headerBg: string;
  panel: string;
  panelSoft: string;
  input: string;
  border: string;
  borderSoft: string;
  text: string;
  muted: string;
  bodyBackground: string;
  effect: FxKind;
};

export const appThemes: Record<AppThemeId, AppTheme> = {
  midnight: {
    id: 'midnight', label: ['Midnight Neon', 'Néon minuit', 'نيون منتصف الليل'],
    accent: '#20d26c', accentDark: '#20c96b', accentLight: '#2ae17b',
    bg: '#070c16', headerBg: '#080e19', panel: '#0d1524', panelSoft: '#101b2c',
    input: '#141f33', border: '#22324d', borderSoft: '#1b2a42',
    text: '#f2f7fb', muted: '#94a3b8',
    bodyBackground: 'radial-gradient(circle at 15% 0%, rgba(32,210,108,0.10), transparent 32%), radial-gradient(circle at 85% 10%, rgba(8,181,238,0.10), transparent 30%), #070c16',
    effect: 'none',
  },

  // ---------------- Simple themes (static, clearly differentiated) ----------------
  crimson: {
    id: 'crimson', label: ['Crimson', 'Cramoisi', 'قرمزي'],
    accent: '#ff2d3f', accentDark: '#d92634', accentLight: '#ff6b76',
    bg: '#160608', headerBg: '#180709', panel: '#221016', panelSoft: '#2b141b',
    input: '#331820', border: '#5c2430', borderSoft: '#462028',
    text: '#fff0f1', muted: '#c9929a',
    bodyBackground: 'radial-gradient(circle at 15% 0%, rgba(255,45,63,0.22), transparent 38%), radial-gradient(circle at 88% 18%, rgba(217,38,52,0.12), transparent 32%), linear-gradient(165deg, #1a070a 0%, #160608 55%, #100405 100%)',
    effect: 'none',
  },
  rose: {
    id: 'rose', label: ['Rose', 'Rose', 'وردي'],
    accent: '#fb7185', accentDark: '#e11d48', accentLight: '#fda4af',
    bg: '#170a10', headerBg: '#190b12', panel: '#231019', panelSoft: '#2c1420',
    input: '#371826', border: '#5e2440', borderSoft: '#4a1e34',
    text: '#fff0f4', muted: '#cf9ab0',
    bodyBackground: 'radial-gradient(circle at 82% 0%, rgba(251,113,133,0.20), transparent 38%), radial-gradient(circle at 12% 20%, rgba(225,29,72,0.10), transparent 32%), linear-gradient(165deg, #1c0d15 0%, #170a10 55%, #120810 100%)',
    effect: 'none',
  },
  ember: {
    id: 'ember', label: ['Amber', 'Ambre', 'كهرماني'],
    accent: '#ffb13b', accentDark: '#f59e0b', accentLight: '#ffd07a',
    bg: '#150c05', headerBg: '#170d06', panel: '#201309', panelSoft: '#2a1810',
    input: '#35200f', border: '#5e3a15', borderSoft: '#4a2d12',
    text: '#fff4e4', muted: '#c8a87e',
    bodyBackground: 'radial-gradient(circle at 18% 0%, rgba(255,177,59,0.20), transparent 38%), radial-gradient(circle at 88% 22%, rgba(245,158,11,0.10), transparent 32%), linear-gradient(165deg, #1b1007 0%, #150c05 55%, #100903 100%)',
    effect: 'none',
  },
  royal: {
    id: 'royal', label: ['Royal', 'Royal', 'ملكي'],
    accent: '#a78bfa', accentDark: '#8b6ff0', accentLight: '#c9b8ff',
    bg: '#0e0a1e', headerBg: '#100c22', panel: '#161130', panelSoft: '#1d1640',
    input: '#231b4e', border: '#3a2d75', borderSoft: '#2e245e',
    text: '#f1ecff', muted: '#ab9fd6',
    bodyBackground: 'radial-gradient(circle at 15% 0%, rgba(167,139,250,0.22), transparent 38%), radial-gradient(circle at 88% 18%, rgba(139,92,246,0.12), transparent 32%), linear-gradient(165deg, #140e28 0%, #0e0a1e 55%, #0a0716 100%)',
    effect: 'none',
  },
  forest: {
    id: 'forest', label: ['Forest', 'Forêt', 'غابة'],
    accent: '#34d399', accentDark: '#10b981', accentLight: '#7df0c4',
    bg: '#06110c', headerBg: '#07130d', panel: '#0b1a12', panelSoft: '#0f2419',
    input: '#122c1f', border: '#1e4430', borderSoft: '#173626',
    text: '#ecfdf5', muted: '#8fb8a4',
    bodyBackground: 'radial-gradient(circle at 20% 0%, rgba(52,211,153,0.20), transparent 38%), radial-gradient(circle at 90% 20%, rgba(16,185,129,0.10), transparent 32%), linear-gradient(165deg, #0a1a12 0%, #06110c 55%, #040c08 100%)',
    effect: 'none',
  },
  abyss: {
    id: 'abyss', label: ['Ocean', 'Océan', 'محيط'],
    accent: '#08b5ee', accentDark: '#0896c9', accentLight: '#4fd2ff',
    bg: '#050b16', headerBg: '#060d19', panel: '#0a1526', panelSoft: '#0e1c33',
    input: '#122740', border: '#1f3f60', borderSoft: '#18314b',
    text: '#eef6ff', muted: '#8ba9c8',
    bodyBackground: 'radial-gradient(circle at 82% 0%, rgba(8,181,238,0.22), transparent 38%), radial-gradient(circle at 10% 18%, rgba(59,130,246,0.12), transparent 32%), linear-gradient(165deg, #081222 0%, #050b16 55%, #030710 100%)',
    effect: 'none',
  },

  // ---------------- Effect themes (living backgrounds) ----------------
  mirror: {
    id: 'mirror', label: ['Mirror Glass', 'Miroir vivant', 'مرآة حيّة'],
    accent: '#7dd3fc', accentDark: '#38bdf8', accentLight: '#bae6fd',
    bg: '#05070d', headerBg: 'rgba(10,16,28,0.72)', panel: 'rgba(13,22,38,0.62)', panelSoft: 'rgba(20,32,52,0.55)',
    input: 'rgba(22,35,58,0.72)', border: 'rgba(125,211,252,0.28)', borderSoft: 'rgba(125,211,252,0.16)',
    text: '#f0f9ff', muted: '#93a9c4',
    bodyBackground: 'radial-gradient(ellipse at 20% -5%, rgba(125,211,252,0.25), transparent 40%), radial-gradient(ellipse at 80% 10%, rgba(167,139,250,0.18), transparent 40%), radial-gradient(ellipse at 50% 110%, rgba(56,189,248,0.15), transparent 55%), linear-gradient(160deg, #05070d 0%, #0a1222 50%, #05070d 100%)',
    effect: 'mirror',
  },
  matrix: {
    id: 'matrix', label: ['Matrix Code', 'Code Matrix', 'مصفوفة الشيفرة'],
    accent: '#22ff66', accentDark: '#16cc4d', accentLight: '#66ff99',
    bg: '#020503', headerBg: 'rgba(2,12,5,0.85)', panel: 'rgba(3,14,6,0.88)', panelSoft: 'rgba(4,20,8,0.85)',
    input: 'rgba(3,20,8,0.9)', border: 'rgba(34,255,102,0.30)', borderSoft: 'rgba(34,255,102,0.16)',
    text: '#d6ffe0', muted: '#5f9c70',
    bodyBackground: 'radial-gradient(circle at 50% 0%, rgba(34,255,102,0.10), transparent 45%), #020503',
    effect: 'matrix',
  },
  playstation: {
    id: 'playstation', label: ['PlayStation Neon', 'PlayStation Néon', 'بلايستيشن نيون'],
    accent: '#33aaff', accentDark: '#0072ce', accentLight: '#7dc4ff',
    bg: '#04060f', headerBg: 'rgba(6,10,24,0.78)', panel: 'rgba(9,15,34,0.66)', panelSoft: 'rgba(14,24,48,0.60)',
    input: 'rgba(16,26,52,0.75)', border: 'rgba(51,170,255,0.30)', borderSoft: 'rgba(51,170,255,0.16)',
    text: '#ecf4ff', muted: '#8ea6cc',
    bodyBackground: 'radial-gradient(ellipse at 15% 0%, rgba(0,114,206,0.35), transparent 42%), radial-gradient(ellipse at 85% 12%, rgba(255,77,141,0.14), transparent 40%), radial-gradient(ellipse at 50% 115%, rgba(0,114,206,0.18), transparent 55%), linear-gradient(165deg, #04060f 0%, #070c1e 55%, #04060f 100%)',
    effect: 'playstation',
  },
  xbox: {
    id: 'xbox', label: ['Xbox Pulse', 'Xbox Pulse', 'إكس بوكس نبض'],
    accent: '#5dc21e', accentDark: '#3d990f', accentLight: '#9dff57',
    bg: '#030c04', headerBg: 'rgba(4,16,6,0.80)', panel: 'rgba(5,20,8,0.68)', panelSoft: 'rgba(8,28,11,0.62)',
    input: 'rgba(8,30,12,0.78)', border: 'rgba(93,194,30,0.32)', borderSoft: 'rgba(93,194,30,0.16)',
    text: '#eafbe0', muted: '#8fb883',
    bodyBackground: 'radial-gradient(ellipse at 50% -5%, rgba(93,194,30,0.28), transparent 45%), radial-gradient(ellipse at 85% 20%, rgba(93,194,30,0.12), transparent 40%), radial-gradient(ellipse at 50% 115%, rgba(16,124,16,0.20), transparent 55%), linear-gradient(165deg, #030c04 0%, #051708 55%, #030c04 100%)',
    effect: 'xbox',
  },
  versus: {
    id: 'versus', label: ['Versus Arena', 'Arène Versus', 'ساحة المواجهة'],
    accent: '#c4b5fd', accentDark: '#8b5cf6', accentLight: '#ddd0ff',
    bg: '#060610', headerBg: 'rgba(8,8,22,0.78)', panel: 'rgba(11,11,30,0.66)', panelSoft: 'rgba(17,17,42,0.60)',
    input: 'rgba(19,19,46,0.75)', border: 'rgba(160,140,255,0.30)', borderSoft: 'rgba(160,140,255,0.16)',
    text: '#f0edff', muted: '#9d95c9',
    bodyBackground: 'radial-gradient(ellipse at 8% 5%, rgba(0,114,206,0.30), transparent 40%), radial-gradient(ellipse at 92% 5%, rgba(93,194,30,0.24), transparent 40%), radial-gradient(ellipse at 50% 115%, rgba(139,92,246,0.16), transparent 55%), linear-gradient(165deg, #060610 0%, #0a0a1c 55%, #060610 100%)',
    effect: 'versus',
  },

  // ---------------- Max-life variants (denser, faster, brighter) ----------------
  playstation_pro: {
    id: 'playstation_pro', label: ['PlayStation Pro', 'PlayStation Pro', 'بلايستيشن برو'],
    accent: '#4db8ff', accentDark: '#0a84ff', accentLight: '#b5e4ff',
    bg: '#02040e', headerBg: 'rgba(4,8,26,0.80)', panel: 'rgba(7,13,36,0.68)', panelSoft: 'rgba(12,22,54,0.62)',
    input: 'rgba(14,26,58,0.78)', border: 'rgba(77,184,255,0.34)', borderSoft: 'rgba(77,184,255,0.18)',
    text: '#eef6ff', muted: '#8faede',
    bodyBackground: 'radial-gradient(ellipse at 12% -5%, rgba(10,132,255,0.42), transparent 44%), radial-gradient(ellipse at 88% 8%, rgba(255,77,141,0.20), transparent 42%), radial-gradient(ellipse at 50% 118%, rgba(77,184,255,0.22), transparent 56%), linear-gradient(165deg, #02040e 0%, #060b22 55%, #02040e 100%)',
    effect: 'ps_pro',
  },
  xbox_elite: {
    id: 'xbox_elite', label: ['Xbox Elite', 'Xbox Élite', 'إكس بوكس إيليت'],
    accent: '#a4ff3f', accentDark: '#4fae0a', accentLight: '#d6ff8f',
    bg: '#020d03', headerBg: 'rgba(3,18,5,0.82)', panel: 'rgba(4,22,7,0.70)', panelSoft: 'rgba(7,32,10,0.64)',
    input: 'rgba(7,34,11,0.80)', border: 'rgba(164,255,63,0.34)', borderSoft: 'rgba(164,255,63,0.18)',
    text: '#eefbe2', muted: '#93c47d',
    bodyBackground: 'radial-gradient(ellipse at 50% -8%, rgba(164,255,63,0.34), transparent 46%), radial-gradient(ellipse at 88% 22%, rgba(79,174,10,0.16), transparent 42%), radial-gradient(ellipse at 50% 118%, rgba(16,124,16,0.26), transparent 56%), linear-gradient(165deg, #020d03 0%, #051a08 55%, #020d03 100%)',
    effect: 'xb_elite',
  },
  versus_ultra: {
    id: 'versus_ultra', label: ['Versus Ultra', 'Versus Ultra', 'المواجهة القصوى'],
    accent: '#e0ccff', accentDark: '#7c3aed', accentLight: '#f2e9ff',
    bg: '#050512', headerBg: 'rgba(7,7,26,0.80)', panel: 'rgba(10,10,34,0.68)', panelSoft: 'rgba(16,16,48,0.62)',
    input: 'rgba(18,18,52,0.78)', border: 'rgba(200,170,255,0.34)', borderSoft: 'rgba(200,170,255,0.18)',
    text: '#f2efff', muted: '#a49bd6',
    bodyBackground: 'radial-gradient(ellipse at 6% 2%, rgba(10,132,255,0.36), transparent 42%), radial-gradient(ellipse at 94% 2%, rgba(164,255,63,0.28), transparent 42%), radial-gradient(ellipse at 50% 118%, rgba(124,58,237,0.24), transparent 56%), linear-gradient(165deg, #050512 0%, #0b0b22 55%, #050512 100%)',
    effect: 'versus_ultra',
  },
};

/** Simple = calm static skins. */
export const simpleThemeOrder: AppThemeId[] = ['crimson', 'rose', 'ember', 'royal', 'forest', 'abyss'];
/** Effect = living animated backgrounds. */
export const effectThemeOrder: AppThemeId[] = [
  'mirror', 'matrix',
  'playstation', 'xbox', 'versus',
  'playstation_pro', 'xbox_elite', 'versus_ultra',
];
/** All valid ids (midnight kept for old installs, not shown in the picker). */
export const themeOrder: AppThemeId[] = ['midnight', ...simpleThemeOrder, ...effectThemeOrder];

/** Button colors — playable on top of EVERY theme. */
export const buttonAccents: Record<string, { accent: string; accentDark: string; accentLight: string }> = {
  emerald: { accent: '#20d26c', accentDark: '#20c96b', accentLight: '#2ae17b' },
  ocean: { accent: '#08b5ee', accentDark: '#08a6d8', accentLight: '#22c5ff' },
  sunset: { accent: '#ff8c42', accentDark: '#ff7a28', accentLight: '#ffa055' },
  crimson: { accent: '#ff4650', accentDark: '#e63a44', accentLight: '#ff6670' },
  gold: { accent: '#ffb13b', accentDark: '#f59e0b', accentLight: '#ffc457' },
  violet: { accent: '#a78bfa', accentDark: '#8b6ff0', accentLight: '#b89dff' },
};

export function isAppThemeId(v: string | null | undefined): v is AppThemeId {
  return !!v && (themeOrder as string[]).includes(v);
}

export function resolveTheme(theme: string | null | undefined, themeColor: string | null | undefined): AppTheme {
  const base = (theme && appThemes[theme as AppThemeId]) ?? appThemes.midnight;
  const acc = (themeColor && buttonAccents[themeColor]) ?? null;
  if (!acc) return base;
  return { ...base, accent: acc.accent, accentDark: acc.accentDark, accentLight: acc.accentLight };
}

export function themeLabel(id: AppThemeId, lang: 'en' | 'fr' | 'ar'): string {
  const t = appThemes[id];
  if (lang === 'fr') return t.label[1];
  if (lang === 'ar') return t.label[2];
  return t.label[0];
}

// ---------------------------------------------------------------------------
// Background effects (single manager — only one runs at a time)
// ---------------------------------------------------------------------------

let fxEl: HTMLElement | null = null;
let fxRaf = 0;
let fxResize: (() => void) | null = null;

function stopFx() {
  cancelAnimationFrame(fxRaf);
  fxRaf = 0;
  if (fxResize) { window.removeEventListener('resize', fxResize); fxResize = null; }
  if (fxEl) { fxEl.remove(); fxEl = null; }
}

function makeCanvas(opacity = 0.62): HTMLCanvasElement | null {
  stopFx();
  const canvas = document.createElement('canvas');
  canvas.id = 'theme-fx';
  canvas.style.cssText = `position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;opacity:${opacity}`;
  document.body.prepend(canvas);
  fxEl = canvas;
  return canvas;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function startMatrix(accent: string) {
  const canvas = makeCanvas(0.6);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  fxResize = resize;
  window.addEventListener('resize', fxResize);
  const chars = 'アイカフェ01OGOLEMÄX0123456789$#*+=';
  const font = 15;
  let cols = Math.floor(canvas.width / font);
  let drops = Array.from({ length: cols }, () => Math.floor(Math.random() * (canvas.height / font)));
  const draw = () => {
    ctx.fillStyle = 'rgba(2,5,3,0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.font = `${font}px monospace`;
    for (let i = 0; i < drops.length; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * font, drops[i] * font);
      if (drops[i] * font > canvas.height && Math.random() > 0.976) drops[i] = 0;
      drops[i]++;
    }
    if (cols !== Math.floor(canvas.width / font)) {
      cols = Math.floor(canvas.width / font);
      drops = Array.from({ length: cols }, () => 0);
    }
    fxRaf = requestAnimationFrame(draw);
  };
  draw();
}

function startMirror() {
  stopFx();
  const el = document.createElement('div');
  el.id = 'theme-fx';
  el.style.cssText = 'position:fixed;inset:-20%;z-index:0;pointer-events:none;background:conic-gradient(from 0deg at 50% 40%, transparent 0deg, rgba(125,211,252,0.10) 40deg, transparent 80deg, rgba(167,139,250,0.08) 140deg, transparent 190deg, rgba(56,189,248,0.10) 250deg, transparent 300deg, rgba(125,211,252,0.06) 360deg);filter:blur(30px);animation:mirror-spin 26s linear infinite';
  document.body.prepend(el);
  fxEl = el;
}

type DriftKind = 'tri' | 'circle' | 'cross' | 'square' | 'letter' | 'dot' | 'halo';
type DriftMode = 'ps' | 'xb' | 'versus' | 'ps_pro' | 'xb_elite' | 'versus_ultra';
type Drift = {
  x: number; y: number; vx: number;
  size: number; speed: number; sway: number; phase: number; pulseSpeed: number;
  rot: number; rotSpeed: number; kind: DriftKind; color: string; baseAlpha: number; text?: string;
};

const PS_COLORS = ['#33aaff', '#7dc4ff', '#ff4d8d', '#7dffd4', '#cfe8ff'];
const PS_PRO_COLORS = ['#4db8ff', '#b5e4ff', '#ff6fa5', '#8affde', '#e6f4ff', '#0a84ff'];
const XB_COLORS = ['#9dff57', '#5dc21e', '#d4ffcc', '#3d990f'];
const XB_ELITE_COLORS = ['#d6ff8f', '#a4ff3f', '#5dc21e', '#eaffd0', '#2f7a08'];
const ULTRA_PS = ['#4db8ff', '#b5e4ff', '#ff6fa5'];
const ULTRA_XB = ['#d6ff8f', '#a4ff3f', '#5dc21e'];

function spawnDrift(i: number, w: number, h: number, mode: DriftMode): Drift {
  const rnd = Math.random;
  const ultra = mode === 'ps_pro' || mode === 'xb_elite' || mode === 'versus_ultra';
  const versus = mode === 'versus' || mode === 'versus_ultra';
  const side: 'ps' | 'xb' = versus
    ? (i % 2 === 0 ? 'ps' : 'xb')
    : (mode === 'ps' || mode === 'ps_pro' ? 'ps' : 'xb');

  let x = rnd() * w;
  if (versus) x = side === 'ps' ? rnd() * w * 0.48 : w * 0.52 + rnd() * w * 0.48;

  const sizeBase = ultra ? 16 : 13;
  const sizeVar = ultra ? 30 : 24;
  const speedBase = ultra ? 0.28 : 0.15;
  const speedVar = ultra ? 0.65 : 0.45;

  if (side === 'ps') {
    const kinds: DriftKind[] = ultra
      ? ['tri', 'circle', 'cross', 'square', 'halo', 'tri', 'circle']
      : ['tri', 'circle', 'cross', 'square'];
    const palette = mode === 'ps_pro' ? PS_PRO_COLORS : versus && mode === 'versus_ultra' ? ULTRA_PS : PS_COLORS;
    return {
      x, y: rnd() * h,
      vx: (rnd() - 0.5) * (ultra ? 0.55 : 0.3),
      size: sizeBase + rnd() * sizeVar,
      speed: speedBase + rnd() * speedVar,
      sway: 12 + rnd() * (ultra ? 46 : 30),
      phase: rnd() * Math.PI * 2,
      pulseSpeed: 0.0012 + rnd() * 0.0028,
      rot: rnd() * Math.PI * 2, rotSpeed: (rnd() - 0.5) * (ultra ? 0.016 : 0.01),
      kind: kinds[Math.floor(rnd() * kinds.length)],
      color: palette[Math.floor(rnd() * palette.length)],
      baseAlpha: ultra ? 0.30 + rnd() * 0.38 : 0.22 + rnd() * 0.28,
    };
  }
  const letters = ['A', 'B', 'X', 'Y'];
  const palette = mode === 'xb_elite' ? XB_ELITE_COLORS : versus && mode === 'versus_ultra' ? ULTRA_XB : XB_COLORS;
  const kind: DriftKind = rnd() > 0.5 ? 'letter' : rnd() > 0.35 ? 'dot' : rnd() > 0.2 ? 'halo' : 'cross';
  return {
    x, y: rnd() * h,
    vx: (rnd() - 0.5) * (ultra ? 0.55 : 0.3),
    size: sizeBase + rnd() * (ultra ? 26 : 22),
    speed: speedBase + rnd() * speedVar,
    sway: 12 + rnd() * (ultra ? 46 : 30),
    phase: rnd() * Math.PI * 2,
    pulseSpeed: 0.0012 + rnd() * 0.0028,
    rot: rnd() * Math.PI * 2, rotSpeed: (rnd() - 0.5) * (ultra ? 0.018 : 0.012),
    kind, color: palette[Math.floor(rnd() * palette.length)],
    baseAlpha: ultra ? 0.30 + rnd() * 0.38 : 0.22 + rnd() * 0.28,
    text: letters[Math.floor(rnd() * letters.length)],
  };
}

function drawDrift(ctx: CanvasRenderingContext2D, d: Drift, t: number, glowMul: number) {
  // Breathing glow loop: 0..1 fades on and off while walking across the page.
  const pulse = 0.5 + 0.5 * Math.sin(t * d.pulseSpeed * 2.2 + d.phase);
  const alpha = d.baseAlpha * (0.4 + 0.6 * pulse);
  const x = d.x + Math.sin(t / 1500 + d.phase) * d.sway;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, d.y);
  ctx.rotate(d.rot);
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.shadowColor = d.color;
  ctx.shadowBlur = (10 + 26 * pulse) * glowMul;
  ctx.lineWidth = 2;
  const s = d.size * (1 + pulse * 0.08); // subtle grow with the glow
  if (d.kind === 'halo') {
    ctx.shadowBlur = 0;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6);
    g.addColorStop(0, d.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === 'tri') {
    ctx.beginPath();
    ctx.moveTo(0, -s / 1.4);
    ctx.lineTo(s / 1.4, s / 1.4);
    ctx.lineTo(-s / 1.4, s / 1.4);
    ctx.closePath();
    ctx.stroke();
  } else if (d.kind === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, s / 1.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (d.kind === 'square') {
    ctx.strokeRect(-s / 1.6, -s / 1.6, s / 0.8, s / 0.8);
  } else if (d.kind === 'cross') {
    ctx.beginPath();
    ctx.moveTo(-s / 1.4, 0); ctx.lineTo(s / 1.4, 0);
    ctx.moveTo(0, -s / 1.4); ctx.lineTo(0, s / 1.4);
    ctx.stroke();
  } else if (d.kind === 'letter') {
    ctx.rotate(-d.rot);
    ctx.font = `bold ${Math.round(s)}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 8 * glowMul;
    ctx.fillText(d.text ?? 'X', 0, 1);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.5, s / 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function startConsoleFx(mode: 'playstation' | 'xbox' | 'versus' | 'ps_pro' | 'xb_elite' | 'versus_ultra') {
  const canvas = makeCanvas(mode === 'ps_pro' || mode === 'xb_elite' || mode === 'versus_ultra' ? 0.7 : 0.62);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  const inner: DriftMode =
    mode === 'playstation' ? 'ps'
    : mode === 'xbox' ? 'xb'
    : mode === 'versus' ? 'versus'
    : mode === 'ps_pro' ? 'ps_pro'
    : mode === 'xb_elite' ? 'xb_elite' : 'versus_ultra';
  const ultra = inner === 'ps_pro' || inner === 'xb_elite' || inner === 'versus_ultra';
  const count = ultra ? 44 : 26;
  const glowMul = ultra ? 1.5 : 1;
  const speedMul = ultra ? 1.35 : 1;
  let parts: Drift[] = Array.from({ length: count }, (_, i) => spawnDrift(i, canvas.width, canvas.height, inner));
  const onResize = () => {
    resize();
    parts = Array.from({ length: count }, (_, i) => spawnDrift(i, canvas.width, canvas.height, inner));
  };
  fxResize = onResize;
  window.addEventListener('resize', fxResize);

  const step = (t: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.55;

    // Versus beam (stronger + shimmering on ultra).
    if (inner === 'versus' || inner === 'versus_ultra') {
      const shimmer = inner === 'versus_ultra' ? 0.14 + 0.10 * Math.sin(t / 900) : 0.16;
      const g = ctx.createLinearGradient(cx - 70, 0, cx + 70, 0);
      g.addColorStop(0, 'rgba(0,114,206,0)');
      g.addColorStop(0.5, `rgba(160,140,255,${shimmer})`);
      g.addColorStop(1, 'rgba(93,194,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 70, 0, 140, canvas.height);
      if (inner === 'versus_ultra') {
        // Expanding pulse rings looping from the center.
        for (let k = 0; k < 3; k++) {
          const ph = ((t / 2600) + k / 3) % 1;
          const r = 30 + ph * 260;
          ctx.save();
          ctx.globalAlpha = (1 - ph) * 0.35;
          ctx.strokeStyle = k % 2 ? '#a4ff3f' : '#4db8ff';
          ctx.shadowColor = ctx.strokeStyle as string;
          ctx.shadowBlur = 22;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Sweeping shine beam looping across Pro / Elite (logo-shine feel for the whole bg).
    if (inner === 'ps_pro' || inner === 'xb_elite') {
      const span = canvas.width + 500;
      const bx = ((t / 14) % span) - 250;
      const beamColor = inner === 'ps_pro' ? '77,184,255' : '164,255,63';
      const g = ctx.createLinearGradient(bx - 140, 0, bx + 140, 0);
      g.addColorStop(0, `rgba(${beamColor},0)`);
      g.addColorStop(0.5, `rgba(${beamColor},0.10)`);
      g.addColorStop(1, `rgba(${beamColor},0)`);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.35);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = g;
      ctx.fillRect(bx - 140, -100, 280, canvas.height + 200);
      ctx.restore();
    }

    for (const d of parts) {
      drawDrift(ctx, d, t, glowMul);
      d.y -= d.speed * speedMul;
      d.x += d.vx * speedMul;
      d.rot += d.rotSpeed;
      // Seamless loop: wrap on every edge so shapes walk through the page forever.
      if (d.y < -70) { d.y = canvas.height + 60; d.x = Math.random() * canvas.width; }
      if (d.y > canvas.height + 70) { d.y = -60; d.x = Math.random() * canvas.width; }
      if (d.x < -90) d.x = canvas.width + 80;
      if (d.x > canvas.width + 90) d.x = -80;
    }
    if (!reducedMotion()) fxRaf = requestAnimationFrame(step);
  };
  if (reducedMotion()) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const d of parts) drawDrift(ctx, d, 0, glowMul);
  } else {
    fxRaf = requestAnimationFrame(step);
  }
}

// Magnetic buttons: nearby buttons gently grow + glow (cleared when the cursor leaves).
let magneticInstalled = false;
function installMagneticButtons() {
  if (magneticInstalled) return;
  magneticInstalled = true;
  let raf = 0;
  let mx = -9999;
  let my = -9999;
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const els = document.querySelectorAll('.btn');
      els.forEach((node) => {
        const h = node as HTMLElement;
        const r = h.getBoundingClientRect();
        if (r.width === 0) return;
        const dx = mx - (r.left + r.width / 2);
        const dy = my - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          const f = 1 - dist / 150;
          h.style.transform = `translateY(-2px) scale(${(1 + f * 0.07).toFixed(3)})`;
          h.style.boxShadow = `0 0 ${Math.round(10 + f * 24)}px var(--accent), 0 ${Math.round(10 + f * 10)}px ${Math.round(22 + f * 16)}px -12px var(--accent)`;
          h.style.zIndex = '2';
        } else if (h.style.transform) {
          h.style.transform = '';
          h.style.boxShadow = '';
          h.style.zIndex = '';
        }
      });
    });
  }, { passive: true });
  document.addEventListener('mouseleave', () => {
    document.querySelectorAll('.btn').forEach((node) => {
      const h = node as HTMLElement;
      h.style.transform = ''; h.style.boxShadow = ''; h.style.zIndex = '';
    });
  });
}

export function applyAppTheme(theme: AppTheme) {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set('--accent', theme.accent);
  set('--accent-dark', theme.accentDark);
  set('--accent-light', theme.accentLight);
  set('--accent-ring', theme.accent);
  set('--bg', theme.bg);
  set('--header', theme.headerBg);
  set('--panel', theme.panel);
  set('--panel-soft', theme.panelSoft);
  set('--input', theme.input);
  set('--line', theme.border);
  set('--line-soft', theme.borderSoft);
  set('--ink', theme.text);
  set('--muted', theme.muted);
  document.body.style.background = theme.bodyBackground;
  document.body.style.backgroundAttachment = 'fixed';
  document.body.style.color = theme.text;
  document.body.dataset.theme = theme.id;
  installMagneticButtons();
  stopFx();
  if (theme.effect === 'matrix') startMatrix(theme.accent);
  else if (theme.effect === 'mirror') startMirror();
  else if (theme.effect === 'playstation') startConsoleFx('playstation');
  else if (theme.effect === 'xbox') startConsoleFx('xbox');
  else if (theme.effect === 'versus') startConsoleFx('versus');
  else if (theme.effect === 'ps_pro') startConsoleFx('ps_pro');
  else if (theme.effect === 'xb_elite') startConsoleFx('xb_elite');
  else if (theme.effect === 'versus_ultra') startConsoleFx('versus_ultra');
}
