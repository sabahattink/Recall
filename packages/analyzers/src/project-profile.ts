import type {
  EcosystemMetadata,
  EntryPoint,
  FrameworkDetection,
  ProjectProfile,
} from '@recall-ai/schemas';

const WEB_APP_FRAMEWORKS = new Set(['nextjs', 'react', 'vue']);
const API_SERVICE_FRAMEWORKS = new Set(['nestjs', 'express', 'fastify']);

/**
 * Derives a single-sentence "what kind of project is this" summary from
 * evidence already collected elsewhere in the scan: whether TypeScript is
 * used, whether any workspace declares a `bin` entry, whether the
 * repository has multiple workspaces, and which frameworks were detected.
 *
 * `applicationType` is deliberately a separate axis from `frameworks` — CLI
 * and library are about how the project is *consumed*, not a framework, and
 * a project can be e.g. both an Express API and a CLI. Real framework
 * detection (NestJS, Next.js, Express, ...) is preserved as-is in
 * `frameworks`; this never substitutes for it.
 */
export function detectProjectProfile(
  ecosystem: EcosystemMetadata,
  entryPoints: EntryPoint[],
  frameworks: FrameworkDetection[],
): ProjectProfile {
  const frameworkNames = [...new Set(frameworks.map((f) => f.name))].filter(
    (name) => name !== 'generic-node',
  );

  const applicationType = entryPoints.some((e) => e.kind === 'bin')
    ? 'cli'
    : frameworkNames.some((name) => WEB_APP_FRAMEWORKS.has(name))
      ? 'web-app'
      : frameworkNames.some((name) => API_SERVICE_FRAMEWORKS.has(name))
        ? 'api-service'
        : frameworkNames.length > 0
          ? 'unknown'
          : 'library';

  return {
    language: ecosystem.hasTypescript ? 'TypeScript' : 'JavaScript',
    applicationType,
    repositoryType: ecosystem.isMonorepo ? 'monorepo' : 'single-package',
    frameworks: frameworkNames,
  };
}

/** Human-readable one-line summary, e.g. "TypeScript CLI monorepo". */
export function formatProjectProfile(profile: ProjectProfile): string {
  const parts: string[] = [profile.language];

  const applicationLabel: Record<ProjectProfile['applicationType'], string | null> = {
    cli: 'CLI',
    'web-app': 'web app',
    'api-service': 'API service',
    library: 'library',
    unknown: null,
  };
  const label = applicationLabel[profile.applicationType];
  if (label) parts.push(label);

  if (profile.repositoryType === 'monorepo') parts.push('monorepo');

  return parts.join(' ');
}
