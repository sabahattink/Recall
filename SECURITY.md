# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in Recall, please report it privately rather than opening a public issue. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) feature on this repository, or contact the maintainers directly through the repository's security tab.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce it, ideally against a minimal repository.
- The version of `recall-context` and the Node.js version you are using.

We aim to acknowledge reports within a reasonable timeframe and to work with reporters on a coordinated disclosure.

## Scope and what Recall is not

Recall is a local tool that initializes repository memory for AI assistants, not a security scanner. The `risks` in `memory.json` are a narrow, deterministic set of evidence-based indicators (no CI, no license, no lockfile, unignored `.env` files, ...). They are not a substitute for dependency vulnerability scanning, SAST/DAST tooling, or a security audit.

## Design principles relevant to security

- **No network access.** Recall makes no outbound network calls; CI runs the compiled CLI with every network API replaced by one that throws.
- **Read-only analysis.** Recall never executes, imports, or evaluates repository code. It reads file names and a handful of manifests (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`). Git is invoked read-only, by absolute path (never a `git` found in the repository directory), with `core.fsmonitor` disabled, so neither a planted executable nor a repository's own Git config can make Recall run a command.
- **Restricted writes.** Recall writes only `.recall/`, through a staging directory renamed into place, and refuses a `.recall` that is a symlink or junction.
- **No secret exposure.** `.env`-style files are reported by path only; their contents are never read. Credentials embedded in a Git remote URL are removed before the URL is recorded.
- **Agent-file integrity.** Repository text is escaped before it is written into agent files, so a crafted `description` cannot inject headings or structure into a file an assistant treats as instructions.

If you find a case where Recall violates any of the above, please treat it as a security bug and report it as described above.
