import { publicIdentity, requireAdmin } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    return Response.json(
      { data: publicIdentity(await requireAdmin()), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
