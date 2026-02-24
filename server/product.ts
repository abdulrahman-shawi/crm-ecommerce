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
