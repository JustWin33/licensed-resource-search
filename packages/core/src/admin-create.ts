import { randomBytes, createHash } from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';
import { getPrisma } from '@platform/db';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

const prisma = getPrisma();

async function askHidden(question: string): Promise<string> {
  if (!input.isTTY) throw new Error('pnpm admin:create requires an interactive TTY');
  const rl = readline.createInterface({ input, output });
  const originalWrite = output.write.bind(output);
  const mute = () => true;
  output.write = mute as typeof output.write;
  try {
    const answer = await rl.question(question);
    originalWrite('\n');
    return answer;
  } finally {
    output.write = originalWrite;
    rl.close();
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const username = normalize(await rl.question('管理员用户名: '));
  const emailRaw = normalize(await rl.question('管理员邮箱（可留空）: '));
  rl.close();
  const password = await askHidden('密码: ');
  const confirm = await askHidden('确认密码: ');
  if (password !== confirm) throw new Error('两次密码不一致');
  if (password.length < 12) throw new Error('密码至少 12 个字符');
  if (!username || username.length < 3) throw new Error('用户名至少 3 个字符');

  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [{ usernameNormalized: username }, ...(emailRaw ? [{ emailNormalized: emailRaw }] : [])],
    },
  });
  if (existing) throw new Error('用户名或邮箱已存在');

  const user = await prisma.adminUser.create({
    data: {
      id: uuidv7(),
      usernameNormalized: username,
      emailNormalized: emailRaw || null,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      passwordHashVersion: 'argon2id-v1',
      roles: { create: { role: { connect: { slug: 'admin' } } } },
    },
  });
  const requestId = randomBytes(16).toString('hex');
  await prisma.auditLog.create({
    data: {
      id: uuidv7(),
      actorType: 'system',
      action: 'admin.create',
      targetType: 'admin_user',
      targetId: user.id,
      requestId: createHash('sha256').update(requestId).digest('hex'),
      success: true,
      changedFieldsSummary: { changed: ['username', 'email', 'role'] },
    },
  });
  console.log(`管理员已创建：${username}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : '管理员创建失败');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
