# Changelog

Release notes for the published `recall-context` npm package. Internal `@recall-ai/*` workspace packages are never published and are not tracked here.

## 0.2.0-alpha.1

### Highlights

- Deterministic task-focused context ranking
- Explainable ranking evidence in JSON
- Better source entry-point detection
- Runtime and development dependency-edge classification
- TypeScript CLI monorepo project profiling
- Ranking specificity improvements for generic terms

### Example

```bash
recall context --task "Fix password reset controller" --stdout
```

### Compatibility

- Existing snapshots remain readable.
- New snapshot fields are additive and optional.
- Running `recall update` refreshes older snapshots with richer metadata.

### Alpha note

Ranking weights are heuristic and may change. Generated output and JSON fields may evolve before stable release. Do not make unsupported performance or accuracy claims based on this release.

## 0.1.0

Initial public alpha.
