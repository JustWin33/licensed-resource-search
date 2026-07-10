import 'server-only';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import type { AdminIdentity } from './auth';
import { HttpError } from './http';

export const createSynonymSchema = z.object({
  terms: z.array(z.string().trim().min(1).max(120)).min(2).max(20),
});
export const createSuggestionSchema = z.object({
  term: z.string().trim().min(1).max(300),
});
export const toggleSettingSchema = z.object({ isEnabled: z.boolean() });

function normalize(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
}

export async function listSearchSettings() {
  const prisma = getPrisma();
  const [synonyms, suggestions] = await Promise.all([
    prisma.synonym.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.searchSuggestion.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    synonyms: synonyms.map((row) => ({
      id: row.id,
      terms: Array.isArray(row.termsJson)
        ? row.termsJson.filter((term): term is string => typeof term === 'string')
        : [],
      isEnabled: row.isEnabled,
    })),
    suggestions: suggestions.map((row) => ({
      id: row.id,
      term: row.term,
      source: row.source,
      isEnabled: row.isEnabled,
    })),
  };
}

export async function createSynonym(
  input: z.infer<typeof createSynonymSchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  const terms = [...new Set(input.terms.map(normalize))];
  if (terms.length < 2)
    throw new HttpError(422, 'SYNONYM_TERMS_REQUIRED', 'Two unique terms required');
  return getPrisma().$transaction(async (tx) => {
    const row = await tx.synonym.create({ data: { id: uuidv7(), termsJson: terms } });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'search.synonym.create',
        targetType: 'synonym',
        targetId: row.id,
        requestId,
        success: true,
        changedFieldsSummary: { changed: ['terms_json'] },
      },
    });
    return row;
  });
}

export async function toggleSynonym(
  synonymId: string,
  isEnabled: boolean,
  actor: AdminIdentity,
  requestId: string,
) {
  return getPrisma().$transaction(async (tx) => {
    const found = await tx.synonym.findUnique({ where: { id: synonymId } });
    if (!found) throw new HttpError(404, 'SYNONYM_NOT_FOUND', 'Synonym not found');
    const row = await tx.synonym.update({ where: { id: synonymId }, data: { isEnabled } });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'search.synonym.toggle',
        targetType: 'synonym',
        targetId: row.id,
        requestId,
        success: true,
        changedFieldsSummary: { changed: ['is_enabled'] },
      },
    });
    return row;
  });
}

export async function createSuggestion(
  input: z.infer<typeof createSuggestionSchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const row = await tx.searchSuggestion.create({
        data: {
          id: uuidv7(),
          term: input.term,
          normalizedTerm: normalize(input.term),
          source: 'manual',
        },
      });
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          actorType: 'admin_user',
          actorId: actor.id,
          action: 'search.suggestion.create',
          targetType: 'search_suggestion',
          targetId: row.id,
          requestId,
          success: true,
          changedFieldsSummary: { changed: ['term', 'source'] },
        },
      });
      return row;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'SUGGESTION_CONFLICT', 'Suggestion already exists');
    }
    throw error;
  }
}

export async function listPublicSuggestions(query = '') {
  const normalizedQuery = normalize(query);
  const rows = await getPrisma().searchSuggestion.findMany({
    where: {
      isEnabled: true,
      ...(normalizedQuery ? { normalizedTerm: { startsWith: normalizedQuery } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return rows.map((row) => row.term);
}
