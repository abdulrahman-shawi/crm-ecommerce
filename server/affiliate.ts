'use server';

import { decrypt } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const AFFILIATE_BASE_URL = 'https://ecomerce-bay-xi.vercel.app';
const DELIVERED_ORDER_STATUSES = new Set(['تم تسليم الطلب', 'تم التسليم', 'مدفوعة', 'تم البيع']);

function resolveAffiliateCommissionRate(productRate?: number | null, linkRate?: number | null) {
  const normalizedProductRate = Number(productRate || 0);
  if (normalizedProductRate > 0) {
    return normalizedProductRate;
  }

  return Number(linkRate || 0);
}

function getEffectiveCommissionStatus(commission: {
  status?: 'PENDING' | 'PAID' | 'CANCELLED' | string | null;
  order?: { status?: string | null } | null;
}) {
  if (commission.status === 'CANCELLED') {
    return 'CANCELLED' as const;
  }

  if (commission.status === 'PAID') {
    return 'PAID' as const;
  }

  const orderStatus = String(commission.order?.status || '').trim();
  if (DELIVERED_ORDER_STATUSES.has(orderStatus)) {
    return 'PAID' as const;
  }

  return 'PENDING' as const;
}

function withEffectiveCommissionStatus<T extends {
  status?: 'PENDING' | 'PAID' | 'CANCELLED' | string | null;
  paidAt?: Date | null;
  order?: { status?: string | null; updatedAt?: Date | null; createdAt?: Date | null } | null;
}>(commission: T) {
  const effectiveStatus = getEffectiveCommissionStatus(commission);

  return {
    ...commission,
    status: effectiveStatus,
    paidAt:
      effectiveStatus === 'PAID'
        ? commission.paidAt || commission.order?.updatedAt || commission.order?.createdAt || new Date()
        : null,
  };
}

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

function isAffiliateUser(user: { isAffiliate?: boolean | null; accountType?: string | null } | null) {
  if (!user) return false;
  return Boolean(user.isAffiliate) || String(user.accountType || '').trim().toUpperCase() === 'AFFILIATE';
}

function isAffiliateApprovedUser(user: { isAffiliate?: boolean | null; affiliateApproved?: boolean | null; accountType?: string | null } | null) {
  if (!user) return false;
  if (!isAffiliateUser(user)) return true;
  return Boolean(user.affiliateApproved);
}

