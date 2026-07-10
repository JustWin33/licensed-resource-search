import { requireAdmin, requireCsrf } from '@web/src/server/auth';
import {
  createBlocklistEntry,
  createBlocklistSchema,
  listGovernanceCases,
} from '@web/src/server/governance-service';
import { errorResponse, requestId } from '@web/src/server/http';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdmin('governance.handle');
    return Response.json({ data: (await listGovernanceCases()).blocklist, requestId: id });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const actor = await requireAdmin('governance.handle');
    await requireCsrf(request);
    const result = await createBlocklistEntry(
      createBlocklistSchema.parse(await request.json()),
      actor,
      id,
    );
    return Response.json({ data: result, requestId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
