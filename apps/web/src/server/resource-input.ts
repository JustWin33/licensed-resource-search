import { z } from 'zod';

const rights = z.enum(['owned', 'authorized', 'open_licensed', 'public_domain']);
const identifiers = (maximum: number) =>
  z
    .array(z.string().uuid())
    .max(maximum)
    .default([])
    .transform((values) => [...new Set(values)]);

export const createResourceSchema = z.object({
  title: z.string().trim().min(2).max(300),
  summary: z.string().trim().min(10).max(10_000),
  ownerType: z.enum(['deployer', 'authorized_submitter', 'third_party_rightsholder']),
  rightsStatus: rights,
  categoryIds: identifiers(10),
  tagIds: identifiers(20),
  source: z.object({
    url: z.string().url().max(2_000),
    name: z.string().trim().min(2).max(200),
    type: z.enum([
      'official_site',
      'author_page',
      'license_registry',
      'public_archive',
      'user_submitted',
      'other',
    ]),
  }),
  authorization: z.object({
    licenseName: z.string().trim().max(200).optional(),
    licenseVersion: z.string().trim().max(80).optional(),
    licenseUrl: z.string().url().max(2_000).optional(),
    verificationBasis: z.string().trim().min(10).max(5_000),
    allowsCommercialPromotion: z.boolean().default(false),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  }),
  link: z.object({
    provider: z.enum(['quark', 'baidu', 'generic']),
    url: z.string().url().max(2_000),
    passcode: z.string().trim().min(1).max(32).optional(),
    isPrimary: z.boolean().default(true),
  }),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
