const commonPasswords = new Set(['123456789012', 'administrator', 'password123!', 'qwertyuiop123']);

export function adminPasswordViolations(password: string, identifiers: string[] = []): string[] {
  const violations: string[] = [];
  if (password.length < 12) violations.push('密码至少 12 个字符');
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\p{Letter}\p{Number}]/u].filter((pattern) =>
    pattern.test(password),
  ).length;
  if (classes < 3) violations.push('密码需包含大小写字母、数字、符号中的至少三类');
  const normalized = password.toLowerCase();
  if (commonPasswords.has(normalized)) violations.push('密码过于常见');
  if (
    identifiers.some((identifier) => {
      const value = identifier.trim().toLowerCase();
      return value.length >= 3 && normalized.includes(value);
    })
  ) {
    violations.push('密码不能包含用户名或邮箱');
  }
  return violations;
}
