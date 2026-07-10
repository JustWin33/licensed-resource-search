import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { storeAuthorizationEvidence } from '@web/src/server/evidence-storage';
import { errorResponse, HttpError, requestId } from '@web/src/server/http';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('resource.write');
    if (!actor.permissions.includes('evidence.read')) {
      throw new HttpError(403, 'PERMISSION_DENIED', 'Evidence permission required');
    }
    await requireCsrf(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File))
      throw new HttpError(422, 'EVIDENCE_FILE_REQUIRED', 'Evidence file is required');
    const evidence = await storeAuthorizationEvidence((await context.params).id, file, actor, id);
    return Response.json(
      { data: evidence, requestId: id },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
