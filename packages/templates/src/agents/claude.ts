import type { AgentTemplate } from '../template.js';
import { document, section } from '../markdown.js';
import {
  architectureLines,
  conventionLines,
  dependencyLines,
  descriptionLines,
  installLines,
  projectTitle,
  provenanceLines,
  riskLines,
  scriptLines,
  stackLines,
  structureLines,
} from '../sections.js';

const CITE = { cite: true };

/**
 * Claude Code reads `CLAUDE.md` and follows `@path` imports inside it, so
 * this file is written to be imported as-is: commands first (Claude runs
 * them), then the shape of the code, then what to be careful about.
 */
export const claudeTemplate: AgentTemplate = {
  id: 'claude',
  displayName: 'Claude Code',
  render: (memory) =>
    document([
      [`# ${projectTitle(memory)} — project memory`],
      [
        ...provenanceLines(memory),
        '>',
        '> To load it in every Claude Code session, add `@.recall/agents/claude.md` to `CLAUDE.md`.',
      ],
      section('## Overview', [...descriptionLines(memory), ...stackLines(memory, CITE)]),
      section('## Commands', [...installLines(memory), ...scriptLines(memory)]),
      section('## Architecture', architectureLines(memory, CITE)),
      section('## Repository structure', structureLines(memory)),
      section('## Conventions', conventionLines(memory, CITE)),
      section('## Risks', riskLines(memory, CITE)),
      section(
        '## Dependencies',
        dependencyLines(memory, { includeDevelopment: true, maxPerGroup: 40 }),
      ),
    ]),
};
