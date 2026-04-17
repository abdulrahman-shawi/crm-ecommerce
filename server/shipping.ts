"use server";

import { prisma } from "@/lib/prisma";

export async function getshipping() {
    try {
        const res = await prisma.shipping.findMany({
            orderBy: {
                name: "asc",
            },
            select: {
                id: true,
                name: true,
                price: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return {    success: true, data: res };
    } catch (error) {
        console.error("Error fetching shipping data:", error);
        return { success: false, data: [] };
    }   
}

export async function getshippingWithOrders() {
    try {
        const res = await prisma.shipping.findMany({
            orderBy: {
                name: "asc",
            },
            select: {
                id: true,
                name: true,
                price: true,
                createdAt: true,
                updatedAt: true,
                orders: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    select: {
                        id: true,
                        orderNumber: true,
                        finalAmount: true,
                        status: true,
                        city: true,
                        createdAt: true,
                        manualCreatedAt: true,
                        shippingPrice: true,
                        moneyTransferCommission: true,
                        otherCommissions: true,
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
                },
            },
        });
        return { success: true, data: res };
    } catch (error) {
        console.error("Error fetching shipping details:", error);
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