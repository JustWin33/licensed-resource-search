import { z } from 'zod';
import { getServerEnv } from '@web/src/server-env';
import { errorResponse, requestId } from '@web/src/server/http';
import { ANALYTICS_COOKIE } from '@web/src/server/privacy';
import { requirePublicCsrf } from '@web/src/server/public-csrf';

const schema = z.object({ enabled: z.boolean() });

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    await requirePublicCsrf(request);
    const { enabled } = schema.parse(await request.json());
    const secure = getServerEnv().APP_ENV === 'production' ? '; Secure' : '';
    return Response.json(
      { data: { enabled }, requestId: id },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': `${ANALYTICS_COOKIE}=${enabled ? 'on' : 'off'}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`,
        },
      },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
