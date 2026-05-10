const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are a senior security and performance code reviewer. Analyze the provided pull request diff.

Return your analysis as a JSON object with this exact structure:
{
  "summary": "One-line summary of findings",
  "security_issues": [
    {
      "severity": "critical|high|medium|low",
      "file": "path/to/file.js",
      "line": 42,
      "category": "owasp_category_or_issue_type",
      "title": "Short title of the issue",
      "description": "Detailed explanation of the vulnerability",
      "recommendation": "How to fix this issue with code example if applicable"
    }
  ],
  "performance_issues": [
    {
      "severity": "critical|high|medium|low",
      "file": "path/to/file.js",
      "line": 15,
      "category": "performance_issue_type",
      "title": "Short title of the issue",
      "description": "Detailed explanation of the performance bottleneck",
      "recommendation": "How to fix this issue with code example if applicable"
    }
  ],
  "secrets_found": [
    {
      "severity": "critical",
      "file": "path/to/file.js",
      "line": 10,
      "type": "api_key|password|token|certificate|other",
      "value_preview": "First 10 chars of the secret",
      "description": "Description of the leaked secret",
      "recommendation": "How to remediate"
    }
  ]
}

Guidelines:
- Be precise: include exact file paths and line numbers from the diff
- For security: focus on OWASP Top 10 (injection, XSS, broken auth, sensitive data exposure, etc.)
- For performance: look for O(n^2) loops, unoptimized DB queries, sync I/O in async contexts, memory leaks
- For secrets: detect hardcoded API keys, passwords, tokens, connection strings, private keys
- Only report real issues — avoid false positives
- If no issues found in a category, return an empty array
- Respond with ONLY the JSON object, no markdown formatting or code blocks`;

class GeminiClient {
  constructor(apiKey, modelName = 'gemini-1.5-flash') {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async analyzeDiff(diffText) {
    if (!diffText || diffText.trim().length === 0) {
      return {
        summary: 'No code changes to analyze.',
        security_issues: [],
        performance_issues: [],
        secrets_found: [],
      };
    }

    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nHere is the pull request diff to analyze:\n\n${diffText}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const response = result.response;
    const text = response.text();

    return this._parseResponse(text);
  }

  _parseResponse(text) {
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);

      return {
        summary: parsed.summary || 'No summary provided.',
        security_issues: Array.isArray(parsed.security_issues) ? parsed.security_issues : [],
        performance_issues: Array.isArray(parsed.performance_issues) ? parsed.performance_issues : [],
        secrets_found: Array.isArray(parsed.secrets_found) ? parsed.secrets_found : [],
      };
    } catch (parseError) {
      return {
        summary: 'Analysis completed but response parsing failed.',
        security_issues: [],
        performance_issues: [],
        secrets_found: [],
        _raw: text,
        _parseError: parseError.message,
      };
    }
  }
}

module.exports = { GeminiClient, SYSTEM_PROMPT };
