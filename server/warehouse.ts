"use server";

import { prisma } from "@/lib/prisma";

export const getWarehouse  = async () => {
    // من هنا يمكنك إضافة منطق الحصول على بيانات المستودع
    const warehouses = await prisma.warehouse.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: {
                    stocks: true,
                },
            },
        },
    });
    return JSON.parse(JSON.stringify(warehouses));
}

export const createWarehouse = async (data: any) => {
    try {
        const warehouse = await prisma.warehouse.create({
            data: {
                name: data.name,
                location: data.location,
            },
        });
        return { success: true, data: warehouse };
    } catch (error: any) {
        console.error("Prisma Error:", error);
        return { success: false, error: "فشل في إنشاء المستودع، يرجى التحقق من المدخلات" };
    }
}

export const updateWarehouse = async (id: string, data: any) => {
    try {
        const warehouse = await prisma.warehouse.update({
            where: { id: Number(id) },
            data: {
                name: data.name,
                location: data.location,
            },
        });
        return { success: true, data: warehouse };
    } catch (error: any) {
        console.error("Prisma Error:", error);
        return { success: false, error: "فشل في تحديث بيانات المستودع" };
    }   
}

export const deleteWarehouse = async (id: string) => {
    try {
        await prisma.warehouse.delete({
            where: { id: Number(id) },
        });
        return { success: true };
    } catch (error: any) {
        console.error("Prisma Error:", error);
        return { success: false, error: "فشل في حذف المستودع، قد يكون مرتبطًا بسجلات أخرى" };
    }   
}