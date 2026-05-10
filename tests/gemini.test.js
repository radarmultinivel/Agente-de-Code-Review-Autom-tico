const { GeminiClient } = require('../src/gemini');

jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  const mockGetGenerativeModel = jest.fn(() => ({
    generateContent: mockGenerateContent,
  }));

  return {
    GoogleGenerativeAI: jest.fn(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    })),
    mockGenerateContent,
    mockGetGenerativeModel,
  };
});

const { mockGenerateContent } = require('@google/generative-ai');

describe('GeminiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw if no API key provided', () => {
    expect(() => new GeminiClient()).toThrow('GEMINI_API_KEY is required');
  });

  it('should return empty analysis for empty diff', async () => {
    const client = new GeminiClient('fake-key');
    const result = await client.analyzeDiff('');
    expect(result.summary).toBe('No code changes to analyze.');
    expect(result.security_issues).toEqual([]);
  });

  it('should return empty analysis for whitespace-only diff', async () => {
    const client = new GeminiClient('fake-key');
    const result = await client.analyzeDiff('   \n  \t  ');
    expect(result.summary).toBe('No code changes to analyze.');
  });

  it('should parse valid JSON response from Gemini', async () => {
    const mockJson = JSON.stringify({
      summary: 'Found SQL injection vulnerability',
      security_issues: [
        {
          severity: 'critical',
          file: 'src/db.js',
          line: 15,
          category: 'injection',
          title: 'SQL Injection',
          description: 'User input concatenated into query',
          recommendation: 'Use parameterized queries',
        },
      ],
      performance_issues: [],
      secrets_found: [],
    });

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => mockJson },
    });

    const client = new GeminiClient('fake-key');
    const result = await client.analyzeDiff('some diff content');

    expect(result.summary).toBe('Found SQL injection vulnerability');
    expect(result.security_issues).toHaveLength(1);
    expect(result.security_issues[0].title).toBe('SQL Injection');
    expect(result.security_issues[0].severity).toBe('critical');
  });

  it('should handle JSON wrapped in markdown code blocks', async () => {
    const mockJson = '```json\n{"summary": "test", "security_issues": [], "performance_issues": [], "secrets_found": []}\n```';

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => mockJson },
    });

    const client = new GeminiClient('fake-key');
    const result = await client.analyzeDiff('diff');

    expect(result.summary).toBe('test');
  });

  it('should handle malformed JSON gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => '{invalid json}' },
    });

    const client = new GeminiClient('fake-key');
    const result = await client.analyzeDiff('diff');

    expect(result.summary).toBe('Analysis completed but response parsing failed.');
    expect(result.security_issues).toEqual([]);
    expect(result._parseError).toBeDefined();
    expect(result._raw).toBe('{invalid json}');
  });

  it('should handle API errors gracefully', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'));

    const client = new GeminiClient('fake-key');
    await expect(client.analyzeDiff('some code')).rejects.toThrow('API quota exceeded');
  });
});
