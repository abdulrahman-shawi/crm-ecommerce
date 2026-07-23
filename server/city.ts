"use server";

import { prisma } from "@/lib/prisma";

export const getCities = async () => {
    const cities = await prisma.city.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            country: {
                select: { id: true, name: true },
            },
            _count: {
                select: {
                    warehouses: true,
                },
            },
        },
    });

    return JSON.parse(JSON.stringify(cities));
};

export const createCity = async (data: any) => {
    try {
        const name = String(data?.name || "").trim();
        const countryId = Number(data?.countryId || 0);

        if (!name) {
            return { success: false, error: "اسم المدينة مطلوب" };
        }
        if (!Number.isInteger(countryId) || countryId <= 0) {
            return { success: false, error: "البلد مطلوب" };
        }

        const country = await prisma.country.findUnique({
            where: { id: countryId },
            select: { id: true },
        });

        if (!country) {
            return { success: false, error: "البلد المحدد غير موجود" };
        }

        const city = await prisma.city.create({
            data: { name, countryId },
            include: { country: true },
        });

        return { success: true, data: city };
    } catch (error: any) {
        console.error("City create error:", error);
        return { success: false, error: "فشل في إنشاء المدينة، قد يكون الاسم مكرراً" };
    }
};

export const updateCity = async (id: string, data: any) => {
    try {
        const cityId = Number(id);
        const name = String(data?.name || "").trim();
        const countryId = Number(data?.countryId || 0);

        if (!Number.isInteger(cityId) || cityId <= 0) {
            return { success: false, error: "معرّف المدينة غير صالح" };
        }
        if (!name) {
            return { success: false, error: "اسم المدينة مطلوب" };
        }
        if (!Number.isInteger(countryId) || countryId <= 0) {
            return { success: false, error: "البلد مطلوب" };
        }

        const city = await prisma.city.update({
            where: { id: cityId },
            data: { name, countryId },
            include: { country: true },
        });

        return { success: true, data: city };
    } catch (error: any) {
        console.error("City update error:", error);
        return { success: false, error: "فشل في تحديث المدينة" };
    }
};

export const deleteCity = async (id: string) => {
    try {
        const cityId = Number(id);

        if (!Number.isInteger(cityId) || cityId <= 0) {
            return { success: false, error: "معرّف المدينة غير صالح" };
        }

        const linkedWarehouses = await prisma.warehouse.count({
            where: { cityId },
        });

        if (linkedWarehouses > 0) {
            return { success: false, error: "لا يمكن حذف المدينة لوجود مستودعات مرتبطة بها" };
        }

        await prisma.city.delete({
            where: { id: cityId },
        });

        return { success: true };
    } catch (error: any) {
        console.error("City delete error:", error);
        return { success: false, error: "فشل في حذف المدينة" };
    }
};
