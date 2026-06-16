'use server';

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PermissionKey, User } from "@/lib/type";
import { hasPermission } from "@/lib/utils";

/**
 * تجلب المستخدم الحالي مع صلاحياته من الجلسة.
 */
async function getCurrentUser(): Promise<User | null> {
  try {
    const session = cookies().get("skynova")?.value;
    if (!session) return null;

    const decoded = await decrypt(session);
    if (!decoded?.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      include: { permission: true },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      jobTitle: user.jobTitle,
      avatar: user.avatar,
      accountType: user.accountType,
      password: user.password,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      permissionId: user.permissionId,
      permission: user.permission,
    } as User;
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}

/**
 * تتحقق من صلاحية المستخدم الحالي على الصفحات الثابتة.
 */
async function checkPagePermission(permission: PermissionKey): Promise<{ allowed: boolean; user: User | null }> {
  const user = await getCurrentUser();
  return { allowed: hasPermission(user, permission), user };
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0621-\u064A\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * جلب جميع الصفحات (للوحة التحكم).
 */
export async function getAllPages() {
  try {
    const { allowed } = await checkPagePermission("viewPages");
    if (!allowed) {
      return { success: false, error: "غير مصرح لك بعرض الصفحات" };
    }

    const pages = await prisma.page.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return { success: true, data: JSON.parse(JSON.stringify(pages)) };
  } catch (error) {
    console.error("Get all pages error:", error);
    return { success: false, error: "فشل في جلب الصفحات" };
  }
}

/**
 * جلب الصفحات المنشورة فقط (للواجهة الأمامية).
 */
export async function getPublishedPages() {
  try {
    const pages = await prisma.page.findMany({
      where: { isPublished: true },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, slug: true },
    });

    return { success: true, data: JSON.parse(JSON.stringify(pages)) };
  } catch (error) {
    console.error("Get published pages error:", error);
    return { success: false, error: "فشل في جلب الصفحات" };
  }
}

/**
 * جلب صفحة واحدة حسب الـ slug (للواجهة الأمامية).
 */
export async function getPageBySlug(slug: string) {
  try {
    const page = await prisma.page.findUnique({
      where: { slug },
    });

    if (!page || !page.isPublished) {
      return { success: false, error: "الصفحة غير موجودة" };
    }

    return { success: true, data: JSON.parse(JSON.stringify(page)) };
  } catch (error) {
    console.error("Get page by slug error:", error);
    return { success: false, error: "فشل في جلب الصفحة" };
  }
}

/**
 * إنشاء صفحة جديدة.
 */
export async function createPage(formData: FormData) {
  try {
    const { allowed } = await checkPagePermission("addPages");
    if (!allowed) {
      return { success: false, error: "غير مصرح لك بإضافة صفحات" };
    }

    const title = String(formData.get('title') || '').trim();
    let slug = String(formData.get('slug') || '').trim();
    const content = String(formData.get('content') || '').trim();
    const metaTitle = String(formData.get('metaTitle') || '').trim() || null;
    const metaDescription = String(formData.get('metaDescription') || '').trim() || null;
    const isPublished = formData.get('isPublished') === 'true';

    if (!title) {
      return { success: false, error: "عنوان الصفحة مطلوب" };
    }

    if (!slug) {
      slug = slugify(title);
    } else {
      slug = slugify(slug);
    }

    if (!slug) {
      return { success: false, error: "معرّف الصفحة (slug) مطلوب" };
    }

    if (!content) {
      return { success: false, error: "محتوى الصفحة مطلوب" };
    }

    const page = await prisma.page.create({
      data: {
        title,
        slug,
        content,
        metaTitle,
        metaDescription,
        isPublished,
      },
    });

    revalidatePath('/dashboard/pages');
    revalidatePath(`/${page.slug}`);
    return { success: true, data: JSON.parse(JSON.stringify(page)) };
  } catch (error: any) {
    console.error("Create page error:", error);
    if (error.code === 'P2002') {
      return { success: false, error: "مُعرّف الصفحة (slug) مستخدم بالفعل" };
    }
    return { success: false, error: "فشل في إنشاء الصفحة" };
  }
}

/**
 * تحديث صفحة موجودة.
 */
export async function updatePage(id: string, formData: FormData) {
  try {
    const { allowed } = await checkPagePermission("editPages");
    if (!allowed) {
      return { success: false, error: "غير مصرح لك بتعديل الصفحات" };
    }

    const title = String(formData.get('title') || '').trim();
    let slug = String(formData.get('slug') || '').trim();
    const content = String(formData.get('content') || '').trim();
    const metaTitle = String(formData.get('metaTitle') || '').trim() || null;
    const metaDescription = String(formData.get('metaDescription') || '').trim() || null;
    const isPublished = formData.get('isPublished') === 'true';

    if (!title) {
      return { success: false, error: "عنوان الصفحة مطلوب" };
    }

    if (!slug) {
      slug = slugify(title);
    } else {
      slug = slugify(slug);
    }

    if (!slug) {
      return { success: false, error: "معرّف الصفحة (slug) مطلوب" };
    }

    if (!content) {
      return { success: false, error: "محتوى الصفحة مطلوب" };
    }

    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "الصفحة غير موجودة" };
    }

    const page = await prisma.page.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        metaTitle,
        metaDescription,
        isPublished,
      },
    });

    revalidatePath('/dashboard/pages');
    if (existing.slug !== page.slug) {
      revalidatePath(`/${existing.slug}`);
    }
    revalidatePath(`/${page.slug}`);
    return { success: true, data: JSON.parse(JSON.stringify(page)) };
  } catch (error: any) {
    console.error("Update page error:", error);
    if (error.code === 'P2002') {
      return { success: false, error: "مُعرّف الصفحة (slug) مستخدم بالفعل" };
    }
    return { success: false, error: "فشل في تحديث الصفحة" };
  }
}

/**
 * حذف صفحة.
 */
export async function deletePage(id: string) {
  try {
    const { allowed } = await checkPagePermission("deletePages");
    if (!allowed) {
      return { success: false, error: "غير مصرح لك بحذف الصفحات" };
    }

    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "الصفحة غير موجودة" };
    }

    await prisma.page.delete({ where: { id } });

    revalidatePath('/dashboard/pages');
    revalidatePath(`/${existing.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Delete page error:", error);
    return { success: false, error: "فشل في حذف الصفحة" };
  }
}
