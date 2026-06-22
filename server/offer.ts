'use server';

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  const parsed = String(value || '').trim();
  return parsed ? parsed : null;
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const parsed = String(value || '').trim();
  if (!parsed) return null;

  const result = Number(parsed);
  return Number.isInteger(result) ? result : null;
}

function parseOptionalFloat(value: FormDataEntryValue | null): number | null {
  const parsed = String(value || '').trim();
  if (!parsed) return null;

  const result = Number(parsed);
  return Number.isFinite(result) ? result : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const parsed = String(value || '').trim();
  if (!parsed) return null;

  const result = new Date(parsed);
  return Number.isNaN(result.getTime()) ? null : result;
}

function parseDiscountType(value: FormDataEntryValue | null): 'PERCENTAGE' | 'FIXED' {
  return String(value || '').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
}

async function getCurrentUser() {
  try {
    const session = cookies().get('skynova')?.value;
    if (!session) return null;

    const decoded = await decrypt(session);
    if (!decoded?.userId) return null;

    return prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      select: { id: true, accountType: true },
    });
  } catch {
    return null;
  }
}

async function ensureAdmin() {
  const user = await getCurrentUser();
  if (!user || user.accountType !== 'ADMIN') {
    return { success: false as const, error: 'غير مصرح' };
  }

  return { success: true as const, user };
}

export async function getOffers() {
  try {
    const offers = await prisma.offer.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return { success: true, data: JSON.parse(JSON.stringify(offers)) };
  } catch (error) {
    console.error('getOffers error:', error);
    return { success: false, error: 'فشل في جلب العروض' };
  }
}

export async function createOffer(formData: FormData) {
  try {
    const auth = await ensureAdmin();
    if (!auth.success) return auth;

    const offer = await prisma.offer.create({
      data: {
        title: parseOptionalString(formData.get('title')),
        subtitle: parseOptionalString(formData.get('subtitle')),
        description: parseOptionalString(formData.get('description')),
        badgeText: parseOptionalString(formData.get('badgeText')),
        image: parseOptionalString(formData.get('image')),
        ctaText: parseOptionalString(formData.get('ctaText')),
        ctaLink: parseOptionalString(formData.get('ctaLink')),
        startsAt: parseOptionalDate(formData.get('startsAt')),
        endsAt: parseOptionalDate(formData.get('endsAt')),
        countdownEndsAt: parseOptionalDate(formData.get('countdownEndsAt')),
        sortOrder: parseOptionalInt(formData.get('sortOrder')) ?? 0,
        isActive: String(formData.get('isActive')) === 'true',
      },
    });

    revalidatePath('/dashboard/offers');
    revalidatePath('/dashboard/offer-discounts');
    return { success: true, data: JSON.parse(JSON.stringify(offer)) };
  } catch (error) {
    console.error('createOffer error:', error);
    return { success: false, error: 'فشل في إنشاء العرض' };
  }
}

export async function updateOffer(id: string, formData: FormData) {
  try {
    const auth = await ensureAdmin();
    if (!auth.success) return auth;

    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'العرض غير موجود' };
    }

    const offer = await prisma.offer.update({
      where: { id },
      data: {
        title: parseOptionalString(formData.get('title')),
        subtitle: parseOptionalString(formData.get('subtitle')),
        description: parseOptionalString(formData.get('description')),
        badgeText: parseOptionalString(formData.get('badgeText')),
        image: parseOptionalString(formData.get('image')),
        ctaText: parseOptionalString(formData.get('ctaText')),
        ctaLink: parseOptionalString(formData.get('ctaLink')),
        startsAt: parseOptionalDate(formData.get('startsAt')),
        endsAt: parseOptionalDate(formData.get('endsAt')),
        countdownEndsAt: parseOptionalDate(formData.get('countdownEndsAt')),
        sortOrder: parseOptionalInt(formData.get('sortOrder')) ?? 0,
        isActive: String(formData.get('isActive')) === 'true',
      },
    });

    revalidatePath('/dashboard/offers');
    revalidatePath('/dashboard/offer-discounts');
    return { success: true, data: JSON.parse(JSON.stringify(offer)) };
  } catch (error) {
    console.error('updateOffer error:', error);
    return { success: false, error: 'فشل في تحديث العرض' };
  }
}

export async function deleteOffer(id: string) {
  try {
    const auth = await ensureAdmin();
    if (!auth.success) return auth;

    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'العرض غير موجود' };
    }

    await prisma.offer.delete({ where: { id } });

    revalidatePath('/dashboard/offers');
    revalidatePath('/dashboard/offer-discounts');
    return { success: true };
  } catch (error) {
    console.error('deleteOffer error:', error);
    return { success: false, error: 'فشل في حذف العرض' };
  }
}

