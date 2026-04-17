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

export async function getProductCatalog() {
    const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            stocks: {
                select: {
                    id: true,
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
