'use server';

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
        }
    });
    return JSON.parse(JSON.stringify(products));
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
