import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import {
  adminResourceEditDto,
  getAdminResource,
  updateResource,
  updateResourceSchema,
} from '@web/src/server/resource-service';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    await requireAdmin('resource.write');
    const resource = await getAdminResource((await context.params).id);
    return Response.json(
      { data: adminResourceEditDto(resource), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('resource.write');
    await requireCsrf(request);
    const resource = await updateResource(
      (await context.params).id,
      updateResourceSchema.parse(await request.json()),
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
