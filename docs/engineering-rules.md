# Recall Engineering Rules

**Version:** 1.0
**Status:** Canonical
**Scope:** This document governs how engineering work on Recall is performed — by any engineer, any contributor, any AI agent. It does not describe the product (`docs/product-specification.md`) or the execution plan (`docs/implementation-blueprint.md`). It governs process and code; on product and execution matters, it defers to those two documents.

This document uses the words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** as normative keywords.

---

## 1. Purpose

Rules exist so engineering output does not depend on who is doing the work, or when. A codebase built by many contributors over time, without shared rules, accumulates inconsistency faster than it accumulates features — and inconsistency compounds: it slows every review, hides every regression, and erodes the trust the product depends on.

These rules exist to produce three properties, in this priority order: **consistency**, **predictability**, **long-term maintainability**. A rule that does not serve one of these three does not belong in this document.

---

## 2. Engineering Principles

- **Correctness before speed.** A slower correct solution MUST ship before a faster incorrect one. Speed is never traded for correctness.
- **Small, incremental change.** Work MUST be delivered in the smallest unit that is independently mergeable and independently valuable. Large, sweeping changes SHOULD NOT exist as a single unit of work.
- **Deterministic behavior.** Code MUST NOT depend on unordered iteration, wall-clock time, random values, or environment-specific state in any path that produces output. Where such a dependency is unavoidable, it MUST be isolated and explicit, never implicit in the result.
- **Local-first execution.** Code MUST NOT introduce a network dependency, a required external service, or an out-of-process call into any path executed during normal operation.
- **Explicit over implicit.** Behavior MUST be visible in the code that produces it. Configuration, defaults, and fallbacks MUST be readable at the call site or one level away — never inferred from convention alone.
- **One source of truth.** Every fact the system relies on MUST have exactly one authoritative representation. Any second representation MUST be derived from the first, never maintained independently.
- **No hidden behavior.** Code MUST NOT do more than its name, signature, and documentation describe. A side effect MUST be discoverable without reading the implementation.
- **Simple over clever.** Where two solutions are equally correct, the one a new contributor understands faster MUST be preferred, regardless of which is more elegant to write.

---

## 3. Task Rules

Every unit of engineering work MUST:

- Address exactly one responsibility.
- Be mergeable independently of any other in-progress work.
- Leave the main branch in a deployable state upon merge.
- Be reviewable in a single sitting by one reviewer.
- Carry acceptance criteria that are objectively verifiable — true or false, never a matter of judgment.
- Be completable within one working day.

A task MUST NOT expand in scope after it begins. If new scope is discovered mid-task, it MUST become a new task, not an extension of the current one.

---

## 4. Code Rules

- Code MUST NOT contain `TODO` comments. Unfinished work is either a tracked task or it does not exist in the codebase.
- Code MUST NOT contain dead code — code with no reachable caller.
- Code MUST NOT contain commented-out code. Version history is the record of what once existed; the working tree is not.
- Code MUST NOT duplicate knowledge that already exists elsewhere in the codebase (§2, One source of truth).
- Code MUST NOT have side effects that are not discoverable from its name, signature, or documentation.
- Code MUST NOT use magic strings or magic numbers where a named constant would make the value's meaning explicit.
- Code MUST NOT silently fall back to a default when an operation fails. A failure is either handled explicitly and visibly, or it propagates.
- Behavior that is not obvious from reading the code MUST be documented at the point it occurs.
- Code MUST NOT introduce an abstraction — an interface, a base class, a generic layer — until at least two concrete cases require it.
- Code MUST NOT be written to anticipate a requirement that does not yet exist.

---

## 5. Public API Rules

- A public contract, once released, is stable by default. It MUST NOT change in a way that breaks an existing consumer without that change being explicitly identified, reviewed, and approved as a breaking change.
- Every exported interface MUST have exactly one owning package. Two packages MUST NOT both claim authority over the same contract.
- Generated output a user receives is a public contract with the same stability guarantee as an exported function or type. A change to what is written to disk is a breaking change under the same rule as a change to a function signature.
- A breaking change MUST be distinguishable, at a glance, from a non-breaking one — through versioning, changelog, or an equivalent explicit signal. It MUST NOT be discoverable only by diffing behavior after the fact.

---

## 6. Testing Rules

