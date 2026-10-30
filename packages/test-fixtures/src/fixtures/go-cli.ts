import { writeTree, type FileTree } from '../write-tree.js';

/** A small Go command-line tool with GitHub Actions CI and a `_test.go` file. */
export function goCliTree(): FileTree {
  return {
    'go.mod': 'module github.com/acme/linkcheck\n\ngo 1.22\n',
    LICENSE: 'Apache License 2.0\n',
    '.github/workflows/ci.yml': [
      'name: CI',
      'on: [push]',
      'jobs:',
      '  test:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - run: go test ./...',
      '',
    ].join('\n'),
    'cmd/linkcheck/main.go': [
      'package main',
      '',
      'import "fmt"',
      '',
      'func main() {',
      '\tfmt.Println("linkcheck")',
      '}',
      '',
    ].join('\n'),
    'internal/links/links.go': [
      'package links',
      '',
      '// IsAbsolute reports whether a link has a scheme.',
      'func IsAbsolute(link string) bool {',
      '\treturn len(link) > 7 && link[:7] == "http://"',
      '}',
      '',
    ].join('\n'),
    'internal/links/links_test.go': [
      'package links',
      '',
      'import "testing"',
      '',
      'func TestIsAbsolute(t *testing.T) {',
      '\tif !IsAbsolute("http://example.com") {',
      '\t\tt.Fatal("expected absolute")',
      '\t}',
      '}',
      '',
    ].join('\n'),
  };
}

export async function buildGoCliFixture(root: string): Promise<void> {
  await writeTree(root, goCliTree());
}
