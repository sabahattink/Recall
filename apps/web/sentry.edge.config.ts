import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://cbae93bff105fae683f0204b92b4a5c1@o4511874040070144.ingest.de.sentry.io/4511874046165072',

  tracesSampleRate: 0.1,

  enableLogs: true,

  // Recall does not need personal user information or request bodies in Sentry.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
