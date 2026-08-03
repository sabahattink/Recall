# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in Recall, please report it privately rather than opening a public issue. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) feature on this repository, or contact the maintainers directly through the repository's security tab.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce it, ideally against a minimal repository.
- The version of `@recall-ai/cli` and the Node.js version you are using.

We aim to acknowledge reports within a reasonable timeframe and to work with reporters on a coordinated disclosure.

## Scope and what Recall is not

Recall is a local static-analysis tool, not a security scanner. `recall scan`/`risks.md` surface a narrow, deterministic set of evidence-based findings (missing tests, circular dependencies, committed `.env`-style files, unpinned Docker base images, and similar). This is not a substitute for dependency vulnerability scanning, SAST/DAST tooling, or a professional security audit, and Recall makes no claim of completeness or accuracy beyond what its documented rules check.

## Design principles relevant to security

- **No network access required.** Recall's core commands never make outbound network calls.
- **Read-only analysis.** Recall does not execute, import, or evaluate any file in the repository it analyzes; it only reads file metadata and text content (with size limits and binary-file detection) to produce its snapshot.
- **Restricted writes.** Recall only ever writes to `.recall/`, `.gitignore`, and an explicit output path the user provides via a CLI flag.
- **No secret exposure.** `.env`-style files are detected as a risk finding (their _path_ is reported), but their contents are never read into generated output or printed to the terminal.
- **Path safety.** All writes are checked against path traversal, and symlinked files are not written through or followed outside the repository root.

If you find a case where Recall violates any of the above, please treat it as a security bug and report it as described above.
