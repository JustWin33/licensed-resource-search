import { z } from 'zod';
import { errorResponse, requestId } from '@web/src/server/http';
import { enforceRateLimit } from '@web/src/server/rate-limit';
import { listPublicSuggestions } from '@web/src/server/search-settings-service';

const schema = z.object({ q: z.string().trim().max(120).default('') });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await enforceRateLimit(request, { scope: 'search-suggestions', limit: 60, windowSeconds: 60 });
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    return Response.json(
      { data: await listPublicSuggestions(input.q), requestId: id },
      { headers: { 'Cache-Control': 'public, max-age=30', 'X-Request-Id': id } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
