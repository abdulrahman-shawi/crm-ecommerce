"use server";

import { prisma } from "@/lib/prisma";

export async function getshipping() {
    try {
        const res = await prisma.shipping.findMany({
            include: {
                orders: {
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                countryCode: true,
                            },
                        },
                        user: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                        warehouse: {
                            select: {
                                id: true,
                                location: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                }
            }
        });
        return {    success: true, data: res };
    } catch (error) {
        console.error("Error fetching shipping data:", error);
        return { success: false, data: [] };
    }   
}

export async function createshipping(data: any) {
    try {
        const res = await prisma.shipping.create({
            data: {
                name: data.name,
                price: data.price
            }
        });
        return { success: true, data: res };
    } catch (error) {
        console.error("Error creating shipping:", error);
        return { success: false, error: "Failed to create shipping" };
    }
}

export async function updateshipping(id: string, data: any) {   
    try {
        const res = await prisma.shipping.update({
            where: { id: Number(id) },
            data: {
                name: data.name,
                price: data.price
            }
        });
        return { success: true, data: res };
    } catch (error) {
        console.error("Error updating shipping:", error);
        return { success: false, error: "Failed to update shipping" };
    }
}

export async function deletshipping(id: string) {
    try {
        await prisma.shipping.delete({
            where: { id: Number(id) }
        });
        return { success: true };
    } catch (error) {
        console.error("Error deleting shipping:", error);
        return { success: false, error: "Failed to delete shipping" };
    }
}