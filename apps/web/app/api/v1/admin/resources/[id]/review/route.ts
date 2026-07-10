import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { reviewResource, reviewResourceSchema } from '@web/src/server/resource-service';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('resource.review');
    await requireCsrf(request);
    const resourceId = (await context.params).id;
    const resource = await reviewResource(
      resourceId,
      reviewResourceSchema.parse(await request.json()),
      actor,
      id,
    );
    return Response.json(
      { data: resource, requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
