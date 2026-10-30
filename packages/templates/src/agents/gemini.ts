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
 * Gemini CLI reads `GEMINI.md` and follows `@path` imports inside it. The
 * headings mirror the sections Gemini CLI's own `/init` writes (project
 * overview, building and running, development conventions).
 */
export const geminiTemplate: AgentTemplate = {
  id: 'gemini',
  displayName: 'Gemini CLI',
  render: (memory) =>
    document([
      [`# Project context: ${projectTitle(memory)}`],
      [
        ...provenanceLines(memory),
        '>',
        '> To load it in every Gemini CLI session, add `@.recall/agents/gemini.md` to `GEMINI.md`.',
      ],
      section('## Project overview', [...descriptionLines(memory), ...stackLines(memory, CITE)]),
      section('## Building and running', [...installLines(memory), ...scriptLines(memory)]),
      section('## Development conventions', conventionLines(memory, CITE)),
      section('## Project structure', [
        ...architectureLines(memory, CITE),
        ...labeledStructureLines(memory),
      ]),
      section('## Risks', riskLines(memory, CITE)),
      section(
        '## Dependencies',
        dependencyLines(memory, { includeDevelopment: true, maxPerGroup: 40 }),
      ),
    ]),
};
