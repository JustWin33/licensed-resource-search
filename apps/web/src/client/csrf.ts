export function csrfToken(): string {
  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('lrs_admin_csrf='))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : '';
}
