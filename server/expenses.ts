"use server";

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function getCurrentSessionUser() {
    try {
        const session = cookies().get("skynova")?.value;
        if (!session) return null;

        const decoded = await decrypt(session);
        if (!decoded?.userId) return null;

        return await prisma.user.findUnique({
            where: { id: String(decoded.userId) },
            include: { permission: true },
        });
    } catch {
        return null;
    }
}

function canViewExpenses(user: any) {
    if (!user) return false;
    if (user.accountType === "ADMIN") return true;
    return Boolean(user?.permission?.viewExpenses);
}

function getAllowedPaidOffices(user: any) {
    const offices: Array<"SYRIA" | "TURKEY"> = [];
    if (user?.permission?.accessSyria === true) offices.push("SYRIA");
    if (user?.permission?.accessTurkey === true) offices.push("TURKEY");
    return offices;
}

export async function getData() {
    try {
        const currentUser = await getCurrentSessionUser();
        if (!currentUser || !canViewExpenses(currentUser)) {
            return { success: false, error: "غير مصرح لك بعرض المصاريف" };
        }

        const isAdminUser = currentUser.accountType === "ADMIN";
        const allowedPaidOffices = getAllowedPaidOffices(currentUser);

        if (!isAdminUser && allowedPaidOffices.length === 0) {
            return { success: true, data: [] };
        }

        const where: any = !isAdminUser
            ? {
                OR: [
                    {
                        type: "DAILY",
                        paidFromOffice: {
                            in: allowedPaidOffices,
                        },
                    },
                    {
                        type: "RENT",
                    },
                ],
            }
            : undefined;

        const res = await prisma.expense.findMany({
            where,
            orderBy: {
                createdAt: "desc",
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        username: true,
                        wage: true,
                    },
                },
            },
        });
        return { success: true, data: res };
    } catch (error) {
        return { success: false, error: error };
    }
}

const EXPENSE_TYPES = ["DAILY", "RENT"] as const;
const EXPENSE_CURRENCIES = ["SYP", "TRY", "USD"] as const;
const PAID_OFFICES = ["TURKEY", "SYRIA"] as const;

type ExpenseType = (typeof EXPENSE_TYPES)[number];
type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number];
type PaidFromOffice = (typeof PAID_OFFICES)[number];

const normalizeExpenseType = (value: any): ExpenseType => {
    const normalized = String(value || "").trim().toUpperCase();
    return (EXPENSE_TYPES as readonly string[]).includes(normalized)
        ? (normalized as ExpenseType)
        : "DAILY";
};

const normalizeExpenseCurrency = (value: any): ExpenseCurrency | null => {
    const normalized = String(value || "").trim().toUpperCase();
    if (!(EXPENSE_CURRENCIES as readonly string[]).includes(normalized)) return null;
    return normalized as ExpenseCurrency;
};

const normalizePaidFromOffice = (value: any): PaidFromOffice | null => {
    const normalized = String(value || "").trim().toUpperCase();
    if (!(PAID_OFFICES as readonly string[]).includes(normalized)) return null;
    return normalized as PaidFromOffice;
};

const parseScheduledDate = (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

const sanitizeDescription = (value: any) => {
    const normalized = String(value || "").trim();
    return normalized || null;
};

const sanitizeNotes = (value: any) => {
    const normalized = String(value || "").trim();
    return normalized || null;
};

export async function getExpenseEmployees() {
    return { success: true, data: [] };
}

export async function createExpense(data: any) {
    try {
        const type = normalizeExpenseType(data?.type);
        const description = sanitizeDescription(data?.description);
        const notes = sanitizeNotes(data?.notes);
        const amountInput = Number(data?.amount || 0);

        if (Number.isNaN(amountInput) || amountInput < 0) {
            return { success: false, error: "المبلغ غير صالح" };
        }

        if (type === "DAILY") {
            const currency = normalizeExpenseCurrency(data?.currency);
            const paidFromOffice = normalizePaidFromOffice(data?.paidFromOffice);

            if (!description) {
                return { success: false, error: "يرجى إدخال وصف المصروف اليومي" };
            }

            if (!currency) {
                return { success: false, error: "يرجى اختيار عملة المصروف" };
            }

            if (!paidFromOffice) {
                return { success: false, error: "يرجى تحديد المكتب الذي تم الدفع منه" };
            }

            const res = await prisma.expense.create({
                data: {
                    type,
                    amount: amountInput,
                    description,
                    notes,
                    currency,
                    paidFromOffice,
                    employeeId: null,
                    scheduledDate: null,
                },
                include: {
                    employee: {
                        select: { id: true, username: true, wage: true },
                    },
                },
            });

            return { success: true, data: res };
        }

        if (!description) {
            return { success: false, error: "يرجى إدخال وصف الإيجار" };
        }

        const rentDate = parseScheduledDate(data?.scheduledDate) || new Date();

        const res = await prisma.expense.create({
            data: {
                type,
                amount: amountInput,
                description,
                notes,
                scheduledDate: rentDate,
                employeeId: null,
                currency: null,
                paidFromOffice: null,
            },
            include: {
                employee: {
                    select: { id: true, username: true, wage: true },
                },
            },
        });

        return { success: true, data: res };
    } catch (error) {
        return { success: false, error: error };
    }
}

export async function deleteExpense(id: number) {
    try {
        const res = await prisma.expense.delete({
            where: {
                id: id,
            },
        });
        return { success: true, data: res };
    }
    catch (error) {
        return { success: false, error: error };
    }
}

export async function updateExpense(id: number, data: any) {
    try {
        const type = normalizeExpenseType(data?.type);
        const description = sanitizeDescription(data?.description);
        const notes = sanitizeNotes(data?.notes);
        const amountInput = Number(data?.amount || 0);

        if (Number.isNaN(amountInput) || amountInput < 0) {
            return { success: false, error: "المبلغ غير صالح" };
        }

        let payload: any = {
            type,
            amount: amountInput,
            salaryBaseWage: null,
            description,
            currency: null,
            paidFromOffice: null,
            employeeId: null,
            scheduledDate: null,
            notes,
        };

        if (type === "DAILY") {
            const currency = normalizeExpenseCurrency(data?.currency);
            const paidFromOffice = normalizePaidFromOffice(data?.paidFromOffice);

            if (!description) {
                return { success: false, error: "يرجى إدخال وصف المصروف اليومي" };
            }

            if (!currency) {
                return { success: false, error: "يرجى اختيار عملة المصروف" };
            }

            if (!paidFromOffice) {
                return { success: false, error: "يرجى تحديد المكتب الذي تم الدفع منه" };
            }

            payload = {
                ...payload,
                description,
                currency,
                paidFromOffice,
                salaryBaseWage: null,
            };
        }

        if (type === "RENT") {
            if (!description) {
                return { success: false, error: "يرجى إدخال وصف الإيجار" };
            }

            payload = {
                ...payload,
                description,
                scheduledDate: parseScheduledDate(data?.scheduledDate) || new Date(),
                salaryBaseWage: null,
            };
        }

        const res = await prisma.expense.update({
            where: {
                id: id,
            },
            data: payload,
            include: {
                employee: {
                    select: { id: true, username: true, wage: true },
                },
            },
        });
        return { success: true, data: res };
    }
    catch (error) {
        return { success: false, error: error };
    }
}

