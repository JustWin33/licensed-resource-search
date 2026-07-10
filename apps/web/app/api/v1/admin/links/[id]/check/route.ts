import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { queueLinkCheck } from '@web/src/server/link-operations-service';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('settings.write');
    await requireCsrf(request);
    const result = await queueLinkCheck((await context.params).id, actor, id);
    return Response.json({ data: result, requestId: id }, { status: 202 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
