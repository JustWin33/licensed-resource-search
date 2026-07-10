import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { expireBlocklistEntry } from '@web/src/server/governance-service';
import { errorResponse, requestId } from '@web/src/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('governance.handle');
    await requireCsrf(request);
    const result = await expireBlocklistEntry((await context.params).id, actor, id);
    return Response.json({ data: result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
