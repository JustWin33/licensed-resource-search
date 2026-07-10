import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { confirmImport } from '@web/src/server/import-service';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('import.write');
    await requireCsrf(request);
    const result = await confirmImport((await context.params).id, actor, id);
    return Response.json({ data: result, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}
