import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

const staticRoutes = ['/', '/docs', '/examples', '/changelog', '/roadmap'];

export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
  }));
}
