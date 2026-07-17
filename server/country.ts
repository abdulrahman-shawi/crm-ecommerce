"use server";

import { prisma } from "@/lib/prisma";

const normalizeCountryName = (value: unknown) => String(value || "").trim();

export const getCountries = async () => {
    const countries = await prisma.country.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: {
                    cities: true,
                    warehouses: true,
                },
            },
        },
    });

    return JSON.parse(JSON.stringify(countries));
};

export const createCountry = async (data: any) => {
    try {
        const name = normalizeCountryName(data.name);

        if (name.length < 2) {
            return { success: false, error: "اسم البلد مطلوب" };
        }

        const country = await prisma.country.create({
            data: { name },
            include: {
                _count: {
                    select: {
                        warehouses: true,
                    },
                },
            },
        });

        return { success: true, data: country };
    } catch (error: any) {
        console.error("Country create error:", error);
        return { success: false, error: "فشل في إنشاء البلد، تأكد من أن الاسم غير مكرر" };
    }
};

export const updateCountry = async (id: string, data: any) => {
    try {
        const countryId = Number(id);
        const name = normalizeCountryName(data.name);

        if (!Number.isInteger(countryId) || countryId <= 0) {
            return { success: false, error: "معرّف البلد غير صالح" };
        }

        if (name.length < 2) {
            return { success: false, error: "اسم البلد مطلوب" };
        }

        const country = await prisma.$transaction(async (tx) => {
            const updatedCountry = await tx.country.update({
                where: { id: countryId },
                data: { name },
                include: {
                    _count: {
                        select: {
                            cities: true,
                            warehouses: true,
                        },
                    },
                },
            });

            await tx.warehouse.updateMany({
                where: { countryId },
                data: { location: name },
            });

            return updatedCountry;
        });

        return { success: true, data: country };
    } catch (error: any) {
        console.error("Country update error:", error);
        return { success: false, error: "فشل في تحديث البلد" };
    }
};

export const deleteCountry = async (id: string) => {
    try {
        const countryId = Number(id);

        if (!Number.isInteger(countryId) || countryId <= 0) {
            return { success: false, error: "معرّف البلد غير صالح" };
        }

        const linkedWarehouses = await prisma.warehouse.count({
            where: { countryId },
        });

        const linkedCities = await prisma.city.count({
            where: { countryId },
        });

        if (linkedWarehouses > 0 || linkedCities > 0) {
            return { success: false, error: "لا يمكن حذف البلد لوجود مدن أو مستودعات مرتبطة به" };
        }

        await prisma.country.delete({
            where: { id: countryId },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Country delete error:", error);
        return { success: false, error: "فشل في حذف البلد" };
    }
};