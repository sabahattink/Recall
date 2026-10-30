import { defineTemplateRegistry } from './template.js';
import { claudeTemplate } from './agents/claude.js';
import { codexTemplate } from './agents/codex.js';
import { cursorTemplate } from './agents/cursor.js';
import { geminiTemplate } from './agents/gemini.js';
import { openaiTemplate } from './agents/openai.js';

/**
 * The templates Recall v1 ships (docs/product-specification.md §17), which
 * together with `memory.json` make up the output contract of spec §12.
 */
export const DEFAULT_TEMPLATE_REGISTRY = defineTemplateRegistry([
  claudeTemplate,
  codexTemplate,
  cursorTemplate,
  geminiTemplate,
  openaiTemplate,
]);
