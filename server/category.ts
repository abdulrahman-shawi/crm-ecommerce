'use server';

import { prisma } from "@/lib/prisma";
import { put, del } from '@vercel/blob';
import { revalidatePath } from "next/cache";

function sanitizeFileName(fileName: string) {
    return fileName
        .replace(/[^a-z0-9.]/gi, '_')
        .toLowerCase();
}

async function uploadSingleFile(file: File) {
    const fileName = `categories/${Date.now()}-${sanitizeFileName(file.name)}`;
    const blob = await put(fileName, file, {
        access: 'public',
    });
    return {
        url: blob.url,
        type: file.type
    };
}

export async function getallcategory() {
  const category = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include:{
        products:true
    }
  });
  return JSON.parse(JSON.stringify(category));
}

export async function createcategory(formData: FormData) {
  try {
    const name = String(formData.get('name') || '').trim();
    const isVisible = String(formData.get('isVisible') || '').toLowerCase() === 'true';
    const fileEntry = formData.get('image');
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

    let imageUrl: string | undefined;
    if (file) {
      const uploaded = await uploadSingleFile(file);
      imageUrl = uploaded.url;
    }

    const category = await prisma.category.create({
      data: {
        name,
        isVisible,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
    });

    revalidatePath('/dashboard/categories');
    return { success: true, data: category };
  } catch (error: any) {
    console.error("Prisma Error:", error);
    
    if (error.code === 'P2002') {
      return { success: false, error: "هذه الفئة موجودة بالفعل" };
    }
    
    return { success: false, error: "فشل في إنشاء الفئة، يرجى التحقق من المدخلات" };
  }
}

export async function updatecategory(id: string, formData: FormData) {
  try {
    const name = String(formData.get('name') || '').trim();
    const isVisible = String(formData.get('isVisible') || '').toLowerCase() === 'true';
    const fileEntry = formData.get('image');
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

    let imageUrl: string | undefined;
    if (file) {
      const uploaded = await uploadSingleFile(file);
      imageUrl = uploaded.url;

      const existing = await prisma.category.findUnique({
        where: { id: Number(id) },
        select: { image: true },
      });
      if (existing?.image) {
        try { await del(existing.image); } catch (e) { console.error(e); }
      }
    }

    const category = await prisma.category.update({
        where: { id: Number(id) },
        data: {
            name,
        isVisible,
            ...(imageUrl ? { image: imageUrl } : {}),
        },
    });

    revalidatePath('/dashboard/categories');
    return { success: true, data: category };
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return { success: false, error: "فشل في تحديث بيانات الفئة" };
  } 
}

export async function deletecategory(id: string) {  
    try {
        const existing = await prisma.category.findUnique({
          where: { id: Number(id) },
          select: { image: true },
        });

        if (existing?.image) {
          try { await del(existing.image); } catch (e) { console.error(e); }
        }

        await prisma.category.delete({ where: { id: Number(id) } });
        revalidatePath('/dashboard/categories');
        return { success: true };
    } catch (error) {
        return { success: false, error: "فشل الحذف" };
    }   
}
