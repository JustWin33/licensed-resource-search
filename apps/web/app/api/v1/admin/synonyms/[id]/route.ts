import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { toggleSettingSchema, toggleSynonym } from '@web/src/server/search-settings-service';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('settings.write');
    await requireCsrf(request);
    const input = toggleSettingSchema.parse(await request.json());
    const row = await toggleSynonym((await context.params).id, input.isEnabled, actor, id);
    return Response.json(
      { data: row, requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
