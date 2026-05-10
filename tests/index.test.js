const { getConfig } = require('../src/index');

jest.mock('../src/github', () => {
  const mockGitHubClient = jest.fn();
  mockGitHubClient.mockImplementation(() => ({
    getPullRequestFiles: jest.fn(),
    postReviewComment: jest.fn(),
  }));
  return { GitHubClient: mockGitHubClient };
});

jest.mock('../src/gemini', () => {
  const mockGeminiClient = jest.fn();
  mockGeminiClient.mockImplementation(() => ({
    analyzeDiff: jest.fn(),
  }));
  return { GeminiClient: mockGeminiClient };
});

jest.mock('../src/diff', () => ({
  extractChangedFiles: jest.fn(),
  buildDiffText: jest.fn(),
}));

const { GitHubClient } = require('../src/github');
const { GeminiClient } = require('../src/gemini');
const { extractChangedFiles, buildDiffText } = require('../src/diff');
const { runReview } = require('../src/index');

describe('getConfig', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should parse valid config from environment', () => {
    process.env.GITHUB_TOKEN = 'gh_token';
    process.env.GEMINI_API_KEY = 'ai_key';
    process.env.GITHUB_OWNER = 'test-owner';
    process.env.GITHUB_REPO = 'test-repo';
    process.env.PR_NUMBER = '42';

    const config = getConfig();
    expect(config.githubToken).toBe('gh_token');
    expect(config.geminiApiKey).toBe('ai_key');
    expect(config.owner).toBe('test-owner');
    expect(config.repo).toBe('test-repo');
    expect(config.prNumber).toBe(42);
  });

  it('should use default gemini model when not specified', () => {
    process.env.GITHUB_TOKEN = 'x';
    process.env.GEMINI_API_KEY = 'x';
    process.env.GITHUB_OWNER = 'x';
    process.env.GITHUB_REPO = 'x';
    process.env.PR_NUMBER = '1';

    const config = getConfig();
    expect(config.geminiModel).toBe('gemini-1.5-flash');
  });

  it('should throw when required vars are missing', () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
    delete process.env.PR_NUMBER;

    expect(() => getConfig()).toThrow(/Missing required environment variables/);
  });
});

describe('runReview', () => {
  const mockConfig = {
    githubToken: 'gh_token',
    geminiApiKey: 'ai_key',
    owner: 'owner',
    repo: 'repo',
    prNumber: 1,
    geminiModel: 'gemini-1.5-flash',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete review flow successfully', async () => {
    GitHubClient.mockImplementation(() => ({
      getPullRequestFiles: jest.fn().mockResolvedValue([{ filename: 'src/app.js', status: 'modified', additions: 5, deletions: 2, changes: 7, patch: '+test', contents_url: 'url' }]),
      postReviewComment: jest.fn().mockResolvedValue({ id: 1 }),
    }));

    GeminiClient.mockImplementation(() => ({
      analyzeDiff: jest.fn().mockResolvedValue({
        summary: 'No issues found',
        security_issues: [],
        performance_issues: [],
        secrets_found: [],
      }),
    }));

    extractChangedFiles.mockReturnValue([{ filename: 'src/app.js', status: 'modified', additions: 5, deletions: 2, changes: 7, patch: '+test', rawUrl: 'url' }]);
    buildDiffText.mockReturnValue('diff content');

    const result = await runReview(mockConfig);
    expect(result).toBeDefined();
    expect(result.summary).toBe('✅ No issues found');
  });

  it('should handle empty PR gracefully', async () => {
    const mockPostComment = jest.fn().mockResolvedValue({ id: 1 });

    GitHubClient.mockImplementation(() => ({
      getPullRequestFiles: jest.fn().mockResolvedValue([{ filename: 'package-lock.json', status: 'modified', additions: 100, deletions: 100, changes: 200, patch: '', contents_url: 'url' }]),
      postReviewComment: mockPostComment,
    }));

    extractChangedFiles.mockReturnValue([]);

    const result = await runReview(mockConfig);
    expect(result.summary).toContain('No analyzable files');
    expect(mockPostComment).toHaveBeenCalled();
  });

  it('should propagate errors from GitHub API', async () => {
    GitHubClient.mockImplementation(() => ({
      getPullRequestFiles: jest.fn().mockRejectedValue(new Error('API rate limit exceeded')),
    }));

    await expect(runReview(mockConfig)).rejects.toThrow('API rate limit exceeded');
  });
});
