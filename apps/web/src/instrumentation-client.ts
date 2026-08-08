import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://cbae93bff105fae683f0204b92b4a5c1@o4511874040070144.ingest.de.sentry.io/4511874046165072',

  integrations: [Sentry.replayIntegration()],

  // Capture a representative performance sample without recording every request.
  tracesSampleRate: 0.1,

  enableLogs: true,

  // Record 1% of normal sessions, but always capture sessions containing errors.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Recall does not need personal user information or request bodies in Sentry.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
