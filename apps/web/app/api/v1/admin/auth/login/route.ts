import { z } from 'zod';
import { loginAdmin, publicIdentity } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { enforceRateLimit } from '@web/src/server/rate-limit';

const schema = z.object({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(12).max(1024),
});

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = schema.parse(await request.json());
    await enforceRateLimit(request, {
      scope: 'admin-login-client',
      limit: 20,
      windowSeconds: 15 * 60,
    });
    await enforceRateLimit(request, {
      scope: 'admin-login-account',
      limit: 5,
      windowSeconds: 15 * 60,
      subject: input.identifier,
    });
    const identity = await loginAdmin(input.identifier, input.password, id);
    return Response.json(
      { data: publicIdentity(identity), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
