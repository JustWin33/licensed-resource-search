import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import {
  createRedirectChannel,
  createRedirectChannelSchema,
  listLinkOperations,
} from '@web/src/server/link-operations-service';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('settings.write');
    return Response.json(
      { data: (await listLinkOperations()).channels, requestId: id },
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
    const result = await createRedirectChannel(
      createRedirectChannelSchema.parse(await request.json()),
      actor,
      id,
    );
    return Response.json({ data: result, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
