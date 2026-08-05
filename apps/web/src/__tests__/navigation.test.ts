import { describe, expect, it } from 'vitest';
import { mainNav, footerNav, type NavItem } from '../config/navigation';

const INTERNAL_ROUTES = new Set(['/docs', '/examples', '/changelog', '/roadmap']);

function assertValidRoute(item: NavItem) {
  if (item.external) {
    expect(item.href.startsWith('https://')).toBe(true);
  } else {
    expect(item.href.startsWith('/')).toBe(true);
    expect(INTERNAL_ROUTES.has(item.href) || item.href === '/').toBe(true);
  }
}

describe('navigation', () => {
  it('every mainNav item is a valid internal route or an https external link', () => {
    expect(mainNav.length).toBeGreaterThan(0);
    mainNav.forEach(assertValidRoute);
  });

  it('every footerNav item is a valid internal route or an https external link', () => {
    expect(footerNav.length).toBeGreaterThan(0);
    footerNav.forEach(assertValidRoute);
  });

  it('includes the required top-level sections in the header', () => {
    const labels = mainNav.map((item) => item.label);
    expect(labels).toEqual(['Docs', 'Examples', 'Changelog', 'Roadmap', 'GitHub']);
  });

  it('has no duplicate hrefs within either nav list', () => {
    for (const nav of [mainNav, footerNav]) {
      const hrefs = nav.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});
