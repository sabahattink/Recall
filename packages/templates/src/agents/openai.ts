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

const NO_CITE = { cite: false };

/**
 * ChatGPT and the OpenAI API have no file they read from a repository, so
 * this rendering is meant to be pasted into a ChatGPT Project's
 * instructions or an API system prompt: compact, no evidence citations
 * (the reader cannot open the cited files), runtime dependencies only.
 */
export const openaiTemplate: AgentTemplate = {
  id: 'openai',
  displayName: 'ChatGPT / OpenAI',
  render: (memory) =>
    document([
      [`# Project context: ${projectTitle(memory)}`],
      [
        ...provenanceLines(memory),
        '>',
        "> Paste this into a ChatGPT Project's instructions or an OpenAI API system prompt.",
      ],
      section('## What this project is', [
        ...descriptionLines(memory),
        ...stackLines(memory, NO_CITE),
      ]),
      section('## How to build, test, and run', [...installLines(memory), ...scriptLines(memory)]),
      section('## Layout', [
        ...architectureLines(memory, NO_CITE),
        ...labeledStructureLines(memory),
      ]),
      section('## Conventions', conventionLines(memory, NO_CITE)),
      section('## Risks', riskLines(memory, NO_CITE)),
      section(
        '## Runtime dependencies',
        dependencyLines(memory, { includeDevelopment: false, maxPerGroup: 25 }),
      ),
    ]),
};
