'use server';

import { decrypt, encrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs"; //

export async function getalluser() {
  const user = await prisma.user.findMany({
    include:{
      permission:true,
      activityTarget: true,
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
  activityTarget?: ActivityTargetInput;
};

type ActivityTargetCycle = "DAILY" | "MONTHLY";

type ActivityTargetInput = {
  cycle: ActivityTargetCycle;
  requiredCustomers: number;
  customerReward: number;
  customerMissPenaltyAmount?: number;
  requiredCommunications: number;
  communicationReward: number;
  communicationMissPenaltyAmount?: number;
  startDate?: string;
  isActive?: boolean;
};

type ActivityProgressFilter = {
  period?: "day" | "week" | "month" | "custom";
  startDate?: string;
  endDate?: string;
};

type ActivityTargetProgressRow = {
  userId: string;
  userName: string;
  cycle: ActivityTargetCycle;
  requiredCustomers: number;
  requiredCommunications: number;
  customerReward: number;
  customerMissPenaltyAmount: number;
  communicationReward: number;
  communicationMissPenaltyAmount: number;
  periodStart: Date;
  periodEnd: Date;
  customersTodayOrPeriod: number;
  communicationsTodayOrPeriod: number;
  customersTargetTodayOrPeriod: number;
  communicationsTargetTodayOrPeriod: number;
  customersRemaining: number;
  communicationsRemaining: number;
  customersReached: boolean;
  communicationsReached: boolean;
  grossRewardEarned: number;
  penaltyAmount: number;
  totalRewardEarned: number;
  carryOverCustomers: number;
  carryOverCommunications: number;
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

const startOfDay = (input: Date) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (input: Date) => {
  const date = new Date(input);
  date.setHours(23, 59, 59, 999);
  return date;
};

const startOfMonth = (input: Date) => new Date(input.getFullYear(), input.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth = (input: Date) => new Date(input.getFullYear(), input.getMonth() + 1, 0, 23, 59, 59, 999);

const addDays = (input: Date, days: number) => {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
};

const countInclusiveDays = (from: Date, to: Date) => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
};

const diffDays = (start: Date, endExclusive: Date) => {
  const ms = endExclusive.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
};

const buildActivityDateRange = (filter?: ActivityProgressFilter) => {
  if (!filter) return null;

  const now = new Date();
  const period = String(filter.period || "month").toLowerCase();

  if (period === "day") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }

  if (period === "week") {
    const start = startOfDay(addDays(now, -6));
    return { start, end: endOfDay(now) };
  }

  if (period === "month") {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }

  if (period === "custom") {
    const startCandidate = filter.startDate ? new Date(filter.startDate) : null;
    const endCandidate = filter.endDate ? new Date(filter.endDate) : null;
    if (!startCandidate || !endCandidate) return null;
    if (Number.isNaN(startCandidate.getTime()) || Number.isNaN(endCandidate.getTime())) return null;

    const start = startOfDay(startCandidate <= endCandidate ? startCandidate : endCandidate);
    const end = endOfDay(startCandidate <= endCandidate ? endCandidate : startCandidate);
    return { start, end };
  }

  return { start: startOfMonth(now), end: endOfMonth(now) };
};

const toNonNegativeInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
};

const toNonNegativeFloat = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const normalizeActivityCycle = (value: unknown): ActivityTargetCycle => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "MONTHLY" ? "MONTHLY" : "DAILY";
};

const countCustomersForUserInRange = async (userId: string, from: Date, to: Date) => {
  return prisma.customer.count({
    where: {
      createdAt: { gte: from, lte: to },
      users: { some: { id: userId } },
    },
  });
};

const countCommunicationsForUserInRange = async (userId: string, from: Date, to: Date) => {
  return prisma.message.count({
    where: {
      userId,
      createdAt: { gte: from, lte: to },
    },
  });
};

const upsertUserActivityTarget = async (userId: string, input: ActivityTargetInput) => {
  const cycle = normalizeActivityCycle(input.cycle);
  const startsAtCandidate = input.startDate ? new Date(input.startDate) : new Date();
  const startsAt = Number.isNaN(startsAtCandidate.getTime()) ? new Date() : startsAtCandidate;

  return prisma.userActivityTarget.upsert({
    where: { userId },
    create: {
      userId,
      cycle,
      requiredCustomers: toNonNegativeInt(input.requiredCustomers),
      customerReward: toNonNegativeFloat(input.customerReward),
      customerMissPenaltyAmount: toNonNegativeFloat(input.customerMissPenaltyAmount),
      requiredCommunications: toNonNegativeInt(input.requiredCommunications),
      communicationReward: toNonNegativeFloat(input.communicationReward),
      communicationMissPenaltyAmount: toNonNegativeFloat(input.communicationMissPenaltyAmount),
      startsAt,
      isActive: input.isActive !== false,
    },
    update: {
      cycle,
      requiredCustomers: toNonNegativeInt(input.requiredCustomers),
      customerReward: toNonNegativeFloat(input.customerReward),
      customerMissPenaltyAmount: toNonNegativeFloat(input.customerMissPenaltyAmount),
      requiredCommunications: toNonNegativeInt(input.requiredCommunications),
      communicationReward: toNonNegativeFloat(input.communicationReward),
      communicationMissPenaltyAmount: toNonNegativeFloat(input.communicationMissPenaltyAmount),
      startsAt,
      isActive: input.isActive !== false,
    },
  });
};

const buildActivityProgressForTarget = async (
  activityTarget: any,
  userName: string,
  filter?: ActivityProgressFilter
): Promise<ActivityTargetProgressRow> => {
  const now = new Date();
  const cycle = normalizeActivityCycle(activityTarget?.cycle);
  const startsAt = startOfDay(new Date(activityTarget?.startsAt || now));

  const requestedRange = buildActivityDateRange(filter);

  if (requestedRange) {
    const requestedStart = requestedRange.start;
    const requestedEnd = requestedRange.end;
    const periodStart = requestedStart > startsAt ? requestedStart : startsAt;
    const periodEnd = requestedEnd;

    if (periodEnd < startsAt) {
      return {
        userId: activityTarget.userId,
        userName,
        cycle,
        requiredCustomers: toNonNegativeInt(activityTarget.requiredCustomers),
        requiredCommunications: toNonNegativeInt(activityTarget.requiredCommunications),
        customerReward: toNonNegativeFloat(activityTarget.customerReward),
        customerMissPenaltyAmount: toNonNegativeFloat(activityTarget.customerMissPenaltyAmount),
        communicationReward: toNonNegativeFloat(activityTarget.communicationReward),
        communicationMissPenaltyAmount: toNonNegativeFloat(activityTarget.communicationMissPenaltyAmount),
        periodStart: requestedStart,
        periodEnd,
        customersTodayOrPeriod: 0,
        communicationsTodayOrPeriod: 0,
        customersTargetTodayOrPeriod: 0,
        communicationsTargetTodayOrPeriod: 0,
        customersRemaining: 0,
        communicationsRemaining: 0,
        customersReached: false,
        communicationsReached: false,
        grossRewardEarned: 0,
        penaltyAmount: 0,
        totalRewardEarned: 0,
        carryOverCustomers: 0,
        carryOverCommunications: 0,
      };
    }

    const [customersAchieved, communicationsAchieved] = await Promise.all([
      countCustomersForUserInRange(activityTarget.userId, periodStart, periodEnd),
      countCommunicationsForUserInRange(activityTarget.userId, periodStart, periodEnd),
    ]);

    const requiredCustomers = toNonNegativeInt(activityTarget.requiredCustomers);
    const requiredCommunications = toNonNegativeInt(activityTarget.requiredCommunications);
    const activeDays = countInclusiveDays(periodStart, periodEnd);

    const customersTarget = cycle === "MONTHLY"
      ? requiredCustomers
      : requiredCustomers * activeDays;
    const communicationsTarget = cycle === "MONTHLY"
      ? requiredCommunications
      : requiredCommunications * activeDays;

    const customersRemaining = Math.max(0, customersTarget - customersAchieved);
    const communicationsRemaining = Math.max(0, communicationsTarget - communicationsAchieved);
    const rewardMultiplier = cycle === "DAILY" ? 2 : 1;
    const customersRewardTarget = customersTarget * rewardMultiplier;
    const communicationsRewardTarget = communicationsTarget * rewardMultiplier;
    const customersReached = customersRewardTarget > 0 && customersAchieved >= customersRewardTarget;
    const communicationsReached = communicationsRewardTarget > 0 && communicationsAchieved >= communicationsRewardTarget;
    const grossRewardEarned =
      (customersReached ? toNonNegativeFloat(activityTarget.customerReward) : 0) +
      (communicationsReached ? toNonNegativeFloat(activityTarget.communicationReward) : 0);
    const customerPenaltyAmount = !customersReached ? toNonNegativeFloat(activityTarget.customerMissPenaltyAmount) : 0;
    const communicationPenaltyAmount = !communicationsReached ? toNonNegativeFloat(activityTarget.communicationMissPenaltyAmount) : 0;
    const penaltyAmount = customerPenaltyAmount + communicationPenaltyAmount;
    const totalRewardEarned = Math.max(0, grossRewardEarned - penaltyAmount);

    return {
      userId: activityTarget.userId,
      userName,
      cycle,
      requiredCustomers,
      requiredCommunications,
      customerReward: toNonNegativeFloat(activityTarget.customerReward),
      customerMissPenaltyAmount: toNonNegativeFloat(activityTarget.customerMissPenaltyAmount),
      communicationReward: toNonNegativeFloat(activityTarget.communicationReward),
      communicationMissPenaltyAmount: toNonNegativeFloat(activityTarget.communicationMissPenaltyAmount),
      periodStart,
      periodEnd,
      customersTodayOrPeriod: customersAchieved,
      communicationsTodayOrPeriod: communicationsAchieved,
      customersTargetTodayOrPeriod: customersTarget,
      communicationsTargetTodayOrPeriod: communicationsTarget,
      customersRemaining,
      communicationsRemaining,
      customersReached,
      communicationsReached,
      grossRewardEarned,
      penaltyAmount,
      totalRewardEarned,
      carryOverCustomers: 0,
      carryOverCommunications: 0,
    };
  }

  if (cycle === "MONTHLY") {
    const periodStart = startsAt > startOfMonth(now) ? startsAt : startOfMonth(now);
    const periodEnd = endOfMonth(now);

    const [customersAchieved, communicationsAchieved] = await Promise.all([
      countCustomersForUserInRange(activityTarget.userId, periodStart, now),
      countCommunicationsForUserInRange(activityTarget.userId, periodStart, now),
    ]);

    const customersTarget = toNonNegativeInt(activityTarget.requiredCustomers);
    const communicationsTarget = toNonNegativeInt(activityTarget.requiredCommunications);
    const customersRemaining = Math.max(0, customersTarget - customersAchieved);
    const communicationsRemaining = Math.max(0, communicationsTarget - communicationsAchieved);
    const rewardMultiplier = 1;
    const customersRewardTarget = customersTarget * rewardMultiplier;
    const communicationsRewardTarget = communicationsTarget * rewardMultiplier;
    const customersReached = customersRewardTarget > 0 && customersAchieved >= customersRewardTarget;
    const communicationsReached = communicationsRewardTarget > 0 && communicationsAchieved >= communicationsRewardTarget;
    const grossRewardEarned =
      (customersReached ? toNonNegativeFloat(activityTarget.customerReward) : 0) +
      (communicationsReached ? toNonNegativeFloat(activityTarget.communicationReward) : 0);
    const customerPenaltyAmount = !customersReached ? toNonNegativeFloat(activityTarget.customerMissPenaltyAmount) : 0;
    const communicationPenaltyAmount = !communicationsReached ? toNonNegativeFloat(activityTarget.communicationMissPenaltyAmount) : 0;
    const penaltyAmount = customerPenaltyAmount + communicationPenaltyAmount;
    const totalRewardEarned = Math.max(0, grossRewardEarned - penaltyAmount);

    return {
      userId: activityTarget.userId,
      userName,
      cycle,
      requiredCustomers: customersTarget,
      requiredCommunications: communicationsTarget,
      customerReward: toNonNegativeFloat(activityTarget.customerReward),
      customerMissPenaltyAmount: toNonNegativeFloat(activityTarget.customerMissPenaltyAmount),
      communicationReward: toNonNegativeFloat(activityTarget.communicationReward),
      communicationMissPenaltyAmount: toNonNegativeFloat(activityTarget.communicationMissPenaltyAmount),
      periodStart,
      periodEnd,
      customersTodayOrPeriod: customersAchieved,
      communicationsTodayOrPeriod: communicationsAchieved,
      customersTargetTodayOrPeriod: customersTarget,
      communicationsTargetTodayOrPeriod: communicationsTarget,
      customersRemaining,
      communicationsRemaining,
      customersReached,
      communicationsReached,
      grossRewardEarned,
      penaltyAmount,
      totalRewardEarned,
      carryOverCustomers: 0,
      carryOverCommunications: 0,
    };
  }

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const effectiveStart = startsAt > todayStart ? startsAt : startsAt;

  const yesterdayEnd = new Date(todayStart.getTime() - 1);
  const dailyCustomersRequired = toNonNegativeInt(activityTarget.requiredCustomers);
  const dailyCommunicationsRequired = toNonNegativeInt(activityTarget.requiredCommunications);

  const daysBeforeToday = startsAt <= yesterdayEnd ? diffDays(startsAt, todayStart) : 0;

  const [customersBeforeToday, communicationsBeforeToday, customersToday, communicationsToday] = await Promise.all([
    startsAt <= yesterdayEnd
      ? countCustomersForUserInRange(activityTarget.userId, startsAt, yesterdayEnd)
      : Promise.resolve(0),
    startsAt <= yesterdayEnd
      ? countCommunicationsForUserInRange(activityTarget.userId, startsAt, yesterdayEnd)
      : Promise.resolve(0),
    countCustomersForUserInRange(activityTarget.userId, todayStart, todayEnd),
    countCommunicationsForUserInRange(activityTarget.userId, todayStart, todayEnd),
  ]);

  const carryOverCustomers = Math.max(0, (dailyCustomersRequired * daysBeforeToday) - customersBeforeToday);
  const carryOverCommunications = Math.max(0, (dailyCommunicationsRequired * daysBeforeToday) - communicationsBeforeToday);

  const customersTargetToday = dailyCustomersRequired + carryOverCustomers;
  const communicationsTargetToday = dailyCommunicationsRequired + carryOverCommunications;

  const customersRemaining = Math.max(0, customersTargetToday - customersToday);
  const communicationsRemaining = Math.max(0, communicationsTargetToday - communicationsToday);
  const customersRewardTarget = customersTargetToday * 2;
  const communicationsRewardTarget = communicationsTargetToday * 2;
  const customersReached = customersRewardTarget > 0 && customersToday >= customersRewardTarget;
  const communicationsReached = communicationsRewardTarget > 0 && communicationsToday >= communicationsRewardTarget;

  const grossRewardEarned =
    (customersReached ? toNonNegativeFloat(activityTarget.customerReward) : 0) +
    (communicationsReached ? toNonNegativeFloat(activityTarget.communicationReward) : 0);
  const customerPenaltyAmount = !customersReached ? toNonNegativeFloat(activityTarget.customerMissPenaltyAmount) : 0;
  const communicationPenaltyAmount = !communicationsReached ? toNonNegativeFloat(activityTarget.communicationMissPenaltyAmount) : 0;
  const penaltyAmount = customerPenaltyAmount + communicationPenaltyAmount;
  const totalRewardEarned = Math.max(0, grossRewardEarned - penaltyAmount);

  return {
    userId: activityTarget.userId,
    userName,
    cycle,
    requiredCustomers: dailyCustomersRequired,
    requiredCommunications: dailyCommunicationsRequired,
    customerReward: toNonNegativeFloat(activityTarget.customerReward),
    customerMissPenaltyAmount: toNonNegativeFloat(activityTarget.customerMissPenaltyAmount),
    communicationReward: toNonNegativeFloat(activityTarget.communicationReward),
    communicationMissPenaltyAmount: toNonNegativeFloat(activityTarget.communicationMissPenaltyAmount),
    periodStart: effectiveStart,
    periodEnd: todayEnd,
    customersTodayOrPeriod: customersToday,
    communicationsTodayOrPeriod: communicationsToday,
    customersTargetTodayOrPeriod: customersTargetToday,
    communicationsTargetTodayOrPeriod: communicationsTargetToday,
    customersRemaining,
    communicationsRemaining,
    customersReached,
    communicationsReached,
    grossRewardEarned,
    penaltyAmount,
    totalRewardEarned,
    carryOverCustomers,
    carryOverCommunications,
  };
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

    const salesTargets = toNumberArray(payload.salesTargetValue);
    const salesRewards = toNumberArray(payload.salesRewardValue);
    const productRows = Array.isArray(payload.products) ? payload.products : [];
    const hasSalesOrProducts = salesTargets.length > 0 || productRows.length > 0;
    const hasActivityTarget = Boolean(payload.activityTarget);

    if (!hasSalesOrProducts && !hasActivityTarget) {
      return { success: false, error: "يرجى إدخال تاركت واحد على الأقل" };
    }

    const startDate = payload.startDate ? new Date(payload.startDate) : undefined;
    const endDate = payload.endDate ? new Date(payload.endDate) : null;

    const result = await prisma.$transaction(async (tx) => {
      let salesTarget: any = null;

      if (hasSalesOrProducts) {
        salesTarget = await tx.userTarget.create({
          data: {
            userId: payload.userId,
            salesTargetValue: salesTargets,
            salesRewardValue: salesRewards,
            ...(startDate && !Number.isNaN(startDate.getTime()) ? { createdAt: startDate } : {}),
            ...(endDate && !Number.isNaN(endDate.getTime()) ? { endedAt: endDate } : {}),
            isActive: true,
            products: {
              create: productRows.map((item) => {
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
      }

      let activityTarget: any = null;
      if (hasActivityTarget && payload.activityTarget) {
        const cycle = normalizeActivityCycle(payload.activityTarget.cycle);
        const startsAtCandidate = payload.activityTarget.startDate ? new Date(payload.activityTarget.startDate) : new Date();
        const startsAt = Number.isNaN(startsAtCandidate.getTime()) ? new Date() : startsAtCandidate;

        activityTarget = await tx.userActivityTarget.upsert({
          where: { userId: payload.userId },
          create: {
            userId: payload.userId,
            cycle,
            requiredCustomers: toNonNegativeInt(payload.activityTarget.requiredCustomers),
            customerReward: toNonNegativeFloat(payload.activityTarget.customerReward),
            customerMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.customerMissPenaltyAmount),
            requiredCommunications: toNonNegativeInt(payload.activityTarget.requiredCommunications),
            communicationReward: toNonNegativeFloat(payload.activityTarget.communicationReward),
            communicationMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.communicationMissPenaltyAmount),
            startsAt,
            isActive: payload.activityTarget.isActive !== false,
          },
          update: {
            cycle,
            requiredCustomers: toNonNegativeInt(payload.activityTarget.requiredCustomers),
            customerReward: toNonNegativeFloat(payload.activityTarget.customerReward),
            customerMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.customerMissPenaltyAmount),
            requiredCommunications: toNonNegativeInt(payload.activityTarget.requiredCommunications),
            communicationReward: toNonNegativeFloat(payload.activityTarget.communicationReward),
            communicationMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.communicationMissPenaltyAmount),
            startsAt,
            isActive: payload.activityTarget.isActive !== false,
          },
        });
      }

      return { salesTarget, activityTarget };
    });

    return { success: true, data: result };
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

    const target = await prisma.$transaction(async (tx) => {
      const updatedTarget = await tx.userTarget.update({
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

      let updatedActivityTarget: any = null;
      if (payload.activityTarget) {
        const cycle = normalizeActivityCycle(payload.activityTarget.cycle);
        const startsAtCandidate = payload.activityTarget.startDate ? new Date(payload.activityTarget.startDate) : new Date();
        const startsAt = Number.isNaN(startsAtCandidate.getTime()) ? new Date() : startsAtCandidate;

        updatedActivityTarget = await tx.userActivityTarget.upsert({
          where: { userId: existingTarget.userId },
          create: {
            userId: existingTarget.userId,
            cycle,
            requiredCustomers: toNonNegativeInt(payload.activityTarget.requiredCustomers),
            customerReward: toNonNegativeFloat(payload.activityTarget.customerReward),
            customerMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.customerMissPenaltyAmount),
            requiredCommunications: toNonNegativeInt(payload.activityTarget.requiredCommunications),
            communicationReward: toNonNegativeFloat(payload.activityTarget.communicationReward),
            communicationMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.communicationMissPenaltyAmount),
            startsAt,
            isActive: payload.activityTarget.isActive !== false,
          },
          update: {
            cycle,
            requiredCustomers: toNonNegativeInt(payload.activityTarget.requiredCustomers),
            customerReward: toNonNegativeFloat(payload.activityTarget.customerReward),
            customerMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.customerMissPenaltyAmount),
            requiredCommunications: toNonNegativeInt(payload.activityTarget.requiredCommunications),
            communicationReward: toNonNegativeFloat(payload.activityTarget.communicationReward),
            communicationMissPenaltyAmount: toNonNegativeFloat(payload.activityTarget.communicationMissPenaltyAmount),
            startsAt,
            isActive: payload.activityTarget.isActive !== false,
          },
        });
      }

      return { updatedTarget, updatedActivityTarget };
    });
    return { success: true, data: target };
  } catch (error) {
    console.error("Update User Target Error:", error);
    return { success: false, error: "فشل في تحديث التاركت" };
  }
}

export async function setUserActivityTarget(userId: string, payload: ActivityTargetInput) {
  try {
    const currentUser = await getCurrentSessionUserBasic();
    if (!currentUser) {
      return { success: false, error: "غير مصرح" };
    }

    const canManage = await canManageTargetForUser(currentUser, userId);
    if (!canManage) {
      return { success: false, error: "يمكنك إدارة التاركت للموظفين المرتبطين بك فقط" };
    }

    const target = await upsertUserActivityTarget(userId, payload);
    return { success: true, data: target };
  } catch (error) {
    console.error("Set User Activity Target Error:", error);
    return { success: false, error: "فشل حفظ تاركت النشاط" };
  }
}

export async function getUserActivityTargetProgress(userIdsInput?: string[], filter?: ActivityProgressFilter) {
  try {
    const currentUser = await getCurrentSessionUserBasic();
    if (!currentUser) {
      return { success: false, error: "غير مصرح", data: [] as ActivityTargetProgressRow[] };
    }

    const requestedIds = Array.from(new Set((userIdsInput || []).map((id) => String(id || "").trim()).filter(Boolean)));
    const isAdmin = currentUser.accountType === "ADMIN";

    let allowedUserIds: string[] = [];
    if (isAdmin) {
      allowedUserIds = requestedIds;
    } else {
      const linkedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: currentUser.id },
            { parentId: currentUser.id },
          ]
        },
        select: { id: true },
      });

      const linkedIds = new Set(linkedUsers.map((row) => row.id));
      allowedUserIds = requestedIds.length > 0
        ? requestedIds.filter((id) => linkedIds.has(id))
        : Array.from(linkedIds);
    }

    if (allowedUserIds.length === 0) {
      return { success: true, data: [] as ActivityTargetProgressRow[] };
    }

    const activityTargets = await prisma.userActivityTarget.findMany({
      where: {
        userId: { in: allowedUserIds },
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    const rows = await Promise.all(
      activityTargets.map((target) => buildActivityProgressForTarget(target, target.user?.username || "-", filter))
    );
    return { success: true, data: rows };
  } catch (error) {
    console.error("Get User Activity Target Progress Error:", error);
    return { success: false, error: "فشل جلب تقدم تاركت النشاط", data: [] as ActivityTargetProgressRow[] };
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