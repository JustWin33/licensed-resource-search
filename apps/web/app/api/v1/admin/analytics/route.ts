import { getAnalyticsReport } from '@web/src/server/analytics-service';
import { requireAdmin } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('analytics.read');
    return Response.json(
      { data: await getAnalyticsReport(), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
