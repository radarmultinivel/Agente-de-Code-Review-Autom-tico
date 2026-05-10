const { formatComment, formatCompactSummary, _severityBadge, _issuesTable, _secretsFoundTable } = require('../src/formatter');

describe('_severityBadge', () => {
  it('should return critical badge', () => {
    const badge = _severityBadge('critical');
    expect(badge).toContain('critical');
    expect(badge).toContain('dc3545');
  });

  it('should return high badge', () => {
    const badge = _severityBadge('high');
    expect(badge).toContain('high');
    expect(badge).toContain('fd7e14');
  });

  it('should return default badge for unknown severity', () => {
    const badge = _severityBadge('unknown');
    expect(badge).toContain('unknown');
    expect(badge).toContain('6c757d');
  });
});

describe('_issuesTable', () => {
  it('should return empty string for empty issues', () => {
    expect(_issuesTable([], 'Test')).toBe('');
  });

  it('should render a table row for each issue', () => {
    const issues = [
      { severity: 'high', file: 'src/app.js', line: 42, title: 'XSS Vulnerability', description: 'Unescaped output' },
    ];
    const table = _issuesTable(issues, 'Security');
    expect(table).toContain('### Security (1)');
    expect(table).toContain('src/app.js');
    expect(table).toContain('L42');
    expect(table).toContain('XSS Vulnerability');
  });
});

describe('_secretsFoundTable', () => {
  it('should return empty string for no secrets', () => {
    expect(_secretsFoundTable([])).toBe('');
  });

  it('should render secret entries', () => {
    const secrets = [
      { severity: 'critical', file: '.env', line: 5, type: 'api_key', value_preview: 'sk-1234abc', description: 'Hardcoded API key' },
    ];
    const table = _secretsFoundTable(secrets);
    expect(table).toContain('Secrets Found');
    expect(table).toContain('sk-1234abc');
    expect(table).toContain('.env');
  });
});

describe('formatCompactSummary', () => {
  it('should return clean when no issues', () => {
    const analysis = { security_issues: [], performance_issues: [], secrets_found: [] };
    const result = formatCompactSummary(analysis);
    expect(result.summary).toBe('✅ No issues found');
    expect(result.total).toBe(0);
  });

  it('should count issues correctly', () => {
    const analysis = {
      security_issues: [{ severity: 'critical' }, { severity: 'high' }],
      performance_issues: [{ severity: 'medium' }],
      secrets_found: [{ severity: 'critical' }],
    };
    const result = formatCompactSummary(analysis);
    expect(result.total).toBe(4);
    expect(result.critical).toBe(2);
    expect(result.high).toBe(1);
  });
});

describe('formatComment', () => {
  it('should generate clean message when no issues found', () => {
    const analysis = { summary: 'All good', security_issues: [], performance_issues: [], secrets_found: [] };
    const comment = formatComment(analysis, { repo: 'test/repo', prNumber: 1, filesAnalyzed: 3 });
    expect(comment).toContain('Clean Code');
    expect(comment).toContain('test/repo');
    expect(comment).toContain('#1');
  });

  it('should include all issue sections', () => {
    const analysis = {
      summary: 'Issues found',
      security_issues: [{ severity: 'critical', file: 'a.js', line: 1, title: 'SQLi', description: 'desc', category: 'injection', recommendation: 'fix' }],
      performance_issues: [{ severity: 'high', file: 'b.js', line: 2, title: 'Slow loop', description: 'desc', category: 'performance', recommendation: 'fix' }],
      secrets_found: [{ severity: 'critical', file: 'c.js', line: 3, type: 'password', value_preview: 'pass', description: 'desc', recommendation: 'fix' }],
    };
    const comment = formatComment(analysis, { repo: 'test/repo', prNumber: 2, filesAnalyzed: 5 });
    expect(comment).toContain('Security Issues');
    expect(comment).toContain('Performance Issues');
    expect(comment).toContain('Secrets Found');
    expect(comment).toContain('Reviewed by');
  });

  it('should include parse warning if present', () => {
    const analysis = {
      summary: 'Partial',
      security_issues: [],
      performance_issues: [],
      secrets_found: [],
      _parseError: 'Unexpected token',
    };
    const comment = formatComment(analysis);
    expect(comment).toContain('Parse Warning');
    expect(comment).toContain('Unexpected token');
  });
});