- Every feature MUST have tests that fail if the feature regresses.
- Every public contract (§5) MUST have a golden test: a committed expected output that any unintended change is diffed against.
- Behavior that can vary by operating system MUST be verified on every operating system Recall supports, never assumed from one.
- Output documented as deterministic MUST be tested for determinism — the same input, run repeatedly, produces identical output.
- A regression MUST be captured as a test, not as a comment warning a future contributor. A comment can be missed; a failing test cannot.

---

## 7. Filesystem Rules

- Writes to disk MUST be atomic. A reader MUST NEVER observe a partially written file.
- A generated file MUST NOT be partially overwritten. It is replaced whole, or not touched.
- Code MUST NOT write to, or otherwise mutate, anything outside its approved output location. What that location is belongs to the product contract; this rule governs that no code path is permitted to write anywhere else, regardless of convenience.
- Path handling MUST account for platform differences — separators, case sensitivity, path length limits — rather than assuming one platform's behavior.
- A symlink MUST be treated as a potential escape from the approved output location and handled accordingly. A change MUST NOT reduce existing symlink protections; any change to symlink handling requires explicit review of its security implication, not only its functional one.

---

## 8. Documentation Rules

- Documentation follows implementation. A document describes what has been decided or built — it does not substitute for either.
- The Product Specification (`docs/product-specification.md`) is the product truth. Any question about what Recall does or does not do is answered there.
- The Implementation Blueprint (`docs/implementation-blueprint.md`) is the execution truth. Any question about what work exists and in what order is answered there.
- This document is the engineering truth. Any question about how work is performed is answered here.
- A README is an entry point, not a specification. It MUST NOT be the sole record of any decision, contract, or guarantee — those belong in the documents above.

---

## 9. Git Rules

- Commits MUST be small enough to review in isolation.
- Every commit message MUST state what changed and why, in language a future contributor with no other context can act on.
- A commit MUST contain exactly one logical change. Unrelated changes MUST be split into separate commits.
- The main branch MUST always be deployable. Nothing is merged that leaves it otherwise, even temporarily.
- Force-pushing to a protected branch MUST NOT happen.

---

## 10. Code Review Rules

A review evaluates:

- **Behavior.** Does the change do what it claims to do, and nothing else.
- **Correctness.** Does it handle the cases it must handle, including failure cases.
- **Contracts.** Does it honor every public contract in §5, and every guarantee in the Product Specification.
- **Maintainability.** Will a future contributor, with no other context, be able to understand and safely change this.

A review MUST NOT block on personal style where a rule in this document is already satisfied. Style preference is not a review criterion; compliance with these rules is.

---

## 11. Decision Rules

When more than one solution satisfies the Product Specification, the solution chosen MUST be the simplest one that carries the smallest ongoing maintenance cost. Technical interest, familiarity, and novelty are never valid deciding factors. If two solutions are equally simple and equally maintainable, either MAY be chosen — the decision does not need to be perfect, only defensible against this rule.

---

## 12. AI Collaboration Rules

An AI assistant contributing to Recall is an engineering tool, subject to every rule in this document exactly as a human contributor is. Specifically, an AI assistant:

- MUST NOT define or alter product behavior. Product behavior is defined only in the Product Specification.
- MUST NOT expand the scope of a task beyond what was assigned.
- MUST NOT redesign architecture. Architecture is defined only in the Implementation Blueprint.
- MUST implement only tasks that have already been approved.
- MUST produce changes that are reviewable under §10 exactly as any other change is — with no exception for how the change was produced.

Authorship does not change what is true. A rule that applies to a human contributor's code applies identically to an AI assistant's.

---

## 13. Definition of Engineering Quality

Recall's engineering is production-ready when a change exhibits all five of the following, in this order of priority:

1. **Correctness.** It does what it claims, verified by a test, under every condition the Product Specification requires it to handle.
2. **Predictability.** The same input produces the same output, on every supported platform, every time.
3. **Maintainability.** A contributor unfamiliar with the change can understand it, safely modify it, and trust that nothing outside its stated scope was affected.
4. **Testability.** Its behavior can be verified without manual inspection.
5. **Clarity.** It is written to be read. Where clarity and cleverness compete, clarity wins, without exception.

Quality is never demonstrated by how sophisticated a solution is. It is demonstrated by how confidently the next contributor can rely on it without reading it first.

---

## 14. Amendment

This document may change only when a change measurably improves consistency, maintainability, or product quality. It MUST NOT change to accommodate a shortcut, a deadline, or a single contributor's preference. Any amendment MUST be explicit, reviewed, and versioned — the same discipline this document requires of every contract it governs.
