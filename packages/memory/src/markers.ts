export const GENERATED_START = '<!-- recall:generated:start -->';
export const GENERATED_END = '<!-- recall:generated:end -->';

export interface MarkerValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Confirms a Markdown memory file's generated markers are well-formed:
 * present in matched pairs, start before end, and never nested. Used by
 * `recall doctor` to detect files a human (or another tool) has corrupted.
 */
export function validateMarkers(content: string): MarkerValidation {
  const startCount = countOccurrences(content, GENERATED_START);
  const endCount = countOccurrences(content, GENERATED_END);

  if (startCount === 0 && endCount === 0) {
    return { valid: true };
  }
  if (startCount !== 1 || endCount !== 1) {
    return {
      valid: false,
      reason: `expected exactly one start and one end marker, found ${startCount} start and ${endCount} end`,
    };
  }
  const startIndex = content.indexOf(GENERATED_START);
  const endIndex = content.indexOf(GENERATED_END);
  if (endIndex < startIndex) {
    return { valid: false, reason: 'end marker appears before start marker' };
  }
  return { valid: true };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Replaces only the content between the generated markers, leaving anything
 * outside them byte-for-byte untouched. If `existingContent` is `null` (the
 * file does not exist yet), or has no markers at all, the human-editable
 * template is used to scaffold the file around the generated body. If markers
 * exist but are malformed, the existing content is preserved unmodified and
 * the caller is told so via `changed: false` — Recall never guesses how to
 * repair a file a human may be mid-edit on.
 */
export function upsertGeneratedSection(
  existingContent: string | null,
  generatedBody: string,
  template: (generatedSection: string) => string,
): { content: string; changed: boolean } {
  const wrapped = `${GENERATED_START}\n${generatedBody.trim()}\n${GENERATED_END}`;

  if (existingContent === null) {
    return { content: template(wrapped), changed: true };
  }

  const validation = validateMarkers(existingContent);
  if (!validation.valid) {
    return { content: existingContent, changed: false };
  }

  const startIndex = existingContent.indexOf(GENERATED_START);
  const endIndex = existingContent.indexOf(GENERATED_END);

  if (startIndex === -1 || endIndex === -1) {
    // No markers yet in an otherwise human-authored file: prepend the
    // generated section rather than touching any existing content.
    const separator = existingContent.trim().length > 0 ? '\n\n' : '';
    return { content: `${wrapped}${separator}${existingContent}`, changed: true };
  }

  const before = existingContent.slice(0, startIndex);
  const after = existingContent.slice(endIndex + GENERATED_END.length);
  const next = `${before}${wrapped}${after}`;
  return { content: next, changed: next !== existingContent };
}
