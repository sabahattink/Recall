import { createColorizer, type Colorizer } from './colors.js';
import type { GlobalOptions } from './global-options.js';

/**
 * Centralizes stdout/stderr discipline: stdout carries successful command
 * output only (human text or a single JSON document); stderr carries
 * diagnostics, warnings, and errors. This keeps `--json` output parseable by
 * downstream tools even when Recall also wants to warn about something.
 */
export class Reporter {
  readonly colors: Colorizer;

  constructor(private readonly options: GlobalOptions) {
    this.colors = createColorizer(options.color && process.stdout.isTTY === true);
  }

  /** Successful, user-requested output. Suppressed by --quiet only for non-essential variants. */
  stdout(text: string): void {
    process.stdout.write(`${text}\n`);
  }

  json(data: unknown): void {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  }

  /** Informational text, skipped under --quiet and never emitted in --json mode. */
  info(text: string): void {
    if (this.options.quiet || this.options.json) return;
    process.stdout.write(`${text}\n`);
  }

  warn(text: string): void {
    if (this.options.json) return;
    process.stderr.write(`${this.colors.yellow('warning:')} ${text}\n`);
  }

  error(text: string): void {
    process.stderr.write(`${this.colors.red('error:')} ${text}\n`);
  }

  /** A single transient status line, shown only in interactive terminals. */
  progress(text: string): void {
    if (this.options.json || this.options.quiet || !process.stderr.isTTY) return;
    process.stderr.write(`${this.colors.gray(text)}\n`);
  }
}
