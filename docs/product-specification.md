# Recall Product Specification

**Version:** 1.0
**Status:** Canonical
**Scope:** This document defines what Recall is, what it guarantees, and what it will never do. It is the contract against which every implementation, feature request, and design decision is evaluated. Where an implementation and this document disagree, the implementation is wrong.

This document uses the words **MUST**, **MUST NOT**, **SHALL**, **SHOULD**, and **MAY** as normative keywords. A MUST is not negotiable by convenience, timeline, or technical elegance.

---

## 1. Preamble

Every AI coding assistant starts every session the same way: knowing nothing.

The developer explains the stack. Explains the structure. Explains the conventions. Explains it again tomorrow, to a different assistant, or the same assistant with no memory of yesterday. This repetition is not a rite of passage. It is waste, and it happens because no repository carries a record of itself that an AI assistant can read.

Recall exists to end that repetition.

Recall initializes a repository once, produces a record of what the repository *is*, and lets every AI assistant read that record instead of re-deriving it from a blank context window, every time, forever.

---

## 2. Product Identity

**What is Recall?**

**Recall is the tool that initializes a repository's memory for AI coding assistants.**

That is the unambiguous, complete answer. Everything else in this document explains, constrains, or elaborates on that one sentence — nothing in it changes it.

Recall is to AI context what `git init` is to version history: a single, deliberate act that moves a repository from *unknown* to *known*, performed once, relied upon indefinitely. It is not the assistant that reads the memory, not the model that reasons over it, and not the interface a developer talks to. Recall is the act of initialization itself, and the record that act leaves behind.

---

## 3. Mission

**Initialize any software repository so every AI coding assistant immediately understands the project.**

That is the entire mission. Not "help write code." Not "review code." Not "chat about code." Recall's only job is to produce, once, the shared understanding that every AI assistant would otherwise have to reconstruct on its own.

---

## 4. Product Vision

Software is increasingly written in collaboration with AI assistants, and that collaboration is only as good as the context behind it. Today, that context lives nowhere durable: it is retyped into a chat window, forgotten between sessions, and reconstructed differently by every assistant, every developer, every day. As more of software development moves through AI assistants, the absence of a durable, shared record of what a repository *is* stops being an inconvenience and becomes a structural liability — repeated everywhere, compounding across every team, every tool switch, every new assistant a developer tries.

Recall's vision is for repository initialization to include AI memory as a matter of course — not as a specialized tool a few teams adopt, but as an assumed, uncontroversial step, the same way initializing version control stopped being optional decades ago. A repository without a `.recall/` directory should feel, eventually, the way a repository without a `.git` directory feels today: unusual, and slightly behind.

This vision is deliberately narrow in one respect: Recall's role is to *establish the memory layer*, not to build everything that could ever be built on top of it. Sync, collaboration, retrieval, and realtime updating are all real problems that may one day deserve real products. Recall's contribution is making sure those products, if they are ever built, have a solid, trustworthy, local-first foundation to build on — a foundation that owes nothing to any one of them and depends on none of them existing. Recall succeeds by being the layer other things can safely assume is already there, not by becoming those other things itself.

---

## 5. North Star

A developer clones a repository, runs exactly one command:

```
npx recall-context init
```

Within one minute, every major AI assistant understands the project without asking repetitive questions.

This is the only measure of Recall that matters. A feature that does not move a real developer closer to this moment does not belong in Recall.

---

## 6. Terminology

The following terms have precise, fixed meanings throughout this document and in Recall's implementation. Using them loosely, or introducing synonyms for them, is itself a spec violation.

- **Repository.** The developer's existing codebase on disk, exactly as it stands when `recall init` is run. Recall's only input.
- **Scanner.** The stage that reads the Repository and produces Facts. The Scanner observes; it does not interpret.
- **Fact.** A single, evidence-based observation about the Repository — traceable to something that concretely exists (a file, a dependency entry, a configuration value). A Fact is never a guess.
- **Project Memory.** The normalized, agent-independent body of knowledge derived from Facts. Project Memory is the only place repository knowledge is decided. Its on-disk form is `memory.json`.
- **`memory.json`.** The serialized, canonical representation of Project Memory. The single source of truth for every generated file.
- **Agent.** A named AI coding assistant Recall generates memory for (for example, Claude or Cursor). An Agent is a consumer of Recall's output, never a participant in producing it.
- **Agent Template.** The read-only transformation from Project Memory into the file format a given Agent understands. A template formats knowledge; it never gathers it.
- **Initialization.** The complete act of running `recall init` against a Repository: Scanner → Project Memory → Agent Templates → disk. Initialization is a single, one-time event, not an ongoing process.
- **`.recall/`.** The one directory Recall writes to. The complete, exhaustive boundary of Recall's effect on a Repository.

---

## 7. What Recall Is Not

Stating what Recall is not is as important as stating what it is, because the temptation to become these things will recur with every roadmap discussion.

