import { errorResponse, requestId } from '@web/src/server/http';
import { listTaxonomy } from '@web/src/server/taxonomy-service';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    return Response.json(
      { data: (await listTaxonomy()).categories, requestId: id },
      { headers: { 'Cache-Control': 'public, max-age=60', 'X-Request-Id': id } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
