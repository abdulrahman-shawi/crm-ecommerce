"use server";

import { prisma } from "@/lib/prisma";

export async function getData() {
    try {
        const res = await prisma.expense.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });
        return { success: true, data: res };
    } catch (error) {
        return { success: false, error: error };
    }
}

export async function createExpense(data:any) {
    try {        const res = await prisma.expense.create({
            data: {
                amount: data.amount,
                description: data.description,
            },
        });
        return { success: true, data: res };
    }
    catch (error) {
        return { success: false, error: error };
    }   
}

export async function deleteExpense(id:number) {
    try {
        const res = await prisma.expense.delete({   
            where: {
                id : id,
            },
        });
        return { success: true, data: res };
    }
    catch (error) {
        return { success: false, error: error };
    }
}

export async function updateExpense(id:number, data:any) {
    try {
        const res = await prisma.expense.update({
            where: {
                id : id,
            },
            data: {
                amount: data.amount,
                description: data.description,
            },
        });
        return { success: true, data: res };
    }
    catch (error) {
        return { success: false, error: error };
    }
}

