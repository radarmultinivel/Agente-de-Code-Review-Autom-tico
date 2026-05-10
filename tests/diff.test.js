const { shouldIgnoreFile, extractChangedFiles, buildDiffText } = require('../src/diff');

describe('shouldIgnoreFile', () => {
  it('should ignore package-lock.json', () => {
    expect(shouldIgnoreFile('package-lock.json')).toBe(true);
  });

  it('should ignore yarn.lock', () => {
    expect(shouldIgnoreFile('yarn.lock')).toBe(true);
  });

  it('should ignore node_modules paths', () => {
    expect(shouldIgnoreFile('node_modules/foo/index.js')).toBe(true);
  });

  it('should ignore dist/ build artifacts', () => {
    expect(shouldIgnoreFile('dist/bundle.js')).toBe(true);
  });

  it('should ignore .env files', () => {
    expect(shouldIgnoreFile('.env')).toBe(true);
  });

  it('should ignore minified files', () => {
    expect(shouldIgnoreFile('bundle.min.js')).toBe(true);
  });

  it('should ignore source map files', () => {
    expect(shouldIgnoreFile('bundle.js.map')).toBe(true);
  });

  it('should NOT ignore regular source files', () => {
    expect(shouldIgnoreFile('src/index.js')).toBe(false);
  });

  it('should NOT ignore test files', () => {
    expect(shouldIgnoreFile('tests/foo.test.js')).toBe(false);
  });

  it('should NOT ignore markdown files', () => {
    expect(shouldIgnoreFile('README.md')).toBe(false);
  });

  it('should handle Windows-style paths in node_modules', () => {
    expect(shouldIgnoreFile('node_modules\\lodash\\index.js')).toBe(true);
  });
});

describe('extractChangedFiles', () => {
  it('should return empty array for empty input', () => {
    expect(extractChangedFiles([])).toEqual([]);
  });

  it('should filter out ignored files', () => {
    const files = [
      { filename: 'src/index.js', status: 'modified', additions: 5, deletions: 2, changes: 7, patch: '+test', contents_url: 'https://api.github.com/repos/foo/bar/contents/src/index.js' },
      { filename: 'package-lock.json', status: 'modified', additions: 100, deletions: 100, changes: 200, patch: '+lock', contents_url: 'https://api.github.com/repos/foo/bar/contents/package-lock.json' },
    ];
    const result = extractChangedFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('src/index.js');
  });

  it('should throw for non-array input', () => {
    expect(() => extractChangedFiles(null)).toThrow('pullRequestFiles must be an array');
  });

  it('should include patch even when empty', () => {
    const files = [
      { filename: 'src/index.js', status: 'modified', additions: 0, deletions: 0, changes: 0, patch: undefined, contents_url: 'url' },
    ];
    const result = extractChangedFiles(files);
    expect(result[0].patch).toBe('');
  });
});

describe('buildDiffText', () => {
  it('should format a single file diff', () => {
    const files = [
      { filename: 'src/app.js', status: 'modified', additions: 3, deletions: 1, changes: 4, patch: '+console.log("hello")' },
    ];
    const result = buildDiffText(files);
    expect(result).toContain('=== File: src/app.js');
    expect(result).toContain('+console.log("hello")');
  });

  it('should handle empty files array', () => {
    expect(buildDiffText([])).toBe('');
  });
});
