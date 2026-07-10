import { createReport, reportSchema } from '@web/src/server/governance-service';
import { errorResponse, requestId } from '@web/src/server/http';
import { requirePublicCsrf } from '@web/src/server/public-csrf';
import { enforceRateLimit } from '@web/src/server/rate-limit';

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    await enforceRateLimit(request, { scope: 'report', limit: 10, windowSeconds: 3600 });
    await requirePublicCsrf(request);
    const result = await createReport(reportSchema.parse(await request.json()));
    return Response.json({ data: result, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
