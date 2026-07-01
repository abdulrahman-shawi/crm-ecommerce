import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs"; //
import { cookies } from "next/headers";
import { encrypt } from "@/lib/auth";
export async function POST(req:NextRequest){
    try {
        const { email, password } = await req.json();
        const login = await prisma.user.findUnique({
            where: { email: email },
            select: {
                id: true,
                username: true,
                email: true,
                password: true,
                isAffiliate: true,
                affiliateApproved: true,
            },
        });
        if (!login) {
            return new Response(JSON.stringify({ success: false, error: "خطأ في اسم المستخدم أو كلمة المرور" }), { status: 401 });
        }
        const has = await bcrypt.compare(password, login.password)
        // تحقق من كلمة المرور هنا إذا كانت مشفرة
        if (!has) {
            return new Response(JSON.stringify({ success: false, error: "خطأ في اسم المستخدم أو كلمة المرور" }), { status: 401 });
        }
        if (login.isAffiliate && !login.affiliateApproved) {
            return new Response(JSON.stringify({ success: false, error: "حساب الأفلييت بانتظار موافقة الأدمن" }), { status: 403 });
        }
        const expires = new Date(Date.now() + 30 * 60 * 60 * 1000);
          const session = await encrypt({ userId: login.id, username: login.username, email: login.email, expires });
          cookies().set("skynova", session, { expires, httpOnly: true });
        return NextResponse.json({ success: true, user: login }, { status: 200 });
    } catch (error) {
        console.error("Prisma Error:", error);
        return new Response(JSON.stringify({ success: false, error: "فشل في تسجيل الدخول" }), { status: 500 });
    }

}