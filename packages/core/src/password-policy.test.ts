import { describe, expect, it } from 'vitest';
import { adminPasswordViolations } from './password-policy';

describe('admin password policy', () => {
  it('accepts a long mixed password unrelated to the account', () => {
    expect(adminPasswordViolations('Correct-Horse-2026!', ['reviewer'])).toEqual([]);
  });

  it('rejects weak and account-derived passwords', () => {
    expect(adminPasswordViolations('administrator', ['admin']).length).toBeGreaterThan(0);
    expect(adminPasswordViolations('Reviewer-2026!', ['reviewer'])).toContain(
      '密码不能包含用户名或邮箱',
    );
  });
});
