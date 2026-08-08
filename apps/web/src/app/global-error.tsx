'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* App Router doesn't expose HTTP status codes for errors, so this
        renders Next's default error UI with a generic status. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
