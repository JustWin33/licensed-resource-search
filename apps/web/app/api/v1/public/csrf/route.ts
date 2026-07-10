import { getServerEnv } from '@web/src/server-env';
import { newPublicCsrfToken, PUBLIC_CSRF_COOKIE } from '@web/src/server/public-csrf';

export async function GET() {
  const token = newPublicCsrfToken();
  const secure = getServerEnv().APP_ENV === 'production' ? '; Secure' : '';
  return Response.json(
    { data: { token } },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${PUBLIC_CSRF_COOKIE}=${token}; Path=/; Max-Age=7200; SameSite=Strict${secure}`,
      },
    },
  );
}
