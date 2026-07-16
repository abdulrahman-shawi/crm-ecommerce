"use server";

import { prisma } from "@/lib/prisma";

const warehouseInclude = {
    country: true,
    _count: {
        select: {
            stocks: true,
        },
    },
} as const;

const mapWarehouse = (warehouse: any) => ({
    ...warehouse,
    location: warehouse.country?.name || warehouse.location,
});

const resolveCountryId = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getWarehouse  = async () => {
    const warehouses = await prisma.warehouse.findMany({
        orderBy: { createdAt: 'desc' },
        include: warehouseInclude,
    });
    return JSON.parse(JSON.stringify(warehouses.map(mapWarehouse)));
}

export const createWarehouse = async (data: any) => {
    try {
        const countryId = resolveCountryId(data.countryId);

        if (!countryId) {
            return { success: false, error: "يرجى اختيار بلد المستودع" };
        }

        const country = await prisma.country.findUnique({
            where: { id: countryId },
            select: { id: true, name: true },
        });

        if (!country) {
            return { success: false, error: "البلد المحدد غير موجود" };
        }

        const warehouse = await prisma.warehouse.create({
            data: {
                name: data.name,
                location: country.name,
                countryId: country.id,
            },
            include: warehouseInclude,
        });
        return { success: true, data: mapWarehouse(warehouse) };
    } catch (error: any) {
        console.error("Prisma Error:", error);
        return { success: false, error: "فشل في إنشاء المستودع، يرجى التحقق من المدخلات" };
    }
}

export const updateWarehouse = async (id: string, data: any) => {
    try {
        const countryId = resolveCountryId(data.countryId);

        if (!countryId) {
            return { success: false, error: "يرجى اختيار بلد المستودع" };
        }

        const country = await prisma.country.findUnique({
            where: { id: countryId },
            select: { id: true, name: true },
        });

        if (!country) {
            return { success: false, error: "البلد المحدد غير موجود" };
        }

        const warehouse = await prisma.warehouse.update({
            where: { id: Number(id) },
            data: {
                name: data.name,
                location: country.name,
                countryId: country.id,
            },
            include: warehouseInclude,
        });
        return { success: true, data: mapWarehouse(warehouse) };
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