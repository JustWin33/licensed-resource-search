import { decodeSlugParam } from '@platform/core';
import { errorResponse, HttpError, requestId } from '@web/src/server/http';
import { getPublicResourceBySlug, publicResourceDto } from '@web/src/server/resource-service';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const id = requestId(request);
  try {
    const slug = decodeSlugParam((await context.params).slug);
    if (!slug) throw new HttpError(400, 'RESOURCE_SLUG_INVALID', 'Resource slug is invalid');
    const resource = await getPublicResourceBySlug(slug);
    if (!resource) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
    return Response.json(
      { data: publicResourceDto(resource), requestId: id },
      { headers: { 'Cache-Control': 'public, max-age=30', 'X-Request-Id': id } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
