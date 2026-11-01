const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LEVELS)[number];

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function enabled(level: LogLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(currentLevel);
}

export const log = {
  debug(...args: unknown[]): void {
    if (enabled('debug')) console.debug('[cubicraft]', ...args);
  },
  info(...args: unknown[]): void {
    if (enabled('info')) console.info('[cubicraft]', ...args);
  },
  warn(...args: unknown[]): void {
    if (enabled('warn')) console.warn('[cubicraft]', ...args);
  },
  error(...args: unknown[]): void {
    if (enabled('error')) console.error('[cubicraft]', ...args);
  },
};
