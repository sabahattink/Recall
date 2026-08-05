import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { source } from '@/lib/source';

const staticRoutes = ['/', '/examples', '/changelog', '/roadmap'];

export default function sitemap(): MetadataRoute.Sitemap {
  const docRoutes = source.getPages().map((page) => page.url);

  return [...staticRoutes, ...docRoutes].map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
  }));
}
