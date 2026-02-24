import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    try {
        const session = cookies().get("skynova")?.value;
            if (!session) {
            return NextResponse.json({ 
                success: false, 
                error: "غير مصرح بالدخول - لا توجد جلسة" 
            }, { status: 401 });
        }
        
            const decoded = await decrypt(session);
        const users = await prisma.user.findUnique({
             where: { id: decoded.userId },
      include:{
                permission:true
      }
        });

        return NextResponse.json({ 
            success: true, 
            data: users 
        }, { status: 200 });
    } catch (error) {
        console.error("Fetch Users Error:", error);
        return NextResponse.json({ 
            success: false, 
            error: "فشل في جلب قائمة المستخدمين" 
        }, { status: 500 });
    }
}