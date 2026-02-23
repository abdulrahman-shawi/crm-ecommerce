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
      select: { id: true, username: true, email: true, accountType: true, phone: true, jobTitle: true, avatar: true },
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
    const target = await prisma.userTarget.findUnique({
      where: { id: targetId },
      select: { salesTargetValue: true, salesRewardValue: true }
    });

    if (!target) {
      return { success: false, error: "التاركت غير موجود" };
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