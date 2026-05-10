require('dotenv').config();
const { GitHubClient } = require('./github');
const { GeminiClient } = require('./gemini');
const { extractChangedFiles, buildDiffText } = require('./diff');
const { formatComment, formatCompactSummary } = require('./formatter');

function getConfig() {
  const {
    GITHUB_TOKEN,
    GEMINI_API_KEY,
    GITHUB_OWNER,
    GITHUB_REPO,
    PR_NUMBER,
    GEMINI_MODEL,
  } = process.env;

  const errors = [];
  if (!GITHUB_TOKEN) errors.push('GITHUB_TOKEN');
  if (!GEMINI_API_KEY) errors.push('GEMINI_API_KEY');
  if (!GITHUB_OWNER) errors.push('GITHUB_OWNER');
  if (!GITHUB_REPO) errors.push('GITHUB_REPO');
  if (!PR_NUMBER) errors.push('PR_NUMBER');

  if (errors.length > 0) {
    throw new Error(`Missing required environment variables: ${errors.join(', ')}`);
  }

  return {
    githubToken: GITHUB_TOKEN,
    geminiApiKey: GEMINI_API_KEY,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    prNumber: parseInt(PR_NUMBER, 10),
    geminiModel: GEMINI_MODEL || 'gemini-1.5-flash',
  };
}

async function runReview(config) {
  const github = new GitHubClient(config.githubToken);
  const gemini = new GeminiClient(config.geminiApiKey, config.geminiModel);

  console.log(`Fetching PR #${config.prNumber} from ${config.owner}/${config.repo}...`);
  const prFiles = await github.getPullRequestFiles(config.owner, config.repo, config.prNumber);
  console.log(`Found ${prFiles.length} file(s) in the PR`);

  const changedFiles = extractChangedFiles(prFiles);
  console.log(`Analyzing ${changedFiles.length} file(s) after filtering`);

  if (changedFiles.length === 0) {
    const message = 'No analyzable files found in this pull request (all files were filtered out).';
    await github.postReviewComment(config.owner, config.repo, config.prNumber, `## 🤖 Gemini PR Review\n\n${message}`);
    console.log(message);
    return { summary: message, total: 0 };
  }

  const diffText = buildDiffText(changedFiles);
  console.log('Sending diff to Gemini for analysis...');

  const analysis = await gemini.analyzeDiff(diffText);

  const comment = formatComment(analysis, {
    repo: `${config.owner}/${config.repo}`,
    prNumber: config.prNumber,
    filesAnalyzed: changedFiles.length,
  });

  console.log('Posting review comment to GitHub...');
  await github.postReviewComment(config.owner, config.repo, config.prNumber, comment);

  const compactSummary = formatCompactSummary(analysis);
  console.log(`\n✅ Review complete: ${compactSummary.summary}`);

  return compactSummary;
}

async function main() {
  try {
    const config = getConfig();
    const result = await runReview(config);

    if (result.critical > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Review failed:', error.message);

    if (error.status === 403) {
      console.error('Rate limit hit or insufficient permissions. Check your GITHUB_TOKEN.');
    } else if (error.message && error.message.includes('fetch failed')) {
      console.error('Network error. Check your internet connection and API endpoints.');
    } else if (error.response && error.response.promptFeedback) {
      console.error('Gemini API error:', error.response.promptFeedback);
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { runReview, getConfig, main };
