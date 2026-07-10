import { logoutAdmin, requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin();
    await requireCsrf(request);
    await logoutAdmin(id);
    return Response.json(
      { data: { loggedOut: true }, requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
