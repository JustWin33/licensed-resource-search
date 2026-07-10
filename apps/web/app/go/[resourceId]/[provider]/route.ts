import { normalizeCloudDriveUrl } from '@platform/cloud-drives';
import { hmacValue } from '@platform/core';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { getServerEnv } from '@web/src/server-env';
import { errorResponse, HttpError, requestId } from '@web/src/server/http';
import { getPublicResourceById } from '@web/src/server/resource-service';
import { enforceRateLimit } from '@web/src/server/rate-limit';

export async function GET(
  request: Request,
  context: { params: Promise<{ resourceId: string; provider: string }> },
) {
  const id = requestId(request);
  try {
    const clientFingerprint = await enforceRateLimit(request, {
      scope: 'safe-redirect',
      limit: 120,
      windowSeconds: 60,
    });
    const { resourceId, provider } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(resourceId) || !/^[a-z0-9-]{2,40}$/.test(provider)) {
      throw new HttpError(400, 'REDIRECT_PATH_INVALID', 'Redirect path invalid');
    }
    const resource = await getPublicResourceById(resourceId);
    if (!resource) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
    const link = resource.cloudLinks.find((candidate) => candidate.provider.slug === provider);
    if (
      !link ||
      !['available', 'pending', 'need_password', 'unknown'].includes(link.currentStatus)
    ) {
      throw new HttpError(409, 'LINK_NOT_REDIRECTABLE', 'Link is not currently redirectable');
    }
    const configuredHosts = Array.isArray(link.provider.allowedHostPatterns)
      ? link.provider.allowedHostPatterns.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    const target = normalizeCloudDriveUrl(new URL(link.normalizedUrl), provider, configuredHosts);
    const channelSlug = new URL(request.url).searchParams.get('channel');
    if (channelSlug) {
      const channel = await getPrisma().redirectChannel.findFirst({
        where: { slug: channelSlug, providerId: link.providerId, isEnabled: true },
      });
      if (!channel) throw new HttpError(404, 'CHANNEL_NOT_FOUND', 'Redirect channel not found');
    }
    const env = getServerEnv();
    const bucketStart = new Date(Math.floor(Date.now() / 300_000) * 300_000);
    const dedupeKey = hmacValue(
      `${resourceId}:${provider}:${channelSlug ?? ''}:${bucketStart.toISOString()}:${clientFingerprint}`,
      env.URL_HASH_SECRET,
    );
    const duplicate = await getPrisma().clickEvent.findFirst({
      where: { dedupeKey, createdAt: { gte: bucketStart } },
      select: { id: true },
    });
    if (!duplicate) {
      await getPrisma().clickEvent.create({
        data: {
          id: uuidv7(),
          resourceId,
          cloudLinkId: link.id,
          providerSlug: provider,
          channelSlug,
          referrerPageType: 'resource_detail',
          dedupeKey,
          result: 'redirected',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60_000),
        },
      });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: target.toString(),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Request-Id': id,
      },
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
