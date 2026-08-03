import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Confidence, Evidence, FrameworkDetection, FrameworkName } from '@recall-ai/schemas';
import type { DiscoveredWorkspace } from './workspaces.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface Candidate {
  name: FrameworkName;
  confidence: Confidence;
  evidence: Evidence[];
}

const CONFIG_FILE_SIGNALS: Array<{
  file: string;
  framework: FrameworkName;
}> = [
  { file: 'nest-cli.json', framework: 'nestjs' },
  { file: 'next.config.js', framework: 'nextjs' },
  { file: 'next.config.mjs', framework: 'nextjs' },
  { file: 'next.config.ts', framework: 'nextjs' },
];

const DEPENDENCY_SIGNALS: Array<{ dependency: string; framework: FrameworkName }> = [
  { dependency: '@nestjs/core', framework: 'nestjs' },
  { dependency: 'next', framework: 'nextjs' },
  { dependency: 'react', framework: 'react' },
  { dependency: 'express', framework: 'express' },
  { dependency: 'fastify', framework: 'fastify' },
  { dependency: 'vue', framework: 'vue' },
];

export async function detectFrameworks(
  root: string,
  workspaces: DiscoveredWorkspace[],
): Promise<FrameworkDetection[]> {
  const detections: FrameworkDetection[] = [];

  for (const workspace of workspaces) {
    const candidates = new Map<FrameworkName, Candidate>();
    const allDeps = {
      ...workspace.packageJson.dependencies,
      ...workspace.packageJson.devDependencies,
    };

    for (const signal of DEPENDENCY_SIGNALS) {
      if (allDeps[signal.dependency]) {
        upsertCandidate(candidates, signal.framework, 'medium', {
          path: join(workspace.info.path, 'package.json').split('\\').join('/'),
          reason: `dependency "${signal.dependency}" declared`,
        });
      }
    }

    for (const signal of CONFIG_FILE_SIGNALS) {
      if (await exists(join(workspace.absolutePath, signal.file))) {
        upsertCandidate(candidates, signal.framework, 'high', {
          path: join(workspace.info.path, signal.file).split('\\').join('/'),
          reason: `configuration file "${signal.file}" present`,
        });
      }
    }

    // Next.js implies React; suppress the redundant, lower-confidence React
    // detection so the report does not double-count the same evidence.
    if (candidates.has('nextjs')) {
      candidates.delete('react');
    }

    if (candidates.size === 0 && Object.keys(workspace.packageJson).length > 0) {
      detections.push({
        name: 'generic-node',
        workspace: workspace.info.path === '.' ? null : workspace.info.path,
        confidence: 'low',
        evidence: [
          {
            path: join(workspace.info.path, 'package.json').split('\\').join('/'),
            reason: 'no recognized framework dependency or configuration file found',
          },
        ],
      });
      continue;
    }

    for (const candidate of candidates.values()) {
      detections.push({
        name: candidate.name,
        workspace: workspace.info.path === '.' ? null : workspace.info.path,
        confidence: candidate.confidence,
        evidence: candidate.evidence,
      });
    }
  }

  return detections;
}

function upsertCandidate(
  candidates: Map<FrameworkName, Candidate>,
  framework: FrameworkName,
  confidence: Confidence,
  evidence: Evidence,
): void {
  const existing = candidates.get(framework);
  if (existing) {
    existing.evidence.push(evidence);
    if (confidence === 'high') existing.confidence = 'high';
  } else {
    candidates.set(framework, { name: framework, confidence, evidence: [evidence] });
  }
}
