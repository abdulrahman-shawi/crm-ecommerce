'use server';

import { prisma } from "@/lib/prisma";

type GeneralSettingsInput = {
  siteName?: string;
  companyEmail?: string;
  companyPhone?: string;
  siteCurrency?: string;
  usdToTryRate?: number | string;
};

export async function getGeneralSettings() {
  try {
    const data = await prisma.generalSetting.findFirst({
      orderBy: { id: "asc" }
    });

    return { success: true, data };
  } catch (error) {
    console.error("getGeneralSettings error:", error);
    return { success: false, error: "فشل في جلب الإعدادات العامة" };
  }
}

export async function upsertGeneralSettings(payload: GeneralSettingsInput) {
  try {
    const existing = await prisma.generalSetting.findFirst({
      orderBy: { id: "asc" },
      select: { id: true }
    });

    const data = {
      siteName: payload.siteName?.trim() || null,
      companyEmail: payload.companyEmail?.trim() || null,
      companyPhone: payload.companyPhone?.trim() || null,
      siteCurrency: payload.siteCurrency?.trim() || "USD",
      usdToTryRate: Number(payload.usdToTryRate || 0),
    };

    const saved = existing
      ? await prisma.generalSetting.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.generalSetting.create({
          data,
        });

    return { success: true, data: saved };
  } catch (error) {
    console.error("upsertGeneralSettings error:", error);
    return { success: false, error: "فشل في حفظ الإعدادات العامة" };
  }
}
