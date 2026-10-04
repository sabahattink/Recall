# recall-context

## 0.2.2

### Patch Changes

- 49b2c9f: Harden repository analysis before deeper code intelligence: fix Next.js route feature detection, add configurable analysis-noise filtering, improve source-aware entry points and glossary quality, count only production edges for deep-coupling risks, and make packaging verification fail fast when registry access is unavailable.

## 0.2.1

### Patch Changes

- 9dbb9be: Show evidence-backed architecture context for single-package repositories when no workspace dependency edges exist. Recall now surfaces the detected project shape, frameworks, source entry points, and runtime imports instead of reporting that no architecture was detected.
