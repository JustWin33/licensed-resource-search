import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import { listImports, previewImport, previewImportSchema } from '@web/src/server/import-service';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('import.write');
    return Response.json(
      { data: await listImports(), requestId: id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('import.write');
    await requireCsrf(request);
    const result = await previewImport(previewImportSchema.parse(await request.json()), actor, id);
    return Response.json({ data: result, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
