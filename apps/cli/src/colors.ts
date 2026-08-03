const CODES = {
  reset: '[0m',
  bold: '[1m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  cyan: '[36m',
  gray: '[90m',
};

export function createColorizer(enabled: boolean) {
  const wrap = (code: string) => (text: string) =>
    enabled ? `${code}${text}${CODES.reset}` : text;
  return {
    bold: wrap(CODES.bold),
    red: wrap(CODES.red),
    green: wrap(CODES.green),
    yellow: wrap(CODES.yellow),
    cyan: wrap(CODES.cyan),
    gray: wrap(CODES.gray),
  };
}

export type Colorizer = ReturnType<typeof createColorizer>;
