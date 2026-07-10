import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { createTag, createTagSchema, listTaxonomy } from '@web/src/server/taxonomy-service';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('settings.write');
    return Response.json(
      { data: (await listTaxonomy(true)).tags, requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('settings.write');
    await requireCsrf(request);
    const tag = await createTag(createTagSchema.parse(await request.json()), actor, id);
    return Response.json(
      { data: tag, requestId: id },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