export async function getAffiliateAdminDashboard() {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.accountType !== 'ADMIN') {
    return { success: false, error: 'غير مصرح لك بعرض لوحة الأفلييت' };
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { isAffiliate: true },
        { accountType: 'AFFILIATE' },
      ],
      affiliateApproved: true,
    },
    orderBy: { username: 'asc' },
    select: {
      id: true,
      username: true,
      email: true,
      accountType: true,
      isAffiliate: true,
      affiliateApproved: true,
      affiliateRequestedAt: true,
      affiliateApprovedAt: true,
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
              status: true,
              createdAt: true,
              updatedAt: true,
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
    link.commissions.map((commission) => {
      const normalizedCommission = withEffectiveCommissionStatus(commission);

      return {
        ...normalizedCommission,
        affiliateLink: {
          id: link.id,
          uniqueCode: link.uniqueCode,
          commissionRate: link.commissionRate,
          user: link.user,
          product: link.product,
          fullUrl: `${AFFILIATE_BASE_URL}/ref/${link.uniqueCode}`,
        },
      };
    })
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
        commissions: link.commissions.map((commission) => withEffectiveCommissionStatus(commission)),
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

  if (currentUser.accountType !== 'ADMIN' && !isAffiliateApprovedUser(currentUser)) {
    return { success: false, error: 'حساب الأفلييت بانتظار موافقة الأدمن' };
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
      accountType: true,
      isAffiliate: true,
      affiliateApproved: true,
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
                  status: true,
                  finalAmount: true,
                  createdAt: true,
                  updatedAt: true,
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

  if (isAffiliateUser(targetUser) && !targetUser.affiliateApproved) {
    return { success: false, error: 'هذا الحساب لم تتم الموافقة عليه بعد' };
  }

  const links = Array.isArray(targetUser.affiliateLinks)
    ? targetUser.affiliateLinks.map((link) => {
        const normalizedCommissions = link.commissions.map((commission) =>
          withEffectiveCommissionStatus(commission)
        );
        const totalCommissions = Number(
          normalizedCommissions.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)
        );
        const pendingCommissions = Number(
          normalizedCommissions
            .filter((item) => item.status === 'PENDING')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
            .toFixed(2)
        );
        const paidCommissions = Number(
          normalizedCommissions
            .filter((item) => item.status === 'PAID')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
            .toFixed(2)
        );

        return {
          ...link,
          fullUrl: `${AFFILIATE_BASE_URL}/ref/${link.uniqueCode}`,
          effectiveCommissionRate: resolveAffiliateCommissionRate(
            link?.product?.affiliateCommissionRate,
            link?.commissionRate
          ),
          commissions: normalizedCommissions,
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

  const affiliateUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accountType: true,
      isAffiliate: true,
      affiliateApproved: true,
    },
  });

  if (!affiliateUser) {
    return { success: false, error: 'المستخدم غير موجود' };
  }

  if (!isAffiliateUser(affiliateUser)) {
    return { success: false, error: 'المستخدم المحدد ليس حساب أفلييت' };
  }

  if (!affiliateUser.affiliateApproved) {
    return { success: false, error: 'لا يمكن إنشاء رابط قبل موافقة الأدمن على حساب الأفلييت' };
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

export async function getAffiliateUsersAdminList() {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.accountType !== 'ADMIN') {
    return { success: false, error: 'غير مصرح لك بإدارة مستخدمي الأفلييت' };
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { isAffiliate: true },
        { accountType: 'AFFILIATE' },
      ],
    },
    orderBy: [
      { affiliateApproved: 'asc' },
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      notes: true,
      jobTitle: true,
      accountType: true,
      isAffiliate: true,
      affiliateApproved: true,
      affiliateRequestedAt: true,
      affiliateApprovedAt: true,
      createdAt: true,
      affiliateLinks: {
        select: {
          id: true,
        },
      },
    },
  });

  return {
    success: true,
    data: {
      summary: {
        total: users.length,
        pending: users.filter((item) => !item.affiliateApproved).length,
        approved: users.filter((item) => item.affiliateApproved).length,
      },
      users,
    },
  };
}

export async function setAffiliateUserApproval(userId: string, approved: boolean) {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.accountType !== 'ADMIN') {
    return { success: false, error: 'غير مصرح لك بتعديل حالة أفلييت' };
  }

  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return { success: false, error: 'معرف المستخدم غير صالح' };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: normalizedUserId },
    select: { id: true, isAffiliate: true, accountType: true },
  });

  if (!isAffiliateUser(existingUser)) {
    return { success: false, error: 'المستخدم المحدد ليس حساب أفلييت' };
  }

  const updatedUser = await prisma.user.update({
    where: { id: normalizedUserId },
    data: {
      accountType: 'AFFILIATE',
      isAffiliate: true,
      affiliateApproved: approved,
      affiliateApprovedAt: approved ? new Date() : null,
      affiliateRequestedAt: approved ? undefined : new Date(),
    },
    select: {
      id: true,
      username: true,
      email: true,
      isAffiliate: true,
      affiliateApproved: true,
      affiliateRequestedAt: true,
      affiliateApprovedAt: true,
    },
  });

  return { success: true, data: updatedUser };
}

export async function updateAffiliateCommissionStatus(
  commissionId: string,
  status: 'PENDING' | 'PAID' | 'CANCELLED'
) {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.accountType !== 'ADMIN') {
    return { success: false, error: 'غير مصرح لك بتعديل حالة العمولة' };
  }

  const normalizedCommissionId = String(commissionId || '').trim();
  const normalizedStatus = String(status || '').trim().toUpperCase();

  if (!normalizedCommissionId) {
    return { success: false, error: 'معرف العمولة غير صالح' };
  }

  if (!['PENDING', 'PAID', 'CANCELLED'].includes(normalizedStatus)) {
    return { success: false, error: 'حالة العمولة غير صالحة' };
  }

  const updatedCommission = await prisma.commission.update({
    where: { id: normalizedCommissionId },
    data: {
      status: normalizedStatus as 'PENDING' | 'PAID' | 'CANCELLED',
      paidAt: normalizedStatus === 'PAID' ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
      paidAt: true,
    },
  });

  return { success: true, data: updatedCommission };
}