- Recall is **not** an AI assistant. It does not answer questions, write code, or hold a conversation.
- Recall is **not** another coding agent. It has no opinions about how code should be written.
- Recall is **not** a prompt generator. It does not construct prompts for a specific task or session.
- Recall is **not** a chat interface. There is no conversation to have with Recall.
- Recall is **not** a platform. There is no account, no dashboard, no service to log into.

Recall is the **shared memory layer for AI software development**: the thing every assistant reads, that none of them had to be told.

---

## 8. Scope

This section defines what Recall will never do — not "not yet," but never, as a matter of what Recall permanently is. Where §15 (Non-Goals) lists specific capabilities excluded from this version, this section states the permanent boundary those exclusions all descend from. It exists so that feature creep can be refused at the level of identity, not re-litigated feature by feature.

Recall will never:

- Make a decision on the developer's behalf. Recall observes and records; it does not choose, recommend, or act.
- Require trust in anything beyond reading files already present on disk. Recall's entire footprint is what it reads and what it writes to `.recall/`.
- Optimize for engagement, retention, or time spent using it. A shorter interaction with Recall is always a better one.
- Become a runtime dependency. A repository must build, run, and test identically whether `.recall/` exists or not.
- Require a persistent connection to anything outside the repository, at any point, for any reason.
- Hold an opinion about how the developer should write code. Recall describes the repository as it is, never as it should be.

Any future capability that would require breaking one of these is not a future version of Recall. It is a different product.

---

## 9. Core Principles

Recall must earn the same category of trust a developer already extends to Git, pnpm, TypeScript, Prettier, and ESLint. That trust is earned through five properties, all non-negotiable:

- **Simple.** One command. One obvious outcome. No configuration required to get value.
- **Predictable.** The same repository, scanned twice, produces the same memory. No randomness, no variance run to run.
- **Fast.** The full cycle — scan, generate, write — completes in a matter of seconds on a typical repository, not minutes.
- **Local-first.** Everything happens on the developer's machine, using only the repository already on disk.
- **Deterministic.** Given the same repository state, Recall MUST produce byte-identical output, every time, on every machine.

There is a sixth property that supersedes all of them: **no magic.** A developer must be able to read Recall's output and understand exactly why it says what it says, with no invisible inference standing between the repository and the memory it produced.

---

## 10. Product Principle

Every proposed feature, before it is built, must survive one question:

> **"Does this help initialize a repository for AI?"**

If the honest answer is no, the feature does not belong in Recall v1 — regardless of how technically interesting it is, how easy it would be to add, or how many users have asked for it as a tangent. Recall does not accumulate capability for its own sake. Every feature must create immediate, first-run user value, not speculative future value.

---

## 11. The First User Experience

The complete onboarding to Recall is exactly one command:

```
npx recall-context init
```

The user sees, in order:

```
Scanning repository...
Detecting architecture...
Generating AI memory...
Done.
```

Nothing precedes this. Nothing follows it. There is no setup step before the command, and no cleanup step after it. When the command finishes, the repository is AI-ready. That is the entire product experience.

Explicitly, at no point does Recall require:

- A login
- An API key
- A dashboard
- A cloud account
- A subscription
- A browser

Any future feature that would introduce one of these into the first-run experience is, by definition, not v1.

---

## 12. Output Contract

Recall produces exactly one directory, containing exactly these files:

```
.recall/
├── memory.json
└── agents/
    ├── claude.md
    ├── codex.md
    ├── cursor.md
    ├── gemini.md
    └── openai.md
```

Nothing else. Specifically, Recall MUST NOT produce:

- A cache directory
- Snapshot history
- A manifest file separate from `memory.json`
- Telemetry logs
- Any hidden or undocumented metadata file

If a future capability seems to require a new file on disk, that is a signal the capability does not belong in this contract without an explicit, deliberate revision of this specification — not a reason to quietly add a file.

---

## 13. Project Memory

The most important artifact Recall produces is not a Markdown file. It is `memory.json`.

`memory.json` is the **single source of truth** about the repository. Every other generated file is a derived view of it, and nothing more.

This creates two absolute rules:

1. **Every generated agent file MUST be produced from `memory.json`, and only from `memory.json`.** No agent-specific file may contain a fact that is not traceable back to Project Memory.
2. **No template may scan the repository directly.** Templates are read-only consumers of Project Memory. They format; they do not investigate.

This separation is what makes Recall trustworthy: there is exactly one place where repository knowledge is decided, and every downstream artifact is a faithful, mechanical transformation of that one decision.

---

## 14. Architecture Shape

Recall's architecture is deliberately, permanently small:

```
Repository
    ↓
Scanner
    ↓
ProjectMemory
    ↓
Agent Templates
    ↓
Disk
```

Five stages. No more.

Recall's architecture MUST NOT grow additional layers to accommodate a feature. Specifically excluded, permanently, not merely "for now":

- A plugin framework
- Dependency injection
- An event bus
- A message queue
- Background workers

If a proposed feature cannot be expressed as a Scanner producing more facts, a Project Memory field capturing more knowledge, or an Agent Template rendering that knowledge differently, the feature does not fit this architecture — and the correct response is to say so, not to bend the architecture to fit the feature.

