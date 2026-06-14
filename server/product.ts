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
