# Gemini PR Reviewer

An AI-powered Pull Request reviewer that automatically analyzes code changes for **security vulnerabilities** and **performance issues** using Google's Gemini 1.5 Pro/Flash models.

## Features

- **🔍 Automated Code Review**: Analyzes every PR diff for security and performance issues before human review
- **🛡️ Security Analysis**: Detects OWASP Top 10 vulnerabilities, hardcoded secrets, injection flaws, and authentication issues
- **⚡ Performance Analysis**: Identifies O(n²) loops, synchronous I/O in async contexts, memory leaks, and unoptimized database queries
- **🔑 Secrets Detection**: Catches leaked API keys, passwords, tokens, certificates, and connection strings
- **📊 Structured Output**: Posts formatted comments with severity badges, file locations, and fix recommendations
- **🚫 Smart File Filtering**: Automatically ignores lock files, minified assets, build artifacts, and dependency directories

## Use Cases

| Scenario | Benefit |
|----------|---------|
| **CI/CD Pipeline** | Automatic security gate — block PRs with critical vulnerabilities |
| **Tech Lead Review** | Pre-screening before manual review, focusing human attention on high-risk areas |
| **Onboarding Audit** | Catch common security mistakes from new contributors |
| **Compliance Checks** | Enforce secure coding standards (OWASP, SOC2, PCI-DSS) |
| **Performance Regression** | Detect performance degradation before it reaches production |

## Architecture

```
                    ┌─────────────┐
                    │   GitHub PR  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  index.js   │
                    │  (Orchestrator)│
                    └──┬───┬───┬──┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
        ┌─────────┐ ┌──────────┐ ┌──────────┐
        │ github  │ │  gemini  │ │  diff    │
        │ (Octokit)│ │ (Gen AI) │ │ (filter) │
        └─────────┘ └──────────┘ └──────────┘
              │            │            │
              ▼            ▼            ▼
        ┌──────────────────────────────────┐
        │           formatter              │
        │    (Markdown Comment Builder)    │
        └──────────────┬───────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  PR Comment    │
              └────────────────┘
```

## Installation

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://makersuite.google.com/app/apikey)
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (with `repo` scope)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/gemini-pr-reviewer.git
cd gemini-pr-reviewer

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your tokens and repository info
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `repo` scope |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GITHUB_OWNER` | ✅ | Repository owner (user or org) |
| `GITHUB_REPO` | ✅ | Repository name |
| `PR_NUMBER` | ✅ | Pull Request number to review |
| `GEMINI_MODEL` | ❌ | Model: `gemini-1.5-flash` (default) or `gemini-1.5-pro` |

## Usage

### Local Execution

```bash
# Set your environment variables
export GITHUB_TOKEN=ghp_xxxx
export GEMINI_API_KEY=AIza_xxxx
export GITHUB_OWNER=my-org
export GITHUB_REPO=my-repo
export PR_NUMBER=42

# Run the review
npm start
```

Or create a `.env` file:

```bash
cp .env.example .env
# Fill in your values
npm start
```

### GitHub Actions (Recommended)

Create `.github/workflows/pr-review.yml` in your repository:

```yaml
name: Gemini PR Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Gemini PR Review
        uses: your-org/gemini-pr-reviewer@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          GITHUB_OWNER: ${{ github.repository_owner }}
          GITHUB_REPO: ${{ github.event.repository.name }}
```

> **Note:** The built-in `GITHUB_TOKEN` from GitHub Actions has read-only permissions for pull requests from forked repos. For full functionality on forks, use a Personal Access Token stored in repository secrets.

## Output Example

The reviewer posts a comment like this on the PR:

```
## 🤖 Gemini PR Review
Summary: Found 3 security issues and 1 performance bottleneck.

### 🔑 Secrets Found (1)
| # | File | Severity | Type | Preview | Description |
|---|------|----------|------|---------|-------------|
| 1 | config.js:42 | ![critical] | api_key | sk-1234abc... | Hardcoded Stripe API key |

### 🛡️ Security Issues (2)
| # | File | Severity | Issue | Description |
|---|------|----------|-------|-------------|
| 1 | src/db.js:15 | ![high] | SQL Injection | Raw user input concatenated into query string |
| 2 | src/auth.js:88 | ![medium] | Broken Auth | Weak password hashing algorithm (MD5) |

### ⚡ Performance Issues (1)
| # | File | Severity | Issue | Description |
|---|------|----------|-------|-------------|
| 1 | src/processor.js:200 | ![high] | O(n²) Loop | Nested loop over 10k items causes quadratic slowdown |
```

## Development

### Running Tests

```bash
# Run all tests with coverage
npm test

# Watch mode
npm run test:watch
```

### Project Structure

```
├── src/
│   ├── index.js          # Entry point and orchestrator
│   ├── github.js         # GitHub API client (Octokit)
│   ├── gemini.js         # Gemini AI client
│   ├── diff.js           # Diff extraction and file filtering
│   └── formatter.js      # Comment formatting
├── tests/
│   ├── diff.test.js
│   ├── gemini.test.js
│   ├── github.test.js
│   ├── formatter.test.js
│   └── index.test.js
├── .env.example
├── package.json
└── README.md
```

## Error Handling

The reviewer handles these scenarios gracefully:

| Scenario | Behavior |
|----------|----------|
| **API Rate Limits** | Catches HTTP 403, logs clear message |
| **Network Failure** | Detects fetch failures with descriptive error |
| **Empty PR (all filtered)** | Posts "no analyzable files" comment |
| **Malformed AI Response** | Falls back with raw output and warning |
| **Missing Environment** | Throws on startup with list of missing vars |
| **Gemini API Errors** | Propagates with prompt feedback details |

## License

MIT
