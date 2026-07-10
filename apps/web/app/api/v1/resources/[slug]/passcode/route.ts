import { z } from 'zod';
import { decodeSlugParam, decryptSensitive } from '@platform/core';
import { getServerEnv } from '@web/src/server-env';
import { errorResponse, HttpError, requestId } from '@web/src/server/http';
import { getPublicResourceBySlug } from '@web/src/server/resource-service';
import { enforceRateLimit } from '@web/src/server/rate-limit';

const schema = z.object({ provider: z.enum(['quark', 'baidu', 'generic']) });

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const id = requestId(request);
  try {
    await enforceRateLimit(request, { scope: 'passcode-reveal', limit: 30, windowSeconds: 60 });
    const { provider } = schema.parse(await request.json());
    const slug = decodeSlugParam((await context.params).slug);
    if (!slug) throw new HttpError(400, 'RESOURCE_SLUG_INVALID', 'Resource slug is invalid');
    const resource = await getPublicResourceBySlug(slug);
    if (!resource) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
    const link = resource.cloudLinks.find((candidate) => candidate.provider.slug === provider);
    if (!link?.passcodeCiphertext)
      throw new HttpError(404, 'PASSCODE_NOT_FOUND', 'Passcode not found');
    return Response.json(
      {
        data: {
          provider,
          passcode: decryptSensitive(link.passcodeCiphertext, getServerEnv().ENCRYPTION_KEY),
        },
        requestId: id,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'X-Request-Id': id,
        },
      },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
