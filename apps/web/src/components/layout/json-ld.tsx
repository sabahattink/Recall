import { siteConfig } from '@/config/site';

/**
 * Structured data for the product itself. Every field here is a verifiable
 * fact about the project (name, description, license, source location) —
 * deliberately no ratings, pricing, download counts, or review data, since
 * none of that is something this site can honestly claim.
 */
export function JsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: siteConfig.name,
    description: siteConfig.description,
    codeRepository: siteConfig.githubUrl,
    programmingLanguage: 'TypeScript',
    license: 'https://opensource.org/licenses/MIT',
    author: {
      '@type': 'Person',
      name: siteConfig.author.name,
    },
  };

  return (
    // Static, developer-authored data only — never user input — so this is
    // a safe use of dangerouslySetInnerHTML.
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
