'use server';

import { buildAffiliateFullUrl } from '@/lib/affiliate';
import { prisma } from "@/lib/prisma";

export async function getProduct() {
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            category: true,
            images: true,
            stocks: {
                include: {
                    warehouse: true,
                },
            },
            landingPage: true,
            affiliateLinks: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            },
        }
    });
    return JSON.parse(JSON.stringify(products));
}

export async function getPublicProductBySlug(slug: string) {
    const normalizedSlug = String(slug || '').trim();
    if (!normalizedSlug) {
        return { success: false, error: 'رابط المنتج غير صالح' };
    }

    const product = await prisma.product.findFirst({
        where: {
            seoSlug: normalizedSlug,
            isActive: true,
        },
        include: {
            category: true,
            images: true,
            landingPage: true,
            reviews: {
                where: { isApproved: true },
                orderBy: { createdAt: 'desc' },
                take: 12,
            },
            stocks: {
                include: {
                    warehouse: true,
                },
                orderBy: {
                    quantity: 'desc',
                },
            },
        },
    });

    if (!product) {
        return { success: false, error: 'المنتج غير موجود' };
    }

    return { success: true, data: JSON.parse(JSON.stringify(product)) };
}

export async function getAffiliateDashboardData() {
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

    const totalClicks = links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);
    const totalConversions = links.reduce((sum, link) => sum + Number(link.conversions || 0), 0);
    const allCommissions = links.flatMap((link) => link.commissions.map((commission) => ({
        ...commission,
        affiliateLink: {
            id: link.id,
            uniqueCode: link.uniqueCode,
            commissionRate: link.commissionRate,
            user: link.user,
            product: link.product,
            fullUrl: buildAffiliateFullUrl(link.product?.seoSlug, link.uniqueCode),
        },
    })));

    const totalCommissions = allCommissions.reduce((sum, commission) => sum + Number(commission.amount || 0), 0);
    const pendingCommissions = allCommissions
        .filter((commission) => commission.status === 'PENDING')
        .reduce((sum, commission) => sum + Number(commission.amount || 0), 0);
    const paidCommissions = allCommissions
        .filter((commission) => commission.status === 'PAID')
        .reduce((sum, commission) => sum + Number(commission.amount || 0), 0);

    return {
        success: true,
        data: {
            totalClicks,
            totalConversions,
            totalCommissions: Number(totalCommissions.toFixed(2)),
            pendingCommissions: Number(pendingCommissions.toFixed(2)),
            paidCommissions: Number(paidCommissions.toFixed(2)),
            links: links.map((link) => ({
                ...link,
                fullUrl: buildAffiliateFullUrl(link.product?.seoSlug, link.uniqueCode),
            })),
            commissions: allCommissions,
        },
    };
}

function generateAffiliateCode() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function createUniqueAffiliateCode() {
    let attempts = 0;
    while (attempts < 10) {
        const uniqueCode = generateAffiliateCode();
        const exists = await prisma.affiliateLink.findUnique({
            where: { uniqueCode },
            select: { id: true },
        });
        if (!exists) {
            return uniqueCode;
        }
        attempts += 1;
    }

    throw new Error('تعذر إنشاء كود إحالة فريد');
}

export async function createAffiliateLink(input: {
    userId: string;
    productId: number;
    commissionRate: number;
}) {
    const userId = String(input.userId || '').trim();
    const productId = Number(input.productId || 0);
    const commissionRate = Number(input.commissionRate || 0);

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
                fullUrl: buildAffiliateFullUrl(existing.product?.seoSlug, existing.uniqueCode),
            },
        };
    }

    const uniqueCode = await createUniqueAffiliateCode();
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
            fullUrl: buildAffiliateFullUrl(link.product?.seoSlug, link.uniqueCode),
        },
    };
}

export async function toggleProductActive(productId: number, isActive: boolean) {
    try {
        await prisma.product.update({
            where: { id: productId },
            data: { isActive }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || "فشل تحديث حالة المنتج" };
    }
}

export async function toggleProductShowInAds(productId: number, showInAds: boolean) {
    try {
        await prisma.product.update({
            where: { id: productId },
            data: { showInAds }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || "فشل تحديث حالة الإعلانات" };
    }
}

export interface LandingPageInput {
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    heroDescription?: string | null;
    badgeText?: string | null;
    discountPercent?: number | null;
    features?: Array<{ title: string; description: string }>;
    showReviews?: boolean;
    showGuarantee?: boolean;
    guaranteeTitle?: string | null;
    guaranteeText?: string | null;
    ctaText?: string | null;
    isActive?: boolean;
}

export async function upsertProductLandingPage(productId: number, data: LandingPageInput) {
    try {
        const features = Array.isArray(data.features) ? data.features : [];

        await prisma.$transaction([
            prisma.product.update({
                where: { id: productId },
                data: { showInAds: true }
            }),
            prisma.productLandingPage.upsert({
                where: { productId },
                create: {
                    productId,
                    heroTitle: data.heroTitle || null,
                    heroSubtitle: data.heroSubtitle || null,
                    heroDescription: data.heroDescription || null,
                    badgeText: data.badgeText || null,
                    discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
                    features: features as any,
                    showReviews: data.showReviews ?? true,
                    showGuarantee: data.showGuarantee ?? true,
                    guaranteeTitle: data.guaranteeTitle || null,
                    guaranteeText: data.guaranteeText || null,
                    ctaText: data.ctaText || null,
                    isActive: data.isActive ?? true,
                },
                update: {
                    heroTitle: data.heroTitle || null,
                    heroSubtitle: data.heroSubtitle || null,
                    heroDescription: data.heroDescription || null,
                    badgeText: data.badgeText || null,
                    discountPercent: data.discountPercent ? Number(data.discountPercent) : null,
                    features: features as any,
                    showReviews: data.showReviews ?? true,
                    showGuarantee: data.showGuarantee ?? true,
                    guaranteeTitle: data.guaranteeTitle || null,
                    guaranteeText: data.guaranteeText || null,
                    ctaText: data.ctaText || null,
                    isActive: data.isActive ?? true,
                }
            })
        ]);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || "فشل حفظ صفحة الهبوط" };
    }
}

export async function getProductCatalog() {
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            stocks: {
                select: {
                    id: true,
                    quantity: true,
                    price: true,
                    discount: true,
                    warehouse: {
                        select: {
                            id: true,
                            location: true,
                        },
                    },
                },
            },
        },
    });

    return JSON.parse(JSON.stringify(products));
}
