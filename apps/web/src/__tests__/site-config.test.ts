import { describe, expect, it } from 'vitest';
import { siteConfig } from '../config/site';

describe('siteConfig', () => {
  it('has the expected product identity', () => {
    expect(siteConfig.name).toBe('Recall');
    expect(siteConfig.packageName).toBe('recall-context');
    expect(siteConfig.executableName).toBe('recall');
    expect(siteConfig.author.name).toBe('Sabahattin Kalkan');
  });

  it('uses the canonical production URL, with no trailing slash', () => {
    expect(siteConfig.url).toBe('https://recall.sabahattinkalkan.com');
    expect(siteConfig.url.endsWith('/')).toBe(false);
  });

  it('points at the correct GitHub and npm URLs', () => {
    expect(siteConfig.githubUrl).toBe('https://github.com/sabahattink/Recall');
    expect(siteConfig.npmUrl).toBe('https://www.npmjs.com/package/recall-context');
  });

  it('has a non-empty description that does not claim ratings, pricing, or user counts', () => {
    expect(siteConfig.description.length).toBeGreaterThan(0);
    const forbidden = /rating|pricing|price|users?\s+trust|downloads?/i;
    expect(siteConfig.description).not.toMatch(forbidden);
  });
});
