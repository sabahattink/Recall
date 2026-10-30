/**
 * The single source of truth for product identity, URLs, and naming.
 * Components and metadata must read from here rather than repeating
 * literals — a domain, package name, or URL only ever changes in one place.
 */
export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  url: string;
  githubUrl: string;
  npmUrl: string;
  author: {
    name: string;
  };
  /** The npm package name. The npm name `recall` belongs to an unrelated package. */
  packageName: string;
  /** The executable the package installs. */
  executableName: string;
  /** The one public command (docs/product-specification.md §18), run through npx. */
  initCommand: string;
}

const packageName = 'recall-context';

export const siteConfig: SiteConfig = {
  name: 'Recall',
  title: 'Recall — initialize your repository’s memory for AI coding assistants',
  description:
    'One command gives every AI coding assistant an evidence-backed memory of your repository. Offline, deterministic, no account or API key.',
  url: 'https://recall.sabahattinkalkan.com',
  githubUrl: 'https://github.com/sabahattink/Recall',
  npmUrl: 'https://www.npmjs.com/package/recall-context',
  author: {
    name: 'Sabahattin Kalkan',
  },
  packageName,
  executableName: 'recall',
  initCommand: `npx ${packageName} init`,
};
