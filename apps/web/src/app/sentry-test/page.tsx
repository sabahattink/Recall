'use client';

import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
    return (
        <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 py-24">
            <button
                type="button"
                className="rounded-md border px-4 py-2"
                onClick={() => {
                    const error = new Error('Recall production Sentry verification');
                    Sentry.captureException(error);
                    throw error;
                }}
            >
                Trigger Sentry test
            </button>
        </main>
    );
}