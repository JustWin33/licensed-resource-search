import { listGovernanceCases } from '@web/src/server/governance-service';
import { requireAdmin } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('governance.handle');
    return Response.json(
      { data: await listGovernanceCases(), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
