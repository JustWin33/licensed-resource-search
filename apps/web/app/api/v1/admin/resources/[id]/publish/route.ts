import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { publishResource, publishResourceSchema } from '@web/src/server/resource-service';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('resource.publish');
    await requireCsrf(request);
    const input = publishResourceSchema.parse(await request.json());
    const resource = await publishResource(
      (await context.params).id,
      input.expectedVersion,
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
