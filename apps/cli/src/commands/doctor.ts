import { ExitCode, runDoctor } from '@recall-ai/core';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';

export async function doctorCommand(reporter: Reporter, global: GlobalOptions): Promise<number> {
  const result = await runDoctor(global.path);

  if (global.json) {
    reporter.json(result);
  } else {
    for (const check of result.checks) {
      const badge =
        check.status === 'pass'
          ? reporter.colors.green('PASS')
          : check.status === 'warn'
            ? reporter.colors.yellow('WARN')
            : reporter.colors.red('FAIL');
      reporter.stdout(`[${badge}] ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
    }
    reporter.stdout('');
    reporter.stdout(`Overall: ${result.overallStatus}`);
  }

  return result.overallStatus === 'fail' ? ExitCode.InvalidState : ExitCode.Success;
}
