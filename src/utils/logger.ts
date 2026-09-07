type Level = 'info' | 'success' | 'warn' | 'error' | 'step';

/**
 * Decide whether the current terminal can safely render the Unicode glyphs
 * used for the level icons. Legacy Windows consoles / raster fonts and any
 * non-TTY (piped) output fall back to plain-text markers. Set
 * NESTORA_ASCII=1 to force plain text.
 */
function canUseUnicode(): boolean {
  if (process.stdout.isTTY !== true) return false;
  if (process.env.NESTORA_ASCII === '1') return false;

  let depth = 1;
  try {
    depth = process.stdout.getColorDepth();
  } catch {
    depth = 1;
  }
  // Modern terminal with decent color support (256-color or better) is
  // a strong proxy for "can render ℹ ✔ ⚠ ✖ →".
  return depth >= 8;
}

const ICONS: Record<Level, string> = canUseUnicode()
  ? { info: 'ℹ', success: '✔', warn: '⚠', error: '✖', step: '→' }
  : { info: '[i]', success: '[+]', warn: '[!]', error: '[x]', step: '[>]' };

export function log(message: string, level: Level = 'info'): void {
  const icon = ICONS[level];
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(`${icon} ${message}\n`);
}

export const logger = {
  info: (m: string) => log(m, 'info'),
  success: (m: string) => log(m, 'success'),
  warn: (m: string) => log(m, 'warn'),
  error: (m: string) => log(m, 'error'),
  step: (m: string) => log(m, 'step'),
};
