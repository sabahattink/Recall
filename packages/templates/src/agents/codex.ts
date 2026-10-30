import type { AgentTemplate } from '../template.js';
import { document, section } from '../markdown.js';
import {
  architectureLines,
  conventionLines,
  dependencyLines,
  descriptionLines,
  installLines,
  labeledStructureLines,
  projectTitle,
  provenanceLines,
  riskLines,
  scriptLines,
  stackLines,
} from '../sections.js';

const CITE = { cite: true };

/**
 * Codex reads `AGENTS.md`, whose convention is task-oriented headings:
 * setup, then build/test commands, then code style and layout. This file
 * follows that layout so it can be copied to `AGENTS.md` unchanged.
 */
export const codexTemplate: AgentTemplate = {
  id: 'codex',
  displayName: 'OpenAI Codex',
  render: (memory) =>
    document([
      [`# AGENTS.md — ${projectTitle(memory)}`],
      [
        ...provenanceLines(memory),
        '>',
        '> Codex reads `AGENTS.md`: copy this file there, or reference `.recall/agents/codex.md` from it.',
      ],
      section('## Project overview', [...descriptionLines(memory), ...stackLines(memory, CITE)]),
      section('## Setup commands', installLines(memory)),
      section('## Build, test, and run', scriptLines(memory)),
      section('## Code style and conventions', conventionLines(memory, CITE)),
      section('## Project structure', [
        ...architectureLines(memory, CITE),
        ...labeledStructureLines(memory),
      ]),
      section('## Known risks', riskLines(memory, CITE)),
      section(
        '## Dependencies',
        dependencyLines(memory, { includeDevelopment: true, maxPerGroup: 40 }),
      ),
    ]),
};
