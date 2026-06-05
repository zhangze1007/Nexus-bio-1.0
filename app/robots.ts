import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/tools/'],
      },
    ],
    sitemap: 'https://nexus-bio-1-0.vercel.app/sitemap.xml',
  };
}
