import { writeTree, type FileTree } from '../write-tree.js';

export function nextRoutingVariantsTree(): FileTree {
  return {
    'package.json': JSON.stringify(
      {
        name: 'next-routing-variants',
        version: '1.0.0',
        private: true,
        dependencies: {
          next: '^15.0.0',
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
      },
      null,
      2,
    ),
    'app/page.tsx': 'export default function Home() { return null; }\n',
    'app/route.ts': 'export function GET() { return new Response("ok"); }\n',
    'src/app/changelog/page.tsx': 'export default function Changelog() { return null; }\n',
    'src/app/api/webhooks/route.ts': 'export function POST() { return new Response("ok"); }\n',
    'pages/index.tsx': 'export default function LegacyHome() { return null; }\n',
    'pages/about.tsx': 'export default function About() { return null; }\n',
    'src/pages/blog/[slug].tsx': 'export default function BlogPost() { return null; }\n',
    'src/pages/api/health.ts': 'export default function health() { return null; }\n',
    'pages/_app.tsx': 'export default function CustomApp() { return null; }\n',
  };
}

export async function buildNextRoutingVariantsFixture(root: string): Promise<void> {
  await writeTree(root, nextRoutingVariantsTree());
}

export function analysisNoiseTree(): FileTree {
  return {
    'package.json': JSON.stringify(
      {
        name: 'analysis-noise-fixture',
        version: '1.0.0',
        private: true,
      },
      null,
      2,
    ),
    'src/orders/order.controller.ts': 'export class OrderController {}\n',
    'src/orders/invoice-service.ts': 'export const invoiceService = true;\n',
    'src/reporting/invoice-report.ts': 'export const invoiceReport = true;\n',
    'src/orders/order.spec.ts': 'export {};\n',
    'fixtures/noisy/noise.controller.ts': 'export class NoiseController {}\n',
    '__fixtures__/legacy/legacy.controller.ts': 'export class LegacyController {}\n',
    '__mocks__/remote/remote.controller.ts': 'export class RemoteController {}\n',
    'examples/reference/reference.controller.ts': 'export class ReferenceController {}\n',
    'generated/cache/generated.controller.ts': 'export class GeneratedController {}\n',
    'vendor/copied/vendor.controller.ts': 'export class VendorController {}\n',
    'examples/reference/huge.ts': 'x'.repeat(110 * 1024),
  };
}

export async function buildAnalysisNoiseFixture(root: string): Promise<void> {
  await writeTree(root, analysisNoiseTree());
}
