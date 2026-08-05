import { siteConfig } from './site';

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

/** Header navigation, in display order. Route validity is asserted in `src/__tests__/navigation.test.ts`. */
export const mainNav: NavItem[] = [
  { label: 'Docs', href: '/docs' },
  { label: 'Examples', href: '/examples' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'GitHub', href: siteConfig.githubUrl, external: true },
];

export const footerNav: NavItem[] = [
  { label: 'Docs', href: '/docs' },
  { label: 'Examples', href: '/examples' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'GitHub', href: siteConfig.githubUrl, external: true },
  { label: 'npm', href: siteConfig.npmUrl, external: true },
];
