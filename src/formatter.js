function _severityBadge(severity) {
  const colors = {
    critical: '#dc3545',
    high: '#fd7e14',
    medium: '#ffc107',
    low: '#28a745',
  };
  const color = colors[severity] || '#6c757d';
  return `![${severity}](https://img.shields.io/badge/-${severity}-${color.slice(1)})`;
}

function _issuesTable(issues, typeLabel) {
  if (!issues || issues.length === 0) return '';

  const rows = issues
    .map((issue, index) => {
      const file = issue.file ? `\`${issue.file}\`` : 'Unknown';
      const line = issue.line ? `L${issue.line}` : 'N/A';
      const badge = _severityBadge(issue.severity);
      return `| ${index + 1} | ${file}:${line} | ${badge} | **${issue.title}** | ${issue.description} |`;
    })
    .join('\n');

  return `### ${typeLabel} (${issues.length})
| # | File | Severity | Issue | Description |
|---|------|----------|-------|-------------|
${rows}
`;
}

function _secretsFoundTable(secrets) {
  if (!secrets || secrets.length === 0) return '';

  const rows = secrets
    .map((secret, index) => {
      const file = secret.file ? `\`${secret.file}\`` : 'Unknown';
      const line = secret.line ? `L${secret.line}` : 'N/A';
      const preview = secret.value_preview
        ? `\`${secret.value_preview}...\``
        : 'N/A';
      return `| ${index + 1} | ${file}:${line} | ${_severityBadge('critical')} | \`${secret.type}\` | ${preview} | ${secret.description} |`;
    })
    .join('\n');

  return `### 🔑 Secrets Found (${secrets.length})
| # | File | Severity | Type | Preview | Description |
|---|------|----------|------|---------|-------------|
${rows}
`;
}

function formatComment(analysis, metadata = {}) {
  const header = `## 🤖 Gemini PR Review
**Summary:** ${analysis.summary || 'No issues found.'}
**Repository:** ${metadata.repo || 'N/A'} | **PR:** #${metadata.prNumber || 'N/A'} | **Files Analyzed:** ${metadata.filesAnalyzed || 0}
`;
  const sections = [];
  const totalIssues =
    (analysis.security_issues || []).length +
    (analysis.performance_issues || []).length +
    (analysis.secrets_found || []).length;

  if (totalIssues === 0) {
    sections.push(`### ✅ Clean Code
No security vulnerabilities, performance issues, or secrets detected in this pull request.`);
  }

  if (analysis.secrets_found && analysis.secrets_found.length > 0) {
    sections.push(_secretsFoundTable(analysis.secrets_found));
  }

  if (analysis.security_issues && analysis.security_issues.length > 0) {
    sections.push(_issuesTable(analysis.security_issues, '🛡️ Security Issues'));
  }

  if (analysis.performance_issues && analysis.performance_issues.length > 0) {
    sections.push(_issuesTable(analysis.performance_issues, '⚡ Performance Issues'));
  }

  if (analysis._parseError) {
    sections.push(`### ⚠️ Parse Warning
The response could not be fully parsed. Please review the raw output manually.
\`\`\`
${analysis._parseError}
\`\`\``);
  }

  sections.push(`---
> _Reviewed by [Gemini PR Reviewer](https://github.com) · ${new Date().toISOString()}_`);

  return header + '\n' + sections.join('\n\n');
}

function formatCompactSummary(analysis) {
  const securityCount = (analysis.security_issues || []).length;
  const perfCount = (analysis.performance_issues || []).length;
  const secretsCount = (analysis.secrets_found || []).length;
  const total = securityCount + perfCount + secretsCount;

  const criticalCount = [
    ...(analysis.security_issues || []),
    ...(analysis.performance_issues || []),
    ...(analysis.secrets_found || []),
  ].filter((i) => i.severity === 'critical').length;

  const highCount = [
    ...(analysis.security_issues || []),
    ...(analysis.performance_issues || []),
    ...(analysis.secrets_found || []),
  ].filter((i) => i.severity === 'high').length;

  if (total === 0) {
    return { summary: '✅ No issues found', total: 0, critical: 0, high: 0 };
  }

  return {
    summary: `Found ${total} issue(s): ${criticalCount} critical, ${highCount} high, ${total - criticalCount - highCount} medium/low`,
    total,
    critical: criticalCount,
    high: highCount,
  };
}

module.exports = { formatComment, formatCompactSummary, _severityBadge, _issuesTable, _secretsFoundTable };
