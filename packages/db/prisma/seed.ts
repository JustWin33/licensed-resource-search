import 'dotenv/config';
import { v7 as uuidv7 } from 'uuid';
import { getPrisma } from '../src/client.js';

const permissions = [
  ['resource.read_public', 'Read public resource DTOs'],
  ['resource.write', 'Create and edit resources'],
  ['resource.review', 'Review resource rights and evidence'],
  ['resource.publish', 'Publish, hide, archive and delete resources'],
  ['evidence.read', 'Read private authorization evidence'],
  ['governance.handle', 'Handle submissions, reports and takedowns'],
  ['analytics.read', 'Read privacy-safe analytics'],
  ['settings.write', 'Manage taxonomy and search settings'],
  ['import.write', 'Preview and confirm imports'],
  ['audit.read', 'Read audit logs'],
  ['admin.manage', 'Manage admin users, roles and permissions'],
] as const;

const prisma = getPrisma();

async function main() {
  const permissionRows = new Map<string, string>();
  for (const [slug, description] of permissions) {
    const row = await prisma.permission.upsert({
      where: { slug },
      update: { description },
      create: { id: uuidv7(), slug, description },
    });
    permissionRows.set(slug, row.id);
  }

  const roleRows = new Map<string, string>();
  for (const [slug, name] of [
    ['editor', 'Editor'],
    ['reviewer', 'Reviewer'],
    ['admin', 'Administrator'],
  ] as const) {
    const role = await prisma.role.upsert({
      where: { slug },
      update: { name, isSystem: true },
      create: { id: uuidv7(), slug, name, isSystem: true },
    });
    roleRows.set(slug, role.id);
  }

  const rolePermissionMap: Record<string, string[]> = {
    editor: ['resource.read_public', 'resource.write'],
    reviewer: [
      'resource.read_public',
      'resource.write',
      'resource.review',
      'resource.publish',
      'evidence.read',
      'governance.handle',
      'analytics.read',
      'settings.write',
      'import.write',
      'audit.read',
    ],
    admin: permissions.map(([slug]) => slug),
  };

  for (const [roleSlug, permissionSlugs] of Object.entries(rolePermissionMap)) {
    for (const permissionSlug of permissionSlugs) {
      const roleId = roleRows.get(roleSlug);
      const permissionId = permissionRows.get(permissionSlug);
      if (!roleId || !permissionId)
        throw new Error(`Seed reference missing: ${roleSlug}/${permissionSlug}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  for (const [slug, displayName, adapterVersion] of [
    ['quark', '夸克网盘', '0.3.0'],
    ['baidu', '百度网盘', '0.3.0'],
    ['generic', '通用外链', '0.3.0'],
  ] as const) {
    const allowedHostPatterns =
      slug === 'quark' ? ['pan.quark.cn'] : slug === 'baidu' ? ['pan.baidu.com'] : [];
    await prisma.cloudProvider.upsert({
      where: { slug },
      update: { displayName, adapterVersion, allowedHostPatterns, isEnabled: true },
      create: {
        id: uuidv7(),
        slug,
        displayName,
        adapterVersion,
        allowedHostPatterns,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
