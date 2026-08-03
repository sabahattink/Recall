import type { CiConfiguration, DockerConfiguration } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';

export function detectCi(files: WalkedFile[]): CiConfiguration {
  const configFiles: string[] = [];
  const providers = new Set<string>();

  for (const file of files) {
    if (file.path.startsWith('.github/workflows/') && /\.ya?ml$/.test(file.path)) {
      configFiles.push(file.path);
      providers.add('github-actions');
    } else if (file.path === '.gitlab-ci.yml') {
      configFiles.push(file.path);
      providers.add('gitlab-ci');
    } else if (file.path === '.circleci/config.yml') {
      configFiles.push(file.path);
      providers.add('circleci');
    } else if (file.path === 'azure-pipelines.yml') {
      configFiles.push(file.path);
      providers.add('azure-pipelines');
    }
  }

  return {
    detected: configFiles.length > 0,
    providers: [...providers].sort(),
    configFiles: configFiles.sort(),
  };
}

export function detectDocker(files: WalkedFile[]): DockerConfiguration {
  const dockerFiles = files
    .filter((f) => {
      const name = f.path.split('/').pop() ?? '';
      return (
        name === 'Dockerfile' ||
        name.startsWith('Dockerfile.') ||
        /docker-compose.*\.ya?ml$/i.test(name)
      );
    })
    .map((f) => f.path)
    .sort();

  return { detected: dockerFiles.length > 0, files: dockerFiles };
}
