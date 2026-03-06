'use server';

import { decrypt, encrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs"; //

export async function getalluser() {
  const user = await prisma.user.findMany({
    include:{
      permission:true,
      targets: {
        include: {
          products: {
            include: { product: true }
          }
        }
      }
    }
  });
  return user;
}   


export async function getMe() {
  try {
    const session = cookies().get("skynova")?.value;
    if (!session) return null;

    const decoded = await decrypt(session);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        accountType: true,
        phone: true,
        jobTitle: true,
        avatar: true,
      },
    });

    return user;
  } catch (err) {
    return null;
  }
}

export async function logout() {
  cookies().set("skynova", "", { expires: new Date(0), httpOnly: true });
  return { success: true };
}

export async function login(data: { name: string; password: string; }) {
  // 1. البحث عن المستخدم بالاسم فقط
  const user = await prisma.user.findFirst({
    where: { username: data.name },
  });

  // 2. التحقق من وجود المستخدم ومطابقة كلمة المرور المشفرة
  if (!user || !(await bcrypt.compare(data.password, user.password))) { //
    return { error: "خطأ في اسم المستخدم أو كلمة المرور" };
  }

  // 3. إكمال إجراءات الجلسة (JWT & Cookies)
  const expires = new Date(Date.now() + 30 * 60 * 60 * 1000);
  const session = await encrypt({ userId: user.id, username: user.username, email: user.email, expires });
  cookies().set("skynova", session, { expires, httpOnly: true });

  return { success: true };
}

export async function createuser(data: any) {
  try {
    // 1. تشفير كلمة المرور (Salt rounds = 10)
    const hashedPassword = await bcrypt.hash(data.password, 10); //

    // 2. إنشاء المستخدم في قاعدة البيانات
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword, // حفظ الكلمة المشفرة
        phone: data.phone || null,
        jobTitle: data.jobTitle,
        accountType: data.accountType,
        salesCommissionPercent: Number(data.salesCommissionPercent) || 0,
        wage: Number.isFinite(Number(data.wage)) ? Math.trunc(Number(data.wage)) : 0,
        // الربط مع جدول الصلاحيات باستخدام المعرف (ID)
        permission: {
          connect: { id: data.permissions } 
        }
      },
    });

    return { success: true, data: user };
  } catch (error: any) {
    console.error("Prisma Error:", error);
    
    // معالجة خطأ تكرار البريد الإلكتروني
    if (error.code === 'P2002') {
      return { success: false, error: "هذا البريد الإلكتروني مستخدم بالفعل" };
    }
    
    return { success: false, error: "فشل في إنشاء المستخدم، يرجى التحقق من المدخلات" };
  }
}

export async function updateuser(id: string, data: any) {
  try {
    const updateData: any = {
      username: data.username,
      email: data.email,
      phone: data.phone || null,
      jobTitle: data.jobTitle,
      ...(typeof data.avatar === "string" ? { avatar: data.avatar } : {}),
      accountType: data.accountType,
      salesCommissionPercent: Number(data.salesCommissionPercent) || 0,
      wage: Number.isFinite(Number(data.wage)) ? Math.trunc(Number(data.wage)) : 0,
      permission: {
        connect: { id: data.permissions }
      }
    };
    // تحديث كلمة المرور فقط إذا تم توفير واحدة جديدة
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10); //
    } 
    const user = await prisma.user.update({
      where: { id: id },
      data: updateData,
    });
    return { success: true, data: user };
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return { success: false, error: "فشل في تحديث بيانات المستخدم" };
  }
}

export async function updateUserCommission(id: string, salesCommissionPercent: number) {
  try {
    const percent = Number(salesCommissionPercent) || 0;
    const user = await prisma.user.update({
      where: { id },
      data: { salesCommissionPercent: percent }
    });
    return { success: true, data: user };
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return { success: false, error: "فشل في تحديث نسبة الأرباح" };
  }
}

export async function updateUserWage(id: string, wage: number) {
  try {
    const value = Number.isFinite(Number(wage)) ? Math.trunc(Number(wage)) : 0;
    const user = await prisma.user.update({
      where: { id },
      data: { wage: value }
    });
    return { success: true, data: user };
  } catch (error: any) {
    console.error("Prisma Error:", error);
    return { success: false, error: "فشل في تحديث البدل الثابت" };
  }
}

type AssignManagerPayload = {
  managerId: string;
  employeeIds: string[];
};

/**
 * تجلب المستخدم الحالي من الجلسة مع معلومات أساسية للتحقق من الصلاحيات.
 */
async function getCurrentSessionUserBasic() {
  const session = cookies().get("skynova")?.value;
  if (!session) return null;

  const decoded = await decrypt(session);
  if (!decoded?.userId) return null;

  return prisma.user.findUnique({
    where: { id: String(decoded.userId) },
    select: { id: true, accountType: true },
  });
}

/**
 * يتحقق هل المستخدم الحالي مخوّل لإدارة تاركت مستخدم آخر.
 * - Admin: مسموح دائمًا.
 * - غير Admin: مسموح فقط للموظفين المرتبطين به مباشرة عبر parentId.
 */
