import { describe, expect, it } from 'vitest';
import {
  GENERATED_END,
  GENERATED_START,
  upsertGeneratedSection,
  validateMarkers,
} from '../markers.js';

const template = (section: string) => `# Title\n\n${section}\n\n## Notes\n\nHuman notes go here.\n`;

describe('validateMarkers', () => {
  it('accepts content with no markers at all', () => {
    expect(validateMarkers('just some text').valid).toBe(true);
  });

  it('accepts exactly one well-ordered pair', () => {
    const content = `before\n${GENERATED_START}\nbody\n${GENERATED_END}\nafter`;
    expect(validateMarkers(content).valid).toBe(true);
  });

  it('rejects a start marker with no matching end marker', () => {
    const content = `${GENERATED_START}\nbody`;
    const result = validateMarkers(content);
    expect(result.valid).toBe(false);
  });

  it('rejects an end marker that precedes the start marker', () => {
    const content = `${GENERATED_END}\nbody\n${GENERATED_START}`;
    const result = validateMarkers(content);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicated marker pairs', () => {
    const content = `${GENERATED_START}\na\n${GENERATED_END}\n${GENERATED_START}\nb\n${GENERATED_END}`;
    expect(validateMarkers(content).valid).toBe(false);
  });
});

describe('upsertGeneratedSection', () => {
  it('scaffolds a new file using the template when none exists', () => {
    const { content, changed } = upsertGeneratedSection(null, 'generated body', template);
    expect(changed).toBe(true);
    expect(content).toContain('generated body');
    expect(content).toContain('Human notes go here.');
  });

  it('replaces only the content between markers, preserving human content', () => {
    const existing = [
      '# Title',
      '',
      GENERATED_START,
      'old generated body',
      GENERATED_END,
      '',
      '## Notes',
      '',
      'This is my hand-written note that must survive.',
      '',
    ].join('\n');

    const { content, changed } = upsertGeneratedSection(existing, 'new generated body', template);
    expect(changed).toBe(true);
    expect(content).toContain('new generated body');
    expect(content).not.toContain('old generated body');
    expect(content).toContain('This is my hand-written note that must survive.');
  });

  it('is a no-op when the generated body has not changed', () => {
    const existing = [GENERATED_START, 'same body', GENERATED_END].join('\n');
    const { changed } = upsertGeneratedSection(existing, 'same body', template);
    expect(changed).toBe(false);
  });

  it('prepends a generated section without touching content when markers are absent', () => {
    const existing = 'Entirely hand-written file with no markers.';
    const { content } = upsertGeneratedSection(existing, 'generated body', template);
    expect(content).toContain('Entirely hand-written file with no markers.');
    expect(content).toContain('generated body');
  });

  it('leaves malformed marker content untouched rather than guessing a fix', () => {
    const malformed = `${GENERATED_START}\nno end marker here`;
    const { content, changed } = upsertGeneratedSection(malformed, 'new body', template);
    expect(changed).toBe(false);
    expect(content).toBe(malformed);
  });
});
