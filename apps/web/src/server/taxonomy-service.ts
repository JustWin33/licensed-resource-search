import 'server-only';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import type { AdminIdentity } from './auth';
import { HttpError } from './http';

const optionalSlug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{Letter}\p{Number}-]+$/u)
  .optional();

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: optionalSlug,
  parentId: z.string().uuid().nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isEnabled: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: optionalSlug,
});

function labelSlug(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  if (!normalized) throw new HttpError(422, 'SLUG_INVALID', 'A valid slug is required');
  return normalized;
}

function normalizeTagName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
}

export async function listTaxonomy(includeDisabled = false) {
  const prisma = getPrisma();
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      where: includeDisabled ? undefined : { isEnabled: true },
      orderBy: [{ name: 'asc' }],
      include: { parent: { select: { id: true, name: true } } },
    }),
    prisma.tag.findMany({ orderBy: [{ name: 'asc' }] }),
  ]);
  return {
    categories: categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      isEnabled: category.isEnabled,
      parent: category.parent,
    })),
    tags: tags.map((tag) => ({ id: tag.id, slug: tag.slug, name: tag.name })),
  };
}

export async function createCategory(
  input: z.infer<typeof createCategorySchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new HttpError(422, 'CATEGORY_PARENT_INVALID', 'Parent category not found');
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          id: uuidv7(),
          name: input.name,
          slug: labelSlug(input.slug ?? input.name),
          parentId: input.parentId ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          actorType: 'admin_user',
          actorId: actor.id,
          action: 'category.create',
          targetType: 'category',
          targetId: category.id,
          requestId,
          success: true,
          changedFieldsSummary: { changed: ['name', 'slug', 'parent_id'] },
        },
      });
      return category;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'CATEGORY_CONFLICT', 'Category slug already exists');
    }
    throw error;
  }
}

export async function updateCategory(
  categoryId: string,
  input: z.infer<typeof updateCategorySchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  const current = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!current) throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  if (input.parentId === categoryId) {
    throw new HttpError(422, 'CATEGORY_CYCLE', 'Category cannot be its own parent');
  }
  if (input.parentId) {
    const descendants = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE descendants AS (
        SELECT id FROM categories WHERE parent_id = ${categoryId}::uuid
        UNION ALL
        SELECT c.id FROM categories c JOIN descendants d ON c.parent_id = d.id
      ) SELECT id FROM descendants
    `;
    if (descendants.some((row) => row.id === input.parentId)) {
      throw new HttpError(422, 'CATEGORY_CYCLE', 'Category hierarchy would contain a cycle');
    }
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({ where: { id: categoryId }, data: input });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'category.update',
        targetType: 'category',
        targetId: categoryId,
        requestId,
        success: true,
        changedFieldsSummary: { changed: Object.keys(input) },
      },
    });
    return updated;
  });
}

export async function createTag(
  input: z.infer<typeof createTagSchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  const normalizedName = normalizeTagName(input.name);
  const duplicate = await prisma.tag.findFirst({ where: { normalizedName } });
  if (duplicate) throw new HttpError(409, 'TAG_CONFLICT', 'Tag already exists');
  try {
    return await prisma.$transaction(async (tx) => {
      const tag = await tx.tag.create({
        data: {
          id: uuidv7(),
          name: input.name,
          slug: labelSlug(input.slug ?? input.name),
          normalizedName,
        },
      });
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          actorType: 'admin_user',
          actorId: actor.id,
          action: 'tag.create',
          targetType: 'tag',
          targetId: tag.id,
          requestId,
          success: true,
          changedFieldsSummary: { changed: ['name', 'slug'] },
        },
      });
      return tag;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'TAG_CONFLICT', 'Tag slug already exists');
    }
    throw error;
  }
}
