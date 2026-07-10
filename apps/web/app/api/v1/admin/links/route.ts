import { requireAdmin } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { listLinkOperations } from '@web/src/server/link-operations-service';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('settings.write');
    return Response.json(
      { data: await listLinkOperations(), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
