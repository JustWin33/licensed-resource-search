import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import {
  createResource,
  createResourceSchema,
  listAdminResources,
} from '@web/src/server/resource-service';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('resource.write');
    const resources = await listAdminResources();
    return Response.json(
      { data: resources, requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('resource.write');
    await requireCsrf(request);
    const input = createResourceSchema.parse(await request.json());
    const created = await createResource(input, actor, id);
    return Response.json(
      { data: created, requestId: id },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