async function canManageTargetForUser(currentUser: { id: string; accountType: string }, targetUserId: string) {
  if (currentUser.accountType === "ADMIN") return true;

  const targetUser = await prisma.user.findUnique({
    where: { id: String(targetUserId) },
    select: { id: true, parentId: true, accountType: true },
  });

  if (!targetUser) return false;
  if (targetUser.accountType === "ADMIN") return false;

  return String(targetUser.parentId || "") === String(currentUser.id);
}

/**
 * تتحقق من الجلسة الحالية وتعيد المستخدم إذا كان Admin.
 */
async function getCurrentAdminUser() {
  const currentUser = await getCurrentSessionUserBasic();

  if (!currentUser || currentUser.accountType !== "ADMIN") {
    return null;
  }

  return currentUser;
}

/**
 * تعيين موظف مسؤول (Manager) على عدة موظفين دفعة واحدة عبر parentId.
 * هذه العملية متاحة فقط لحسابات Admin.
 */
export async function assignManagerToEmployees(payload: AssignManagerPayload) {
  try {
    const adminUser = await getCurrentAdminUser();
    if (!adminUser) {
      return { success: false, error: "غير مصرح" };
    }

    const managerId = String(payload?.managerId || "").trim();
    const employeeIds = Array.from(
      new Set((payload?.employeeIds || []).map((id) => String(id || "").trim()).filter(Boolean))
    );

    if (!managerId) {
      return { success: false, error: "يرجى اختيار الموظف المسؤول" };
    }

    if (employeeIds.length === 0) {
      return { success: false, error: "يرجى اختيار موظف واحد على الأقل" };
    }

    if (employeeIds.includes(managerId)) {
      return { success: false, error: "لا يمكن تعيين الموظف مسؤولًا عن نفسه" };
    }

    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, accountType: true },
    });

    if (!manager || manager.accountType === "ADMIN") {
      return { success: false, error: "المسؤول المحدد غير صالح" };
    }

    const updated = await prisma.user.updateMany({
      where: {
        id: { in: employeeIds },
        accountType: { not: "ADMIN" },
      },
      data: {
        parentId: managerId,
      },
    });

    return {
      success: true,
      data: {
        managerId,
        updatedCount: updated.count,
      },
    };
  } catch (error) {
    console.error("Assign Manager Error:", error);
    return { success: false, error: "فشل في تعيين الموظفين" };
  }
}

/**
 * فك ارتباط مجموعة موظفين من المسؤول الحالي (parentId = null).
 * هذه العملية متاحة فقط لحسابات Admin.
 */
export async function unassignManagerFromEmployees(employeeIdsInput: string[]) {
  try {
    const adminUser = await getCurrentAdminUser();
    if (!adminUser) {
      return { success: false, error: "غير مصرح" };
    }

    const employeeIds = Array.from(
      new Set((employeeIdsInput || []).map((id) => String(id || "").trim()).filter(Boolean))
    );

    if (employeeIds.length === 0) {
      return { success: false, error: "يرجى اختيار موظف واحد على الأقل" };
    }

    const updated = await prisma.user.updateMany({
      where: {
        id: { in: employeeIds },
        accountType: { not: "ADMIN" },
      },
      data: {
        parentId: null,
      },
    });

    return {
      success: true,
      data: {
        updatedCount: updated.count,
      },
    };
  } catch (error) {
    console.error("Unassign Manager Error:", error);
    return { success: false, error: "فشل في فك الارتباط" };
  }
}

export async function deleteuser(id: string) {
  try {
    await prisma.user.delete({ where: { id: id } });
    return { success: true };
  } catch (error) {
    return { success: false, error: "فشل في حذف المستخدم" };
  } 
}

type TargetProductInput = {
  productId: number;
  requiredQty: number;
  rewardValue: number;
};

type UserTargetInput = {
  userId: string;
  salesTargetValue: number[];
  salesRewardValue: number[];
  products: TargetProductInput[];
  startDate?: string;
  endDate?: string;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[{}\"]/g, "").trim();
    if (cleaned.length === 0) {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNumberArray = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toNumber(item))
      .filter((item): item is number => item !== null);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      if (inner.length === 0) {
        return [];
      }
      return inner
        .split(",")
        .map((item) => toNumber(item))
        .filter((item): item is number => item !== null);
    }
  }
  const single = toNumber(value);
  return single === null ? [] : [single];
};

