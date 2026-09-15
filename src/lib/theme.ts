export type ThemeColor = 'emerald' | 'ocean' | 'sunset' | 'crimson' | 'gold' | 'violet';

export const themeColors: Record<ThemeColor, { accent: string; accentDark: string; accentLight: string; accentBg: string; accentBgDark: string; label: string }> = {
  emerald: { accent: '#20d26c', accentDark: '#20c96b', accentLight: '#2ae17b', accentBg: '#102b21', accentBgDark: '#062d22', label: 'emerald' },
  ocean:   { accent: '#08b5ee', accentDark: '#08a6d8', accentLight: '#22c5ff', accentBg: '#0c1828', accentBgDark: '#0a1520', label: 'ocean' },
  sunset:  { accent: '#ff8c42', accentDark: '#ff7a28', accentLight: '#ffa055', accentBg: '#2a1a0e', accentBgDark: '#1f1308', label: 'sunset' },
  crimson: { accent: '#ff4650', accentDark: '#e63a44', accentLight: '#ff6670', accentBg: '#2a0f12', accentBgDark: '#1f0b0e', label: 'crimson' },
  gold:    { accent: '#ffb13b', accentDark: '#f59e0b', accentLight: '#ffc457', accentBg: '#2a1f0e', accentBgDark: '#1f1608', label: 'gold' },
  violet:  { accent: '#a78bfa', accentDark: '#8b6ff0', accentLight: '#b89dff', accentBg: '#1a1230', accentBgDark: '#140e24', label: 'violet' },
};

export function applyThemeColor(color: string) {
  // Backward-compatible shim: full themes are handled by applyAppTheme in themes.ts.
  const tc = themeColors[color as ThemeColor] ?? themeColors.emerald;
  const root = document.documentElement;
  root.style.setProperty('--accent', tc.accent);
  root.style.setProperty('--accent-dark', tc.accentDark);
  root.style.setProperty('--accent-light', tc.accentLight);
  root.style.setProperty('--accent-bg', tc.accentBg);
  root.style.setProperty('--accent-bg-dark', tc.accentBgDark);
  root.style.setProperty('--accent-ring', tc.accent);
}

import { Gamepad2, Coffee, Zap, Dices, Target, Trophy, Crown, Swords } from 'lucide-react';
import type { ComponentType } from 'react';

export const appIcons: Record<string, { Icon: ComponentType<{ size?: number | string }>; label: string }> = {
  gamepad: { Icon: Gamepad2, label: 'Gamepad' },
  coffee:  { Icon: Coffee, label: 'Coffee' },
  zap:     { Icon: Zap, label: 'Lightning' },
  dices:   { Icon: Dices, label: 'Dice' },
  target:  { Icon: Target, label: 'Target' },
  trophy:  { Icon: Trophy, label: 'Trophy' },
  crown:   { Icon: Crown, label: 'Crown' },
  swords:  { Icon: Swords, label: 'Swords' },
};

export function getIconComponent(name: string): ComponentType<{ size?: number | string }> {
  return appIcons[name]?.Icon ?? Gamepad2;
}
