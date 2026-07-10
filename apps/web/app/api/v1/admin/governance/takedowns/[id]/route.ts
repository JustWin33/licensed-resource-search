import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import {
  updateTakedownStatus,
  updateTakedownStatusSchema,
} from '@web/src/server/governance-service';
import { errorResponse, requestId } from '@web/src/server/http';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('governance.handle');
    await requireCsrf(request);
    const input = updateTakedownStatusSchema.parse(await request.json());
    const result = await updateTakedownStatus((await context.params).id, input, actor, id);
    return Response.json({ data: result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
