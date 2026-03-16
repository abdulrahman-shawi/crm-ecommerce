import { prisma } from './lib/prisma';
import { GetUserTargetProgress } from './server/analytics';

async function main() {
  const admin = await prisma.user.findFirst({ where: { accountType: 'ADMIN' } });
  console.log('admin', admin?.id);
  if (!admin) return;
  const month = new Date().toISOString().slice(0, 7);
  const res = await GetUserTargetProgress(admin.id, month);
  console.log('month', month);
  console.log(res);
}

main().catch((err) => { console.error(err); process.exit(1); });
