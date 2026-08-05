import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Static, in-process search index built from the docs source at request
// time — no external/paid search service, per this sprint's scope.
export const { GET } = createFromSource(source);
