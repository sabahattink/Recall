import { describe, expect, it } from 'vitest';
import { siteMetadata } from '../lib/metadata';
import { siteConfig } from '../config/site';

describe('siteMetadata', () => {
  it('sets metadataBase to the canonical production URL', () => {
    expect(siteMetadata.metadataBase?.toString()).toBe(`${siteConfig.url}/`);
  });

  it('defines a title template that appends the site name', () => {
    const title = siteMetadata.title;
    if (typeof title === 'object' && title && 'template' in title && 'default' in title) {
      expect(title.template).toBe(`%s — ${siteConfig.name}`);
      expect(title.default).toBe(siteConfig.title);
    } else {
      throw new Error('expected metadata.title to be a default+template object');
    }
  });

  it('sets the canonical alternate URL', () => {
    expect(siteMetadata.alternates?.canonical).toBe(siteConfig.url);
  });

  it('sets Open Graph and Twitter card metadata from the same description', () => {
    expect(siteMetadata.openGraph?.description).toBe(siteConfig.description);
    expect(siteMetadata.twitter?.description).toBe(siteConfig.description);
  });
});
