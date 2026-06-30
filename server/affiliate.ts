'use server';

import { decrypt } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const AFFILIATE_BASE_URL = 'https://ecomerce-bay-xi.vercel.app';

async function getCurrentSessionUser() {
  try {
    const session = cookies().get('skynova')?.value;
    if (!session) return null;

    const decoded = await decrypt(session);
    if (!decoded?.userId) return null;

    return await prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      include: { permission: true },
    });
  } catch {
    return null;
  }
}

export async function getAffiliateAdminDashboard() {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.accountType !== 'ADMIN') {
    return { success: false, error: 'غير مصرح لك بعرض لوحة الأفلييت' };
  }

  const users = await prisma.user.findMany({
    orderBy: { username: 'asc' },
    select: {
      id: true,
      username: true,
      email: true,
      accountType: true,
    },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      seoSlug: true,
      affiliatePrice: true,
      affiliateCommissionRate: true,
      isActive: true,
    },
  });

  const links = await prisma.affiliateLink.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          seoSlug: true,
          affiliatePrice: true,
          affiliateCommissionRate: true,
        },
      },
      commissions: {
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              finalAmount: true,
              createdAt: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const totalClicks = links.reduce((sum, item) => sum + Number(item.clicks || 0), 0);
  const totalConversions = links.reduce((sum, item) => sum + Number(item.conversions || 0), 0);
  const commissions = links.flatMap((link) =>
    link.commissions.map((commission) => ({
      ...commission,
      affiliateLink: {
        id: link.id,
        uniqueCode: link.uniqueCode,
        commissionRate: link.commissionRate,
        user: link.user,
        product: link.product,
        fullUrl: `${AFFILIATE_BASE_URL}/ref/${link.uniqueCode}`,
      },
    }))
  );

  const totalCommissions = Number(
    commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)
  );
  const pendingCommissions = Number(
    commissions
      .filter((item) => item.status === 'PENDING')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
      .toFixed(2)
  );
  const paidCommissions = Number(
    commissions
      .filter((item) => item.status === 'PAID')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
      .toFixed(2)
  );

  return {
    success: true,
    data: {
      users,
      products,
      totalClicks,
      totalConversions,
      totalCommissions,
      pendingCommissions,
      paidCommissions,
      links: links.map((link) => ({
        ...link,
        fullUrl: `${AFFILIATE_BASE_URL}/ref/${link.uniqueCode}`,
      })),
      commissions,
    },
  };
}

export async function getAffiliateUserDashboard(targetUserId: string) {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    return { success: false, error: 'غير مصرح لك بعرض بيانات الأفلييت' };
  }

  const normalizedUserId = String(targetUserId || '').trim();
  if (!normalizedUserId) {
    return { success: false, error: 'معرف المستخدم غير صالح' };
  }

  const canView = currentUser.accountType === 'ADMIN' || currentUser.id === normalizedUserId;
  if (!canView) {
    return { success: false, error: 'غير مصرح لك بعرض بيانات الأفلييت لهذا الموظف' };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: normalizedUserId },
    select: {
      id: true,
      username: true,
      email: true,
      affiliateLinks: {
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              seoSlug: true,
              affiliatePrice: true,
              affiliateCommissionRate: true,
            },
          },
          commissions: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
              paidAt: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!targetUser) {
    return { success: false, error: 'المستخدم غير موجود' };
  }

  const links = Array.isArray(targetUser.affiliateLinks)
    ? targetUser.affiliateLinks.map((link) => {
        const totalCommissions = Number(
          link.commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)
        );
        const pendingCommissions = Number(
          link.commissions
            .filter((item) => item.status === 'PENDING')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
            .toFixed(2)
        );
        const paidCommissions = Number(
          link.commissions
            .filter((item) => item.status === 'PAID')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
            .toFixed(2)
        );

        return {
          ...link,
          fullUrl: `${AFFILIATE_BASE_URL}/ref/${link.uniqueCode}`,
          effectiveCommissionRate:
            link?.product?.affiliateCommissionRate != null
              ? Number(link.product.affiliateCommissionRate || 0)
              : Number(link.commissionRate || 0),
          totalCommissions,
          pendingCommissions,
          paidCommissions,
        };
      })
    : [];

  const totalClicks = links.reduce((sum, item) => sum + Number(item.clicks || 0), 0);
  const totalConversions = links.reduce((sum, item) => sum + Number(item.conversions || 0), 0);
  const totalCommissions = Number(
    links.reduce((sum, item) => sum + Number(item.totalCommissions || 0), 0).toFixed(2)
  );
  const pendingCommissions = Number(
    links.reduce((sum, item) => sum + Number(item.pendingCommissions || 0), 0).toFixed(2)
  );
  const paidCommissions = Number(
    links.reduce((sum, item) => sum + Number(item.paidCommissions || 0), 0).toFixed(2)
  );

  return {
    success: true,
    data: {
      user: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
      },
      totalClicks,
      totalConversions,
      totalCommissions,
      pendingCommissions,
      paidCommissions,
      links,
    },
  };
}

function generateCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function createUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode();
    const existing = await prisma.affiliateLink.findUnique({
      where: { uniqueCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }

  throw new Error('تعذر إنشاء كود فريد');
}

export async function createAffiliateLinkByAdmin(payload: {
  userId: string;
  productId: number;
  commissionRate: number;
}) {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.accountType !== 'ADMIN') {
    return { success: false, error: 'فقط الأدمن يمكنه إنشاء روابط الإحالة' };
  }

  const userId = String(payload.userId || '').trim();
  const productId = Number(payload.productId || 0);
  const commissionRate = Number(payload.commissionRate || 0);

  if (!userId || Number.isNaN(productId) || productId <= 0) {
    return { success: false, error: 'بيانات الرابط غير صالحة' };
  }

  if (Number.isNaN(commissionRate) || commissionRate < 0) {
    return { success: false, error: 'نسبة العمولة غير صالحة' };
  }

  const existing = await prisma.affiliateLink.findFirst({
    where: { userId, productId },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
      product: {
        select: { id: true, name: true, seoSlug: true },
      },
    },
  });

  if (existing) {
    return {
      success: true,
      data: {
        ...existing,
        fullUrl: `${AFFILIATE_BASE_URL}/ref/${existing.uniqueCode}`,
      },
    };
  }

  const uniqueCode = await createUniqueCode();
  const link = await prisma.affiliateLink.create({
    data: {
      userId,
      productId,
      uniqueCode,
      commissionRate,
    },
    include: {
      user: {
        select: { id: true, username: true, email: true },
      },
      product: {
        select: { id: true, name: true, seoSlug: true },
      },
    },
  });

  return {
    success: true,
    data: {
      ...link,
      fullUrl: `${AFFILIATE_BASE_URL}/ref/${link.uniqueCode}`,
    },
  };
}

export async function createPublicCustomerForAffiliateOrder(data: {
  name: string;
  phone: string;
  country?: string;
  city?: string;
}) {
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();

  if (!name || !phone) {
    return { success: false, error: 'بيانات العميل مطلوبة' };
  }

  const existing = await prisma.customer.findFirst({
    where: {
      phone: {
        has: phone,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (existing) {
    return { success: true, data: existing };
  }

  const customer = await prisma.customer.create({
    data: {
      name,
      phone: [phone],
      country: String(data.country || '').trim() || null,
      city: String(data.city || '').trim() || null,
      status: 'المتجر',
      phonestatus: 'معلق',
      source: 'affiliate',
    },
    select: {
      id: true,
      name: true,
    },
  });

  return { success: true, data: customer };
}