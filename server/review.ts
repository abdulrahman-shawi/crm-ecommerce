"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export async function getReviews() {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { id: true, username: true, email: true } },
      },
    });
    return { success: true, data: JSON.parse(JSON.stringify(reviews)) };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر جلب التعليقات" };
  }
}

export async function deleteReview(id: string, currentUser?: any) {
  try {
    if (currentUser && !isAdmin(currentUser)) {
      return { success: false, error: "ليس لديك صلاحية حذف التعليقات" };
    }

    await prisma.review.delete({ where: { id } });
    revalidatePath("/dashboard/comments");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "تعذر حذف التعليق" };
  }
}
