export function slugifyTitle(title: string, suffix: string): string {
  const normalized = title
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return `${normalized || 'resource'}-${suffix.toLowerCase()}`;
}

export function decodeSlugParam(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length >= 2 &&
      decoded.length <= 180 &&
      /^[\p{Letter}\p{Number}-]+$/u.test(decoded)
      ? decoded
      : null;
  } catch {
    return null;
  }
}
