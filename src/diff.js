const IGNORED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile.lock',
  '*.min.js',
  '*.min.css',
  '*.map',
  '.gitignore',
  '.env',
  '.env.example',
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
];

function shouldIgnoreFile(filename) {
  const normalized = filename.replace(/\\/g, '/');
  if (IGNORED_FILES.some((pattern) => {
    if (pattern.endsWith('/')) {
      return normalized.startsWith(pattern) || normalized.includes('/' + pattern);
    }
    if (pattern.startsWith('*.')) {
      return normalized.endsWith(pattern.slice(1));
    }
    return normalized === pattern || normalized.endsWith('/' + pattern);
  })) {
    return true;
  }

  const ignoredDirs = ['node_modules', 'dist', 'build', '.next', '.git'];
  const parts = normalized.split('/');
  return parts.some((part) => ignoredDirs.includes(part));
}

function extractChangedFiles(pullRequestFiles) {
  if (!Array.isArray(pullRequestFiles)) {
    throw new Error('pullRequestFiles must be an array');
  }

  return pullRequestFiles
    .filter((file) => !shouldIgnoreFile(file.filename))
    .map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch || '',
      rawUrl: file.contents_url,
    }));
}

function buildDiffText(changedFiles) {
  return changedFiles
    .map((file) => {
      const header = `=== File: ${file.filename} (${file.status}, +${file.additions}/-${file.deletions}) ===`;
      const patch = file.patch || '(binary or empty file)';
      return `${header}\n${patch}`;
    })
    .join('\n\n');
}

module.exports = {
  shouldIgnoreFile,
  extractChangedFiles,
  buildDiffText,
  IGNORED_FILES,
};
