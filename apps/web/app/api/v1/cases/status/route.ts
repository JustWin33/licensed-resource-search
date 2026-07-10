import { getCaseStatus } from '@web/src/server/governance-service';
import { errorResponse, requestId } from '@web/src/server/http';
import { enforceRateLimit } from '@web/src/server/rate-limit';
import { requirePublicCsrf } from '@web/src/server/public-csrf';
import { z } from 'zod';

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    await enforceRateLimit(request, { scope: 'case-status', limit: 30, windowSeconds: 3600 });
    await requirePublicCsrf(request);
    const { token } = schema.parse(await request.json());
    return Response.json(
      { data: await getCaseStatus(token), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
