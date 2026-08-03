import { readFile } from 'node:fs/promises';

/** Reads and parses a JSON file, returning `null` if it is missing or malformed. */
export async function readJsonIfExists<T>(path: string): Promise<T | null> {
  try {
    const contents = await readFile(path, 'utf8');
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}
