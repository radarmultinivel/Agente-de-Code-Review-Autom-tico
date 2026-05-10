const { GitHubClient } = require('../src/github');

const mockListFiles = jest.fn();
const mockCreateComment = jest.fn();
const mockGetPr = jest.fn();
const mockUpdateCheck = jest.fn();
const mockCreateCheck = jest.fn();

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({
    rest: {
      pulls: {
        listFiles: mockListFiles,
        get: mockGetPr,
      },
      issues: {
        createComment: mockCreateComment,
      },
      checks: {
        update: mockUpdateCheck,
        create: mockCreateCheck,
      },
    },
  })),
}));

describe('GitHubClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw if no token provided', () => {
    expect(() => new GitHubClient()).toThrow('GITHUB_TOKEN is required');
  });

  it('should get pull request files', async () => {
    const mockFiles = [{ filename: 'src/index.js', status: 'modified' }];
    mockListFiles.mockResolvedValueOnce({ data: mockFiles });

    const client = new GitHubClient('fake-token');
    const files = await client.getPullRequestFiles('owner', 'repo', 1);

    expect(files).toEqual(mockFiles);
    expect(mockListFiles).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 1,
      per_page: 100,
    });
  });

  it('should paginate when PR has 100+ files', async () => {
    const page1 = Array(100).fill({ filename: 'file.js', status: 'modified' });
    const page2 = [{ filename: 'extra.js', status: 'added' }];
    const page3 = [];

    mockListFiles
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 })
      .mockResolvedValueOnce({ data: page3 });

    const client = new GitHubClient('fake-token');
    const files = await client.getPullRequestFiles('owner', 'repo', 1);

    expect(files).toHaveLength(101);
    expect(mockListFiles).toHaveBeenCalledTimes(3);
  });

  it('should post a review comment', async () => {
    const mockComment = { id: 123, body: 'review body' };
    mockCreateComment.mockResolvedValueOnce({ data: mockComment });

    const client = new GitHubClient('fake-token');
    const result = await client.postReviewComment('owner', 'repo', 1, 'review body');

    expect(result).toEqual(mockComment);
    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 1,
      body: 'review body',
    });
  });

  it('should get pull request details', async () => {
    const mockPr = { id: 1, title: 'Test PR' };
    mockGetPr.mockResolvedValueOnce({ data: mockPr });

    const client = new GitHubClient('fake-token');
    const result = await client.getPullRequest('owner', 'repo', 1);

    expect(result).toEqual(mockPr);
  });

  it('should handle API errors', async () => {
    mockListFiles.mockRejectedValueOnce(new Error('Not Found'));

    const client = new GitHubClient('fake-token');
    await expect(client.getPullRequestFiles('owner', 'repo', 999)).rejects.toThrow('Not Found');
  });
});
