"use server";

import { prisma } from "@/lib/prisma";

export async function getData() {
    try {
        const res = await prisma.expense.findMany({
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

const EXPENSE_TYPES = ["DAILY", "STAFF_SALARY", "RENT"] as const;
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

export async function getExpenseEmployees() {
    try {
        const users = await prisma.user.findMany({
            where: {
                accountType: {
                    not: "ADMIN",
                },
            },
            select: {
                id: true,
                username: true,
                wage: true,
            },
            orderBy: {
                username: "asc",
            },
        });

        return { success: true, data: users };
    } catch (error) {
        return { success: false, error };
    }
}

export async function createExpense(data: any) {
    try {
        const type = normalizeExpenseType(data?.type);
        const description = sanitizeDescription(data?.description);
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

        if (type === "STAFF_SALARY") {
            const employeeId = String(data?.employeeId || "").trim();
            if (!employeeId) {
                return { success: false, error: "يرجى اختيار الموظف" };
            }

            const employee = await prisma.user.findUnique({
                where: { id: employeeId },
                select: { id: true, wage: true, username: true },
            });

            if (!employee) {
                return { success: false, error: "الموظف غير موجود" };
            }

            const salaryAmount = Number.isFinite(Number(data?.amount))
                ? Number(data.amount)
                : Number(employee.wage || 0);

            if (salaryAmount < 0) {
                return { success: false, error: "قيمة الراتب المصروف غير صالحة" };
            }

            const res = await prisma.expense.create({
                data: {
                    type,
                    amount: salaryAmount,
                    salaryBaseWage: Number(employee.wage || 0),
                    description: description || `راتب الموظف: ${employee.username}`,
                    employeeId: employee.id,
                    currency: null,
                    paidFromOffice: null,
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

        if (type === "STAFF_SALARY") {
            const employeeId = String(data?.employeeId || "").trim();
            if (!employeeId) {
                return { success: false, error: "يرجى اختيار الموظف" };
            }

            const employee = await prisma.user.findUnique({
                where: { id: employeeId },
                select: { id: true, wage: true, username: true },
            });

            if (!employee) {
                return { success: false, error: "الموظف غير موجود" };
            }

            const salaryAmount = Number.isFinite(Number(data?.amount))
                ? Number(data.amount)
                : Number(employee.wage || 0);

            if (salaryAmount < 0) {
                return { success: false, error: "قيمة الراتب المصروف غير صالحة" };
            }

            payload = {
                ...payload,
                amount: salaryAmount,
                salaryBaseWage: Number(employee.wage || 0),
                description: description || `راتب الموظف: ${employee.username}`,
                employeeId: employee.id,
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

