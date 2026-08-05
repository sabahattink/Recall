import { loader } from 'fumadocs-core/source';
import { docs } from '../../.source/server';

/** Fumadocs' page/tree source, built from `content/docs/**` at build/dev time. */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
