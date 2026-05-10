const { Octokit } = require('@octokit/rest');

class GitHubClient {
  constructor(token) {
    if (!token) {
      throw new Error('GITHUB_TOKEN is required');
    }
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequestFiles(owner, repo, prNumber) {
    const { data } = await this.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    let allFiles = data;

    if (data.length === 100) {
      for (let page = 2; ; page++) {
        const { data: nextPage } = await this.octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: prNumber,
          per_page: 100,
          page,
        });
        if (nextPage.length === 0) break;
        allFiles = allFiles.concat(nextPage);
      }
    }

    return allFiles;
  }

  async postReviewComment(owner, repo, prNumber, body) {
    const { data } = await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    return data;
  }

  async getPullRequest(owner, repo, prNumber) {
    const { data } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  async updateCheckRun(owner, repo, checkRunId, conclusion, output) {
    return this.octokit.rest.checks.update({
      owner,
      repo,
      check_run_id: checkRunId,
      conclusion,
      output,
    });
  }

  async createCheckRun(owner, repo, headSha, conclusion, output) {
    return this.octokit.rest.checks.create({
      owner,
      repo,
      name: 'Gemini PR Review',
      head_sha: headSha,
      status: 'completed',
      conclusion,
      output,
    });
  }
}

module.exports = { GitHubClient };
