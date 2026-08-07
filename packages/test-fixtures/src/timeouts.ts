/**
 * Timeouts for integration tests/hooks that do real filesystem + Git
 * subprocess work (repo init, commits, multi-file scans). On Windows CI
 * runners, each `git.exe` invocation carries process-creation and
 * antivirus-scan overhead far higher than on Linux/macOS or a local dev
 * machine, and these tests issue many of them — so the same test that
 * comfortably finishes in under a second locally can exceed Vitest's
 * defaults on Windows CI.
 *
 * These are deliberately NOT global timeout overrides: apply the relevant
 * one only to the specific `it(...)`/`beforeEach(...)` that has demonstrated
 * Windows timing pressure, as its trailing timeout argument. The non-Windows
 * value in each constant matches Vitest's own default for that hook type
 * exactly, so applying it elsewhere is a deliberate widening on Windows only
 * — never a change in behavior on Linux/macOS, and never a reduction below
 * what an unannotated test already gets.
 */

/** For `it(name, fn, integrationTestTimeout)`. Vitest's `testTimeout` default is 5000ms. */
export const integrationTestTimeout = process.platform === 'win32' ? 15_000 : 5_000;

/** For `beforeEach(fn, integrationHookTimeout)` (or `afterEach`/`beforeAll`/`afterAll`). Vitest's `hookTimeout` default is 10000ms. */
export const integrationHookTimeout = process.platform === 'win32' ? 15_000 : 10_000;