export async function getOfferDiscountFormMeta() {
  try {
    const [offers, products, categories] = await Promise.all([
      prisma.offer.findMany({
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        select: { id: true, title: true, subtitle: true },
      }),
      prisma.product.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

    return {
      success: true,
      data: JSON.parse(
        JSON.stringify({
          offers,
          products,
          categories,
        })
      ),
    };
  } catch (error) {
    console.error('getOfferDiscountFormMeta error:', error);
    return { success: false, error: 'فشل في تحميل بيانات النماذج' };
  }
}

export async function getOfferDiscounts() {
  try {
    const rows = await prisma.offerDiscount.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        offer: { select: { id: true, title: true } },
        product: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return { success: true, data: JSON.parse(JSON.stringify(rows)) };
  } catch (error) {
    console.error('getOfferDiscounts error:', error);
    return { success: false, error: 'فشل في جلب قواعد الخصم' };
  }
}

export async function createOfferDiscount(formData: FormData) {
  try {
    const auth = await ensureAdmin();
    if (!auth.success) return auth;

    const offerId = String(formData.get('offerId') || '').trim();
    if (!offerId) {
      return { success: false, error: 'يجب اختيار العرض' };
    }

    const created = await prisma.offerDiscount.create({
      data: {
        offerId,
        productId: parseOptionalInt(formData.get('productId')),
        categoryId: parseOptionalInt(formData.get('categoryId')),
        discountType: parseDiscountType(formData.get('discountType')),
        discountValue: parseOptionalFloat(formData.get('discountValue')),
        maxDiscountValue: parseOptionalFloat(formData.get('maxDiscountValue')),
        minOrderAmount: parseOptionalFloat(formData.get('minOrderAmount')),
        usageLimit: parseOptionalInt(formData.get('usageLimit')),
        startsAt: parseOptionalDate(formData.get('startsAt')),
        endsAt: parseOptionalDate(formData.get('endsAt')),
        isActive: String(formData.get('isActive')) === 'true',
      },
      include: {
        offer: { select: { id: true, title: true } },
        product: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    revalidatePath('/dashboard/offer-discounts');
    return { success: true, data: JSON.parse(JSON.stringify(created)) };
  } catch (error) {
    console.error('createOfferDiscount error:', error);
    return { success: false, error: 'فشل في إنشاء قاعدة الخصم' };
  }
}

export async function updateOfferDiscount(id: string, formData: FormData) {
  try {
    const auth = await ensureAdmin();
    if (!auth.success) return auth;

    const existing = await prisma.offerDiscount.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'قاعدة الخصم غير موجودة' };
    }

    const offerId = String(formData.get('offerId') || '').trim();
    if (!offerId) {
      return { success: false, error: 'يجب اختيار العرض' };
    }

    const updated = await prisma.offerDiscount.update({
      where: { id },
      data: {
        offerId,
        productId: parseOptionalInt(formData.get('productId')),
        categoryId: parseOptionalInt(formData.get('categoryId')),
        discountType: parseDiscountType(formData.get('discountType')),
        discountValue: parseOptionalFloat(formData.get('discountValue')),
        maxDiscountValue: parseOptionalFloat(formData.get('maxDiscountValue')),
        minOrderAmount: parseOptionalFloat(formData.get('minOrderAmount')),
        usageLimit: parseOptionalInt(formData.get('usageLimit')),
        startsAt: parseOptionalDate(formData.get('startsAt')),
        endsAt: parseOptionalDate(formData.get('endsAt')),
        isActive: String(formData.get('isActive')) === 'true',
      },
      include: {
        offer: { select: { id: true, title: true } },
        product: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    revalidatePath('/dashboard/offer-discounts');
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error) {
    console.error('updateOfferDiscount error:', error);
    return { success: false, error: 'فشل في تحديث قاعدة الخصم' };
  }
}

export async function deleteOfferDiscount(id: string) {
  try {
    const auth = await ensureAdmin();
    if (!auth.success) return auth;

    const existing = await prisma.offerDiscount.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: 'قاعدة الخصم غير موجودة' };
    }

    await prisma.offerDiscount.delete({ where: { id } });

    revalidatePath('/dashboard/offer-discounts');
    return { success: true };
  } catch (error) {
    console.error('deleteOfferDiscount error:', error);
    return { success: false, error: 'فشل في حذف قاعدة الخصم' };
  }
}
