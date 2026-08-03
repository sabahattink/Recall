export interface GlobalOptions {
  path: string;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
}

/** Raw options as cac parses them (kebab-case flags become camelCase, `--no-x` becomes `x: false`). */
export interface RawCacOptions {
  path?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
}

export function resolveGlobalOptions(raw: RawCacOptions): GlobalOptions {
  return {
    path: raw.path ?? '.',
    json: Boolean(raw.json),
    quiet: Boolean(raw.quiet),
    verbose: Boolean(raw.verbose),
    color: raw.color !== false,
  };
}
