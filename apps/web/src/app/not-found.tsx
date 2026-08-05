import Link from 'next/link';
import { Container } from '@/components/ui/container';

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-start justify-center gap-4 py-20">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
      >
        Back to home
      </Link>
    </Container>
  );
}
