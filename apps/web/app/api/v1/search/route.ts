import { z } from 'zod';
import { errorResponse, requestId } from '@web/src/server/http';
import { searchPublicResources } from '@web/src/server/search-service';
import { enforceRateLimit } from '@web/src/server/rate-limit';

const schema = z.object({
  q: z.string().trim().min(1).max(200),
  provider: z.enum(['quark', 'baidu', 'generic']).optional(),
  category: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[\p{Letter}\p{Number}-]+$/u)
    .optional(),
  rights: z.enum(['owned', 'authorized', 'open_licensed', 'public_domain']).optional(),
  linkStatus: z
    .enum(['pending', 'available', 'need_password', 'risk_controlled', 'unknown'])
    .optional(),
  sort: z.enum(['relevance', 'newest', 'popular']).default('relevance'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await enforceRateLimit(request, { scope: 'public-search', limit: 120, windowSeconds: 60 });
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));
    const data = await searchPublicResources(input);
    return Response.json(
      { data, requestId: id },
      { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
