'use server';

import { prisma } from "@/lib/prisma";
import { put, del } from '@vercel/blob';
import { revalidatePath } from "next/cache";

type GeneralSettingsInput = {
  siteName?: string;
  companyEmail?: string;
  companyPhone?: string;
  siteCurrency?: string;
  usdToTryRate?: number | string;
  logo?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  topBannerText?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-z0-9.]/gi, '_')
    .toLowerCase();
}

async function uploadSingleFile(file: File, folder: string) {
  const fileName = `${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const blob = await put(fileName, file, {
    access: 'public',
  });
  return blob.url;
}

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

export async function upsertGeneralSettings(formData: FormData) {
  try {
    const existing = await prisma.generalSetting.findFirst({
      orderBy: { id: "asc" },
      select: { id: true, logo: true }
    });

    const siteName = String(formData.get('siteName') || '').trim() || null;
    const companyEmail = String(formData.get('companyEmail') || '').trim() || null;
    const companyPhone = String(formData.get('companyPhone') || '').trim() || null;
    const siteCurrency = String(formData.get('siteCurrency') || 'USD').trim() || 'USD';
    const usdToTryRate = Number(formData.get('usdToTryRate') || 0);
    const facebookUrl = String(formData.get('facebookUrl') || '').trim() || null;
    const instagramUrl = String(formData.get('instagramUrl') || '').trim() || null;
    const topBannerText = String(formData.get('topBannerText') || '').trim() || null;
    const primaryColor = String(formData.get('primaryColor') || '#10b981').trim() || '#10b981';
    const secondaryColor = String(formData.get('secondaryColor') || '#0f766e').trim() || '#0f766e';

    let logoUrl: string | undefined;
    const logoFile = formData.get('logo');
    if (logoFile instanceof File && logoFile.size > 0) {
      logoUrl = await uploadSingleFile(logoFile, 'logos');

      if (existing?.logo) {
        try { await del(existing.logo); } catch (e) { console.error(e); }
      }
    } else {
      const logoText = formData.get('logo') as string | null;
      if (logoText && logoText.startsWith('http')) {
        logoUrl = logoText;
      }
    }

    const data: any = {
      siteName,
      companyEmail,
      companyPhone,
      siteCurrency,
      usdToTryRate,
      facebookUrl,
      instagramUrl,
      topBannerText,
      primaryColor,
      secondaryColor,
      ...(logoUrl ? { logo: logoUrl } : {}),
    };

    const saved = existing
      ? await prisma.generalSetting.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.generalSetting.create({
          data,
        });

    revalidatePath('/dashboard/settings');
    revalidatePath('/');
    return { success: true, data: saved };
  } catch (error) {
    console.error("upsertGeneralSettings error:", error);
    return { success: false, error: "فشل في حفظ الإعدادات العامة" };
  }
}
