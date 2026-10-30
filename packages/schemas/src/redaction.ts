/**
 * Secrets must never reach `memory.json` or an agent file: `openai.md` is
 * meant to be pasted into a third-party chat, so anything copied out of a
 * manifest travels further than the manifest itself. These functions are
 * the one place that decides what is scrubbed from repository text before
 * it becomes part of a Fact. They are deterministic and only ever remove
 * information.
 */

export const REDACTED = '<redacted>';

/** `scheme://userinfo@` anywhere in a string. Userinfo cannot contain `/`, `@`, or whitespace. */
const URL_USERINFO = /\b([a-z][a-z0-9+.-]*):\/\/([^\s/@]+)@/gi;

/** HTTP(S), including prefixed forms such as `git+https`, where any userinfo is a credential. */
const HTTP_SCHEME = /^(?:[a-z0-9.-]+\+)?https?$/i;

/**
 * Removes credentials embedded in URLs anywhere in `text`. HTTP(S) URLs
 * lose their whole userinfo (`https://x-access-token:ghp_…@host` and
 * `https://ghp_…@host` are both credentials); other schemes keep the
 * account name, which is not a secret (`ssh://git@host`), but lose any
 * password. scp-like remotes (`git@host:owner/repo`) have no scheme and
 * no password and are left unchanged.
 */
export function stripUrlCredentials(text: string): string {
  return text.replace(URL_USERINFO, (_match, scheme: string, userinfo: string) => {
    if (HTTP_SCHEME.test(scheme)) return `${scheme}://`;
    const colon = userinfo.indexOf(':');
    return colon === -1 ? `${scheme}://${userinfo}@` : `${scheme}://${userinfo.slice(0, colon)}@`;
  });
}

/**
 * An environment-variable assignment whose name says it holds a secret,
 * e.g. `API_KEY=abc123` or `GITHUB_TOKEN="…"` inside a script body.
 */
const SECRET_ASSIGNMENT =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIALS?)[A-Z0-9_]*)=("[^"]*"|'[^']*'|[^\s"']+)/gi;

/**
 * Scrubs repository text that may embed secrets (script bodies, dependency
 * specifiers): URL credentials are removed and the value of any
 * secret-named `NAME=value` assignment is replaced with `<redacted>`.
 */
export function redactSecrets(text: string): string {
  return stripUrlCredentials(text).replace(
    SECRET_ASSIGNMENT,
    (_match, name: string) => `${name}=${REDACTED}`,
  );
}
