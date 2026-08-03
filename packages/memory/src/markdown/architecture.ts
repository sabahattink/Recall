import type { RepositorySnapshot } from '@recall-ai/schemas';
import { bulletList, defaultTemplate, evidenceList } from './template.js';

export function architectureTemplate(): (section: string) => string {
  return defaultTemplate(
    'Architecture',
    'Detected and inferred structure of this repository, maintained automatically by `recall scan`/`recall update`.',
    'Add architectural context Recall cannot infer: why boundaries exist, planned changes, or exceptions to the detected structure. This section is never modified by Recall.',
  );
}

export function generateArchitectureBody(snapshot: RepositorySnapshot): string {
  const apps = snapshot.workspaces.filter((w) => w.kind === 'app');
  const services = snapshot.workspaces.filter((w) => w.kind === 'service');
  const packages = snapshot.workspaces.filter((w) => w.kind === 'package' || w.kind === 'library');

  const sections: string[] = [];

  sections.push('### Detected facts\n');
  sections.push(
    `- Package manager: **${snapshot.ecosystem.packageManager}**${snapshot.ecosystem.isMonorepo ? ' (monorepo)' : ''}`,
  );

  if (snapshot.ecosystem.isMonorepo) {
    sections.push(
      `- Workspace globs: ${snapshot.ecosystem.workspaceGlobs.map((g) => `\`${g}\``).join(', ')}`,
    );
  }

  sections.push('\n**Applications:**\n');
  sections.push(bulletList(apps.map((w) => `\`${w.path}\` (${w.name})`)));

  if (services.length > 0) {
    sections.push('\n**Services:**\n');
    sections.push(bulletList(services.map((w) => `\`${w.path}\` (${w.name})`)));
  }

  sections.push('\n**Packages/libraries:**\n');
  sections.push(bulletList(packages.map((w) => `\`${w.path}\` (${w.name})`)));

  sections.push('\n**Entry points:**\n');
  sections.push(
    bulletList(
      snapshot.entryPoints.map((e) => {
        const ev = evidenceList(e.evidence);
        return `\`${e.path}\` (${e.kind})${ev ? `\n${ev}` : ''}`;
      }),
    ),
  );

  const workspaceEdges = snapshot.internalEdges.filter((e) => e.kind === 'workspace');
  sections.push('\n**Internal dependency direction (workspace-level):**\n');
  sections.push(bulletList(workspaceEdges.map((e) => `\`${e.from}\` → \`${e.to}\``)));

  sections.push('\n**Frameworks detected:**\n');
  sections.push(
    bulletList(
      snapshot.frameworks.map(
        (f) =>
          `${f.name}${f.workspace ? ` (\`${f.workspace}\`)` : ''} — confidence: ${f.confidence}`,
      ),
    ),
  );

  if (snapshot.docker.detected || snapshot.ci.detected) {
    sections.push('\n**Infrastructure boundaries:**\n');
    const infra: string[] = [];
    if (snapshot.docker.detected)
      infra.push(`Docker configuration: ${snapshot.docker.files.join(', ')}`);
    if (snapshot.ci.detected) infra.push(`CI providers: ${snapshot.ci.providers.join(', ')}`);
    sections.push(bulletList(infra));
  }

  sections.push('\n### Inferred structure\n');
  sections.push(
    '_The following is a best-effort interpretation based on directory conventions and is not guaranteed to be complete or intentional._\n',
  );
  sections.push(
    bulletList(
      apps.map(
        (app) =>
          `\`${app.path}\` appears to be an application entry surface based on its location under a top-level "apps" directory.`,
      ),
    ),
  );

  return sections.join('\n');
}
