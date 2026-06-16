'use server';

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { put, del } from '@vercel/blob';

async function getCurrentUser() {
  try {
    const session = cookies().get("skynova")?.value;
    if (!session) return null;

    const decoded = await decrypt(session);
    if (!decoded?.userId) return null;

    return prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      select: { id: true, accountType: true },
    });
  } catch {
    return null;
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
}

async function uploadSlideImage(file: File) {
  const fileName = `hero-slides/${Date.now()}-${sanitizeFileName(file.name)}`;
  const blob = await put(fileName, file, { access: 'public' });
  return blob.url;
}

export async function getHeroSlides() {
  try {
    const slides = await prisma.heroSlide.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return { success: true, data: JSON.parse(JSON.stringify(slides)) };
  } catch (error) {
    console.error("getHeroSlides error:", error);
    return { success: false, error: "فشل في جلب السلايدرات" };
  }
}

export async function getActiveHeroSlides() {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { success: true, data: JSON.parse(JSON.stringify(slides)) };
  } catch (error) {
    console.error("getActiveHeroSlides error:", error);
    return { success: false, error: "فشل في جلب السلايدرات" };
  }
}

export async function createHeroSlide(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.accountType !== "ADMIN") {
      return { success: false, error: "غير مصرح" };
    }

    const title = String(formData.get('title') || '').trim() || null;
    const subtitle = String(formData.get('subtitle') || '').trim() || null;
    const buttonText = String(formData.get('buttonText') || '').trim() || null;
    const buttonLink = String(formData.get('buttonLink') || '').trim() || null;
    const sortOrder = Number(formData.get('sortOrder') || 0);
    const isActive = formData.get('isActive') === 'true';

    const imageFile = formData.get('image');
    if (!(imageFile instanceof File) || imageFile.size === 0) {
      return { success: false, error: "صورة السلايد مطلوبة" };
    }

    const imageUrl = await uploadSlideImage(imageFile);

    const slide = await prisma.heroSlide.create({
      data: {
        title,
        subtitle,
        image: imageUrl,
        buttonText,
        buttonLink,
        sortOrder,
        isActive,
      },
    });

    revalidatePath('/dashboard/hero-slides');
    revalidatePath('/');
    return { success: true, data: JSON.parse(JSON.stringify(slide)) };
  } catch (error) {
    console.error("createHeroSlide error:", error);
    return { success: false, error: "فشل في إنشاء السلايد" };
  }
}

export async function updateHeroSlide(id: string, formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.accountType !== "ADMIN") {
      return { success: false, error: "غير مصرح" };
    }

    const existing = await prisma.heroSlide.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "السلايد غير موجود" };
    }

    const title = String(formData.get('title') || '').trim() || null;
    const subtitle = String(formData.get('subtitle') || '').trim() || null;
    const buttonText = String(formData.get('buttonText') || '').trim() || null;
    const buttonLink = String(formData.get('buttonLink') || '').trim() || null;
    const sortOrder = Number(formData.get('sortOrder') || 0);
    const isActive = formData.get('isActive') === 'true';

    let imageUrl: string | undefined;
    const imageFile = formData.get('image');
    if (imageFile instanceof File && imageFile.size > 0) {
      imageUrl = await uploadSlideImage(imageFile);
      if (existing.image) {
        try { await del(existing.image); } catch (e) { console.error(e); }
      }
    } else {
      const imageText = formData.get('image') as string | null;
      if (imageText && imageText.startsWith('http')) {
        imageUrl = imageText;
      }
    }

    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        title,
        subtitle,
        buttonText,
        buttonLink,
        sortOrder,
        isActive,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
    });

    revalidatePath('/dashboard/hero-slides');
    revalidatePath('/');
    return { success: true, data: JSON.parse(JSON.stringify(slide)) };
  } catch (error) {
    console.error("updateHeroSlide error:", error);
    return { success: false, error: "فشل في تحديث السلايد" };
  }
}

export async function deleteHeroSlide(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.accountType !== "ADMIN") {
      return { success: false, error: "غير مصرح" };
    }

    const existing = await prisma.heroSlide.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "السلايد غير موجود" };
    }

    if (existing.image) {
      try { await del(existing.image); } catch (e) { console.error(e); }
    }

    await prisma.heroSlide.delete({ where: { id } });

    revalidatePath('/dashboard/hero-slides');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("deleteHeroSlide error:", error);
    return { success: false, error: "فشل في حذف السلايد" };
  }
}
