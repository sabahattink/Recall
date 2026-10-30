# Demo recording script

Exact commands for a 20–30 second terminal recording. Run them verbatim — don't edit or speed up the output; the point of the recording is that it's real.

```bash
git clone <small-demo-repo>
cd <small-demo-repo>
npx recall-context init
ls .recall .recall/agents
head -40 .recall/agents/claude.md
```

## Notes for the recording

- `<small-demo-repo>` should be a small, real TypeScript or Python project with a few scripts and a framework, so `claude.md` shows a populated Commands and Architecture section.
- `npx recall-context init` prints exactly four lines. Let them print in real time; it is the whole product experience (spec §11).
- End on `claude.md`: it is what an assistant will read, and every line of it is backed by a file in the repository.
- Target 20–30 seconds. Cut between commands rather than speeding up playback.
