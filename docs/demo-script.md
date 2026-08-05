# Demo recording script

Exact commands for recording the 20–30 second terminal demo referenced from the [README](../README.md#demo). Run these verbatim — don't edit or speed up the output; the point of the recording is that it's real.

```bash
npm install -g recall-context
git clone <small-demo-repo>
cd <small-demo-repo>
recall init
recall status
recall context --task "Add password reset" --stdout
```

## Notes for the recording

- `<small-demo-repo>` should be a small, real Node.js/TypeScript project — enough to produce a non-trivial `Detected:` summary (a framework, a couple of entry points) without making `recall init` visibly slow. One of `packages/test-fixtures/fixtures/*` in this repository works well for this and needs no external clone step if recording from inside the monorepo checkout.
- `recall context --task "..." --stdout` is the last command specifically because it's the payoff: it's what a viewer would actually copy into an agent.
- Let each command's real output print in full — don't truncate `recall context --stdout`'s output for the recording; trim the visible window afterward if it's too long, but don't fabricate a shorter version.
- Target 20–30 seconds total. If the full sequence runs long, prefer cutting between commands over speeding up playback.
