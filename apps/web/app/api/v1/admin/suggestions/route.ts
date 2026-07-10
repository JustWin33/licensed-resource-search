import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import { errorResponse, requestId } from '@web/src/server/http';
import {
  createSuggestion,
  createSuggestionSchema,
  listSearchSettings,
} from '@web/src/server/search-settings-service';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('settings.write');
    return Response.json(
      { data: (await listSearchSettings()).suggestions, requestId: id },
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
    const row = await createSuggestion(
      createSuggestionSchema.parse(await request.json()),
      actor,
      id,
    );
    return Response.json(
      { data: row, requestId: id },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
