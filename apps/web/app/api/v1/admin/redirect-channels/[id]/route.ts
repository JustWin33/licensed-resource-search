import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import {
  setRedirectChannelEnabled,
  updateRedirectChannelSchema,
} from '@web/src/server/link-operations-service';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('settings.write');
    await requireCsrf(request);
    const input = updateRedirectChannelSchema.parse(await request.json());
    const result = await setRedirectChannelEnabled(
      (await context.params).id,
      input.isEnabled,
      actor,
      id,
    );
    return Response.json({ data: result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
