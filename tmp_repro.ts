import { prisma } from './lib/prisma';
import { GetProductInsightsAction } from './server/analytics';

async function main() {
  const admin = await prisma.user.findFirst({ where: { accountType: 'ADMIN' } });
  console.log('admin', admin?.id);
  if (!admin) return;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toInputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const res = await GetProductInsightsAction(admin.id, {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  });

  const targetRows = (res.data || []).filter((row: any) =>
    ['PISERRA', 'DR.PEN DERMAPEN', 'SKYNOVA YIKAMA JELLI', 'SKYNOVA RETINOL'].some((name) =>
      String(row.name || '').toUpperCase().includes(name)
    )
  );

  console.log(JSON.stringify(targetRows, null, 2));

  const productIds = targetRows.map((row: any) => row.productId);
  const items = await prisma.orderItem.findMany({
    where: {
      productId: { in: productIds },
      order: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    },
    select: {
      productId: true,
      quantity: true,
      price: true,
      discount: true,
      product: { select: { name: true } },
      order: {
        select: {
          orderNumber: true,
          status: true,
          discount: true,
          finalAmount: true,
          shippingPrice: true,
          moneyTransferCommission: true,
          otherCommissions: true,
        }
      }
    },
    orderBy: { orderId: 'desc' }
  });

  console.log(JSON.stringify(items, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