export async function createUserTarget(payload: UserTargetInput) {
  try {
    const currentUser = await getCurrentSessionUserBasic();
    if (!currentUser) {
      return { success: false, error: "غير مصرح" };
    }

    const canManage = await canManageTargetForUser(currentUser, payload.userId);
    if (!canManage) {
      return { success: false, error: "يمكنك إضافة التاركت للموظفين المرتبطين بك فقط" };
    }

    const startDate = payload.startDate ? new Date(payload.startDate) : undefined;
    const endDate = payload.endDate ? new Date(payload.endDate) : null;
    const target = await prisma.userTarget.create({
      data: {
        userId: payload.userId,
        salesTargetValue: toNumberArray(payload.salesTargetValue),
        salesRewardValue: toNumberArray(payload.salesRewardValue),
        ...(startDate && !Number.isNaN(startDate.getTime()) ? { createdAt: startDate } : {}),
        ...(endDate && !Number.isNaN(endDate.getTime()) ? { endedAt: endDate } : {}),
        isActive: true,
        products: {
          create: payload.products.map((item) => {
            const productId = toNumber(item.productId);
            if (productId === null) {
              throw new Error("Invalid productId in target products");
            }
            return {
              product: { connect: { id: productId } },
              requiredQty: toNumberArray(item.requiredQty),
              rewardValue: toNumberArray(item.rewardValue),
            };
          })
        }
      }
    });
    return { success: true, data: target };
  } catch (error) {
    console.error("Create User Target Error:", error);
    return { success: false, error: "فشل في تعيين التاركت" };
  }
}

export async function updateUserTarget(targetId: string, payload: Omit<UserTargetInput, "userId">) {
  try {
    const currentUser = await getCurrentSessionUserBasic();
    if (!currentUser) {
      return { success: false, error: "غير مصرح" };
    }

    const existingTarget = await prisma.userTarget.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true },
    });

    if (!existingTarget) {
      return { success: false, error: "التاركت غير موجود" };
    }

    const canManage = await canManageTargetForUser(currentUser, existingTarget.userId);
    if (!canManage) {
      return { success: false, error: "يمكنك تعديل التاركتات للموظفين المرتبطين بك فقط" };
    }

    const startDate = payload.startDate ? new Date(payload.startDate) : undefined;
    const endDate = payload.endDate === "" ? null : payload.endDate ? new Date(payload.endDate) : undefined;
    const target = await prisma.userTarget.update({
      where: { id: targetId },
      data: {
        salesTargetValue: toNumberArray(payload.salesTargetValue),
        salesRewardValue: toNumberArray(payload.salesRewardValue),
        ...(startDate && !Number.isNaN(startDate.getTime()) ? { createdAt: startDate } : {}),
        ...(endDate !== undefined
          ? (endDate && !Number.isNaN(endDate.getTime()) ? { endedAt: endDate } : { endedAt: null })
          : {}),
        products: {
          deleteMany: {},
          create: payload.products.map((item) => {
            const productId = toNumber(item.productId);
            if (productId === null) {
              throw new Error("Invalid productId in target products");
            }
            return {
              product: { connect: { id: productId } },
              requiredQty: toNumberArray(item.requiredQty),
              rewardValue: toNumberArray(item.rewardValue),
            };
          })
        }
      }
    });
    return { success: true, data: target };
  } catch (error) {
    console.error("Update User Target Error:", error);
    return { success: false, error: "فشل في تحديث التاركت" };
  }
}

export async function deleteSalesTargetRow(targetId: string, rowIndex: number) {
  try {
    const currentUser = await getCurrentSessionUserBasic();
    if (!currentUser) {
      return { success: false, error: "غير مصرح" };
    }

    const target = await prisma.userTarget.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true, salesTargetValue: true, salesRewardValue: true }
    });

    if (!target) {
      return { success: false, error: "التاركت غير موجود" };
    }

    const canManage = await canManageTargetForUser(currentUser, target.userId);
    if (!canManage) {
      return { success: false, error: "يمكنك حذف التاركتات للموظفين المرتبطين بك فقط" };
    }

    const targetValues = Array.isArray(target.salesTargetValue) ? [...target.salesTargetValue] : [];
    const rewardValues = Array.isArray(target.salesRewardValue) ? [...target.salesRewardValue] : [];

    if (rowIndex < 0 || rowIndex >= Math.max(targetValues.length, rewardValues.length)) {
      return { success: false, error: "الصف المطلوب غير صالح" };
    }

    if (rowIndex < targetValues.length) targetValues.splice(rowIndex, 1);
    if (rowIndex < rewardValues.length) rewardValues.splice(rowIndex, 1);

    const updated = await prisma.userTarget.update({
      where: { id: targetId },
      data: {
        salesTargetValue: targetValues,
        salesRewardValue: rewardValues,
      }
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error("Delete Sales Target Row Error:", error);
    return { success: false, error: "فشل حذف صف تاركت المبيعات" };
  }
}

export async function deleteProductTargetRow(targetId: string, productId: number) {
  try {
    const currentUser = await getCurrentSessionUserBasic();
    if (!currentUser) {
      return { success: false, error: "غير مصرح" };
    }

    const target = await prisma.userTarget.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true }
    });

    if (!target) {
      return { success: false, error: "التاركت غير موجود" };
    }

    const canManage = await canManageTargetForUser(currentUser, target.userId);
    if (!canManage) {
      return { success: false, error: "يمكنك حذف التاركتات للموظفين المرتبطين بك فقط" };
    }

    await prisma.targetProduct.deleteMany({
      where: {
        targetId,
        productId,
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Delete Product Target Row Error:", error);
    return { success: false, error: "فشل حذف صف تاركت المنتج" };
  }
}