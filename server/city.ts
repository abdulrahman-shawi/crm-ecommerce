"use server";

import { prisma } from "@/lib/prisma";

const normalizeCityName = (value: unknown) => String(value || "").trim();

const resolveCountryId = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getCities = async () => {
    const cities = await prisma.city.findMany({
        orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
        include: {
            country: true,
        },
    });

    return JSON.parse(JSON.stringify(cities));
};

export const createCity = async (data: any) => {
    try {
        const name = normalizeCityName(data.name);
        const countryId = resolveCountryId(data.countryId);

        if (name.length < 2) {
            return { success: false, error: "اسم المدينة مطلوب" };
        }

        if (!countryId) {
            return { success: false, error: "يرجى اختيار بلد المدينة" };
        }

        const city = await prisma.city.create({
            data: {
                name,
                countryId,
            },
            include: {
                country: true,
            },
        });

        return { success: true, data: city };
    } catch (error: any) {
        console.error("City create error:", error);
        return { success: false, error: "فشل في إنشاء المدينة، تأكد من أن الاسم غير مكرر داخل نفس البلد" };
    }
};

export const updateCity = async (id: string, data: any) => {
    try {
        const cityId = Number(id);
        const name = normalizeCityName(data.name);
        const countryId = resolveCountryId(data.countryId);

        if (!Number.isInteger(cityId) || cityId <= 0) {
            return { success: false, error: "معرّف المدينة غير صالح" };
        }

        if (name.length < 2) {
            return { success: false, error: "اسم المدينة مطلوب" };
        }

        if (!countryId) {
            return { success: false, error: "يرجى اختيار بلد المدينة" };
        }

        const city = await prisma.city.update({
            where: { id: cityId },
            data: {
                name,
                countryId,
            },
            include: {
                country: true,
            },
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

        await prisma.city.delete({
            where: { id: cityId },
        });

        return { success: true };
    } catch (error: any) {
        console.error("City delete error:", error);
        return { success: false, error: "فشل في حذف المدينة" };
    }
};