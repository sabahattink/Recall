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
  packageName: string;
  executableName: string;
}

export const siteConfig: SiteConfig = {
  name: 'Recall',
  title: 'Recall — persistent, evidence-backed context for AI coding agents',
  description:
    'Recall generates persistent, evidence-backed repository context for AI coding agents.',
  url: 'https://recall.sabahattinkalkan.com',
  githubUrl: 'https://github.com/sabahattink/Recall',
  npmUrl: 'https://www.npmjs.com/package/recall-context',
  author: {
    name: 'Sabahattin Kalkan',
  },
  packageName: 'recall-context',
  executableName: 'recall',
};