---

## 15. The Scanner

The Scanner's job is to **discover facts, never opinions.**

Facts the Scanner is responsible for surfacing include: languages present, frameworks in use, package manager, workspace layout, important directories, available commands, testing framework, linting configuration, architectural hints, dependencies, repository metadata, and risk indicators.

Every fact the Scanner produces MUST be evidence-based — traceable to something that actually exists in the repository (a file, a configuration entry, a dependency declaration). The Scanner does not guess, infer intent, or editorialize. If the evidence is ambiguous or absent, the correct output is the absence of a claim, not a best-effort guess presented as fact.

---

## 16. Project Memory

Project Memory is where discovered facts become normalized, agent-independent knowledge. It is the transformation between "what the Scanner saw" and "what every assistant needs to know."

Project Memory contains:

- Project metadata
- Technology stack
- Architecture
- Repository structure
- Commands
- Conventions
- Dependencies
- Risk areas

Everything captured here is agent-independent by design. Project Memory has no concept of Claude, Cursor, Codex, Gemini, or OpenAI — it knows only the repository. Agent-specific concerns belong exclusively to the next stage.

---

## 17. Agent Templates

Agent Templates exist for exactly one purpose: transforming Project Memory into the format each AI assistant understands best. They never inspect the repository, never gather new facts, and never hold knowledge that Project Memory does not already contain.

Recall v1 ships templates for: Claude, Cursor, Codex, Gemini, and OpenAI.

Adding support for a new AI assistant MUST require only **one new template and one registration** — nothing else in the system changes. If adding a new assistant ever requires touching the Scanner or Project Memory, that is a violation of this specification.

---

## 18. Command-Line Interface

Recall v1 has exactly one public command:

```
npx recall-context init
```

The npm package is `recall-context`, because the npm name `recall` belongs to an unrelated package; the command it installs is `recall`, so after a global install the same command is `recall init`.

With one optional flag:

```
--force
```

No other public command exists in v1. This is not an oversight to be corrected later — it is the deliberate shape of the product. A single command with a single well-understood outcome is easier to trust, teach, and remember than a surface with many commands and many outcomes.

---

## 19. Non-Goals

The following are explicitly excluded from Recall v1:

- Cloud synchronization
- Accounts
- Embeddings
- Vector databases
- Retrieval-augmented generation (RAG)
- Background indexing
- MCP (Model Context Protocol) integration
- Realtime memory updates
- Team collaboration features
- Prompt history
- A chat interface
- LLM calls of any kind
- AI inference of any kind
- A database
- Telemetry
- Analytics
- Remote API calls

These are not rejected ideas. They are **future products**, and each one, should it ever be built, is a different product built on top of what Recall v1 establishes — not a feature quietly folded into v1's scope. Recall v1's smallness is a feature, not a placeholder for a larger product still being assembled.

---

## 20. Guarantees

A developer who runs `recall init` is entitled to rely on the following, unconditionally:

- **No network access.** Recall performs its work entirely offline, using only what is already on disk.
- **No code execution beyond reading.** Recall reads the repository; it does not run the repository's code, tests, or build scripts to learn about it.
- **No mutation of source files.** Recall writes only inside `.recall/`. It never modifies anything outside that directory.
- **Idempotency.** Running `recall init` again against an unchanged repository produces an unchanged `.recall/`.
- **Determinism.** The same repository state always produces the same `memory.json` and the same generated files, on any machine, at any time.
- **No silent partial success.** Either the full `.recall/` output is produced correctly, or nothing is written at all.

---

## 21. Design Philosophy

Recall should disappear.

The measure of a well-designed developer tool is not how often it is thought about, but how quickly it becomes invisible. A developer who has run `recall init` should think:

> "My repository is initialized."

Not:

> "I am using Recall."

Recall's job ends the moment `.recall/` exists. It does not ask to be reopened, checked on, or maintained as a matter of habit. It is closer to `git init` than to an application — a single act that changes the state of a repository, after which the tool steps out of the way.

---

## 22. Success Metric

Recall v1 succeeds if, and only if, the following sequence happens in the real world:

1. A developer installs Recall.
2. The developer runs one command.
3. The developer opens Claude, Cursor, Codex, Gemini, or ChatGPT.
4. The developer notices, without being prompted to notice:

   > "I no longer have to explain my project."

Every other metric — installs, stars, generated-file size, scan speed, template count — is a proxy. This is the only outcome that defines whether Recall did its job.

---

## 23. Product Promise

The one sentence a developer should still remember after leaving the website:

> **A repository, once initialized, never has to explain itself again.**

---

## 24. Amendment

This specification is canonical, not immutable. It changes only by deliberate, explicit revision — never by an implementation detail quietly drifting out of alignment with it. Any change to Recall's behavior that contradicts this document is a bug in the implementation, not a de facto update to the spec. Any genuine change of product direction requires this document to be revised first, in the open, with a new version number — and the implementation follows the document, never the other way around.
