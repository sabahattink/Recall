import { writeTree, type FileTree } from '../write-tree.js';

export function nextJsTree(): FileTree {
  return {
    'package.json': JSON.stringify(
      {
        name: 'nextjs-fixture',
        version: '1.0.0',
        private: true,
        description: 'A representative Next.js project used as a Recall test fixture.',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
        },
        dependencies: {
          next: '^15.0.0',
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
        devDependencies: {
          typescript: '^5.7.2',
          '@types/react': '^18.3.12',
        },
      },
      null,
      2,
    ),
    'next.config.js': 'module.exports = {\n  reactStrictMode: true,\n};\n',
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          jsx: 'preserve',
          paths: { '@/*': ['./src/*'] },
        },
      },
      null,
      2,
    ),
    '.gitignore': 'node_modules/\n.next/\n.env\n',
    'src/app/layout.tsx': [
      'export default function RootLayout({ children }: { children: React.ReactNode }) {',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'src/app/page.tsx': [
      "import { getFeaturedProducts } from '@/lib/products';",
      '',
      'export default async function HomePage() {',
      '  const products = await getFeaturedProducts();',
      '  return (',
      '    <main>',
      '      <h1>Featured products</h1>',
      '      <ul>',
      '        {products.map((product) => (',
      '          <li key={product.id}>{product.name}</li>',
      '        ))}',
      '      </ul>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'src/app/api/webhooks/route.ts': [
      "import { NextResponse } from 'next/server';",
      '',
      'export async function POST(request: Request) {',
      '  const payload = await request.json();',
      '  return NextResponse.json({ received: true, payload });',
      '}',
      '',
    ].join('\n'),
    'src/lib/products.ts': [
      'export interface Product {',
      '  id: string;',
      '  name: string;',
      '}',
      '',
      'export async function getFeaturedProducts(): Promise<Product[]> {',
      "  return [{ id: '1', name: 'Recall CLI license' }];",
      '}',
      '',
    ].join('\n'),
  };
}

export async function buildNextJsFixture(root: string): Promise<void> {
  await writeTree(root, nextJsTree());
}
