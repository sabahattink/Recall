import { readFile } from 'node:fs/promises';

/**
 * Reads a UTF-8 text file without its byte-order mark, or `null` if it
 * cannot be read. Windows editors commonly save `package.json` with a BOM;
 * left in place it makes `JSON.parse` fail and a TOML table header stop
 * matching, silently dropping every Fact that file is evidence for.
 */
export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    const contents = await readFile(path, 'utf8');
    return contents.startsWith('\uFEFF') ? contents.slice(1) : contents;
  } catch {
    return null;
  }
}

/** Reads and parses a JSON file, returning `null` if it is missing or malformed. */
export async function readJsonIfExists<T>(path: string): Promise<T | null> {
  const contents = await readTextIfExists(path);
  if (contents === null) return null;
  try {
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}
