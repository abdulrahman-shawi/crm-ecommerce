'use server';

import { decrypt } from '@/lib/auth';
import { buildAdFullUrl, buildAffiliateFullUrl } from '@/lib/affiliate';
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';

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

function normalizeAnalyticsLabel(value?: string | null, fallback: string = 'غير محدد') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function normalizeReferrerLabel(value?: string | null) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return 'مباشر / بدون مرجع';
    }

    try {
        const url = new URL(normalized);
        return url.hostname.replace(/^www\./i, '') || normalized;
    } catch {
        return normalized;
    }
}

function buildBreakdown(values: Array<string>, fallback: string) {
    const counts = new Map<string, number>();

    values.forEach((value) => {
        const label = normalizeAnalyticsLabel(value, fallback);
        counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts.entries())
        .sort((first, second) => second[1] - first[1])
        .map(([label, count]) => ({ label, count }));
}

function isAdAnalyticsTableMissing(error: any) {
    const code = String(error?.code || '').trim();
    const message = String(error?.message || '').trim();

    if (code === 'P2021' || code === 'P2022') {
        return true;
    }

    return /ad_page_visits|AdPageVisit/i.test(message) && /does not exist|not exist|missing/i.test(message);
}

export async function getProduct() {
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            category: true,
            images: {
                orderBy: { id: 'asc' },
            },
            stocks: {
                include: {
                    warehouse: true,
                },
            },
            landingPage: true,
            wholesalePricingTiers: {
                orderBy: { minQuantity: 'asc' },
            },
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

    const numericProductId = Number(normalizedSlug);

    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { seoSlug: normalizedSlug },
                ...(Number.isInteger(numericProductId) && numericProductId > 0 ? [{ id: numericProductId }] : []),
            ],
            isActive: true,
        },
        include: {
            category: true,
            images: {
                orderBy: { id: 'asc' },
            },
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

export async function getPublicAdProductById(productIdInput: number | string) {
    const productId = Number(productIdInput || 0);

    if (!Number.isInteger(productId) || productId <= 0) {
        return { success: false, error: 'رابط الإعلان غير صالح' };
    }

    const product = await prisma.product.findFirst({
        where: {
            id: productId,
            isActive: true,
            showInAds: true,
            landingPage: {
                is: {
                    isActive: true,
                },
            },
        },
        include: {
            category: true,
            images: {
                orderBy: { id: 'asc' },
            },
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
        return { success: false, error: 'الإعلان غير موجود أو غير مفعل' };
    }

    return { success: true, data: JSON.parse(JSON.stringify(product)) };
}

export async function getAdPagesDashboardAnalytics() {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || currentUser.accountType !== 'ADMIN') {
        return { success: false, error: 'غير مصرح لك بعرض تحليلات صفحات الإعلان' };
    }

    const adProducts = await prisma.product.findMany({
        where: {
            showInAds: true,
            isActive: true,
            landingPage: {
                is: {
                    isActive: true,
                },
            },
        },
        select: {
            id: true,
            name: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    let visits: Array<{
        visitorId: string;
        referrer: string | null;
        browser: string | null;
        os: string | null;
        deviceType: string | null;
        createdAt: Date;
        product: { id: number; name: string };
    }> = [];
    let adOrderItems: Array<{ productId: number; orderId: number }> = [];
    let warrantyRows: Array<{
        productId: number;
        type: 'REPLACEMENT' | 'MAINTENANCE' | 'DAMAGED';
        quantity: number | null;
    }> = [];

    try {
        visits = await prisma.adPageVisit.findMany({
            where: {
                product: {
                    showInAds: true,
                },
            },
            select: {
                visitorId: true,
                referrer: true,
                browser: true,
                os: true,
                deviceType: true,
                createdAt: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    } catch (error: any) {
        if (!isAdAnalyticsTableMissing(error)) {
            return { success: false, error: 'تعذر تحميل تحليلات صفحات الإعلان' };
        }
    }

    try {
        adOrderItems = await prisma.orderItem.findMany({
            where: {
                productId: {
                    in: adProducts.map((product) => product.id),
                },
                order: {
                    additionalNotes: {
                        contains: 'source:ad',
                    },
                },
            },
            select: {
                productId: true,
                orderId: true,
            },
        });
    } catch {
        adOrderItems = [];
    }

    try {
        warrantyRows = await prisma.warranty.findMany({
            where: {
                productId: {
                    in: adProducts.map((product) => product.id),
                },
            },
            select: {
                productId: true,
                type: true,
                quantity: true,
            },
        });
    } catch {
        warrantyRows = [];
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(last7DaysStart.getDate() - 6);
    last7DaysStart.setHours(0, 0, 0, 0);

    const productsMap = new Map<number, {
        productId: number;
        productName: string;
        adUrl: string;
        totalViews: number;
        adOrders: Set<number>;
        uniqueVisitors: Set<string>;
        viewsToday: number;
        viewsLast7Days: number;
        lastVisitedAt: Date | null;
        replacementCount: number;
        replacementQuantity: number;
        maintenanceCount: number;
        maintenanceQuantity: number;
        damagedCount: number;
        damagedQuantity: number;
    }>();

    adProducts.forEach((product) => {
        productsMap.set(product.id, {
            productId: product.id,
            productName: product.name,
            adUrl: buildAdFullUrl(product.id),
            totalViews: 0,
            adOrders: new Set<number>(),
            uniqueVisitors: new Set<string>(),
            viewsToday: 0,
            viewsLast7Days: 0,
            lastVisitedAt: null,
            replacementCount: 0,
            replacementQuantity: 0,
            maintenanceCount: 0,
            maintenanceQuantity: 0,
            damagedCount: 0,
            damagedQuantity: 0,
        });
    });

    visits.forEach((visit) => {
        const productEntry = productsMap.get(visit.product.id);
        if (!productEntry) {
            return;
        }

        productEntry.totalViews += 1;
        productEntry.uniqueVisitors.add(String(visit.visitorId || ''));

        if (visit.createdAt >= todayStart) {
            productEntry.viewsToday += 1;
        }

        if (visit.createdAt >= last7DaysStart) {
            productEntry.viewsLast7Days += 1;
        }

        if (!productEntry.lastVisitedAt || visit.createdAt > productEntry.lastVisitedAt) {
            productEntry.lastVisitedAt = visit.createdAt;
        }
    });

    adOrderItems.forEach((item) => {
        const productEntry = productsMap.get(item.productId);
        if (!productEntry) {
            return;
        }

        productEntry.adOrders.add(Number(item.orderId || 0));
    });

    warrantyRows.forEach((row) => {
        const productEntry = productsMap.get(row.productId);
        if (!productEntry) {
            return;
        }

        const quantity = Math.max(0, Number(row.quantity || 0));

        if (row.type === 'REPLACEMENT') {
            productEntry.replacementCount += 1;
            productEntry.replacementQuantity += quantity;
            return;
        }

        if (row.type === 'MAINTENANCE') {
            productEntry.maintenanceCount += 1;
            productEntry.maintenanceQuantity += quantity;
            return;
        }

        if (row.type === 'DAMAGED') {
            productEntry.damagedCount += 1;
            productEntry.damagedQuantity += quantity;
        }
    });

    const products = Array.from(productsMap.values())
        .map((entry) => {
            const ordersCount = entry.adOrders.size;
            const conversionRate = entry.totalViews > 0 ? Number(((ordersCount / entry.totalViews) * 100).toFixed(2)) : 0;

            return {
                productId: entry.productId,
                productName: entry.productName,
                adUrl: entry.adUrl,
                totalViews: entry.totalViews,
                ordersCount,
                conversionRate,
                uniqueVisitors: entry.uniqueVisitors.size,
                viewsToday: entry.viewsToday,
                viewsLast7Days: entry.viewsLast7Days,
                lastVisitedAt: entry.lastVisitedAt,
                replacementCount: entry.replacementCount,
                replacementQuantity: entry.replacementQuantity,
                maintenanceCount: entry.maintenanceCount,
                maintenanceQuantity: entry.maintenanceQuantity,
                damagedCount: entry.damagedCount,
                damagedQuantity: entry.damagedQuantity,
            };
        })
        .sort((first, second) => second.totalViews - first.totalViews || second.viewsLast7Days - first.viewsLast7Days);

    return {
        success: true,
        data: {
            summary: {
                configuredAdsCount: adProducts.length,
                trackedAdsCount: products.filter((product) => product.totalViews > 0).length,
                totalViews: visits.length,
                totalOrders: products.reduce((sum, product) => sum + Number(product.ordersCount || 0), 0),
                uniqueVisitors: new Set(visits.map((visit) => String(visit.visitorId || ''))).size,
                viewsToday: visits.filter((visit) => visit.createdAt >= todayStart).length,
                viewsLast7Days: visits.filter((visit) => visit.createdAt >= last7DaysStart).length,
            },
            warrantySummary: {
                replacementCount: products.reduce((sum, product) => sum + Number(product.replacementCount || 0), 0),
                replacementQuantity: products.reduce((sum, product) => sum + Number(product.replacementQuantity || 0), 0),
                maintenanceCount: products.reduce((sum, product) => sum + Number(product.maintenanceCount || 0), 0),
                maintenanceQuantity: products.reduce((sum, product) => sum + Number(product.maintenanceQuantity || 0), 0),
                damagedCount: products.reduce((sum, product) => sum + Number(product.damagedCount || 0), 0),
                damagedQuantity: products.reduce((sum, product) => sum + Number(product.damagedQuantity || 0), 0),
            },
            products,
        },
    };
}

export async function getPublicAffiliateProductByCode(code: string) {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) {
        return { success: false, error: 'رابط الأفلييت غير صالح' };
    }

    const link = await prisma.affiliateLink.findUnique({
        where: { uniqueCode: normalizedCode },
        include: {
            product: {
                include: {
                    category: true,
                    images: {
                        orderBy: { id: 'asc' },
                    },
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
            },
        },
    });

    if (!link || !link.product || !link.product.isActive) {
        return { success: false, error: 'المنتج المرتبط برابط الأفلييت غير موجود' };
    }

    return {
        success: true,
        data: {
            affiliateCode: normalizedCode,
            product: JSON.parse(JSON.stringify(link.product)),
        },
    };
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
            fullUrl: buildAffiliateFullUrl(link.product?.seoSlug, link.uniqueCode, link.product?.id),
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
                fullUrl: buildAffiliateFullUrl(link.product?.seoSlug, link.uniqueCode, link.product?.id),
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
                fullUrl: buildAffiliateFullUrl(existing.product?.seoSlug, existing.uniqueCode, existing.product?.id),
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
            fullUrl: buildAffiliateFullUrl(link.product?.seoSlug, link.uniqueCode, link.product?.id),
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
    quantityDiscountTiers?: Array<{ minQuantity: number; discountPercent: number }>;
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
        const quantityDiscountTiers = Array.isArray(data.quantityDiscountTiers) ? data.quantityDiscountTiers : [];

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
                    quantityDiscountTiers: quantityDiscountTiers as any,
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
                    quantityDiscountTiers: quantityDiscountTiers as any,
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
            modelNumber: true,
            wholesalePrice: true,
            wholesalePricingTiers: {
                orderBy: { minQuantity: 'asc' },
                select: {
                    id: true,
                    minQuantity: true,
                    maxQuantity: true,
                    price: true,
                },
            },
            stocks: {
                select: {
                    id: true,
                    quantity: true,
                    price: true,
                    wholesalePrice: true,
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
