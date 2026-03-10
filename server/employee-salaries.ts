"use server";

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

type SessionUser = {
  id: string;
  accountType: string;
  permission?: {
    viewEmployees?: boolean;
    editEmployees?: boolean;
  } | null;
};

async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const session = cookies().get("skynova")?.value;
  if (!session) return null;

  const decoded = await decrypt(session);
  if (!decoded?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(decoded.userId) },
    select: {
      id: true,
      accountType: true,
      permission: {
        select: {
          viewEmployees: true,
          editEmployees: true,
        },
      },
    },
  });

  if (!user) return null;
  return user as SessionUser;
}

const canViewSalaries = (user: SessionUser | null) => {
  if (!user) return false;
  if (user.accountType === "ADMIN") return true;
  return Boolean(user.permission?.viewEmployees);
};

const canEditSalaries = (user: SessionUser | null) => {
  if (!user) return false;
  if (user.accountType === "ADMIN") return true;
  return Boolean(user.permission?.editEmployees);
};

const normalizeMonthKey = (input: string) => {
  const value = String(input || "").trim();
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export async function getEmployeeSalaryAdjustments(monthKeyInput: string) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!canViewSalaries(currentUser)) {
      return { success: false, error: "غير مصرح", data: [] as Array<{ userId: string; editedSalary: number }> };
    }

    const monthKey = normalizeMonthKey(monthKeyInput);

    const rows = await prisma.$queryRawUnsafe<Array<{ userId: string; editedSalary: number }>>(
      `SELECT "userId", "editedSalary"
       FROM "EmployeeSalaryAdjustment"
       WHERE "monthKey" = $1`,
      monthKey
    );

    return { success: true, data: rows || [] };
  } catch (error: any) {
    return {
      success: false,
      error: "فشل جلب تعديلات الرواتب. تأكد من تطبيق الترحيل الخاص بجدول EmployeeSalaryAdjustment.",
      data: [] as Array<{ userId: string; editedSalary: number }>,
    };
  }
}

export async function upsertEmployeeSalaryAdjustment(userIdInput: string, monthKeyInput: string, editedSalaryInput: number) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!canEditSalaries(currentUser)) {
      return { success: false, error: "غير مصرح" };
    }

    const userId = String(userIdInput || "").trim();
    if (!userId) {
      return { success: false, error: "معرف الموظف غير صالح" };
    }

    const monthKey = normalizeMonthKey(monthKeyInput);
    const editedSalary = Number(editedSalaryInput);

    if (!Number.isFinite(editedSalary) || editedSalary < 0) {
      return { success: false, error: "قيمة الراتب المعدّل غير صالحة" };
    }

    const id = crypto.randomUUID();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "EmployeeSalaryAdjustment" ("id", "userId", "monthKey", "editedSalary", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT ("userId", "monthKey")
       DO UPDATE SET "editedSalary" = EXCLUDED."editedSalary", "updatedAt" = NOW()`,
      id,
      userId,
      monthKey,
      editedSalary
    );

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: "فشل حفظ الراتب المعدّل. تأكد من تطبيق الترحيل الخاص بجدول EmployeeSalaryAdjustment.",
    };
  }
}
