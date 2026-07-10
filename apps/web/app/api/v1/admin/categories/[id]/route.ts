import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { updateCategory, updateCategorySchema } from '@web/src/server/taxonomy-service';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('settings.write');
    await requireCsrf(request);
    const category = await updateCategory(
      (await context.params).id,
      updateCategorySchema.parse(await request.json()),
      actor,
      id,
    );
    return Response.json(
      { data: category, requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
