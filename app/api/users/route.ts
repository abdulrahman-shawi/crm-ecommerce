import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs"; //
import { NextRequest } from 'next/server';
export async function GET(req :NextRequest) {
    try {
    const users = await prisma.user.findMany({
      include: {
        permission: true, // جلب بيانات الصلاحيات المرتبطة بالمستخدم
        targets: {
          include: {
            products: {
              select: {
                id: true,
                targetId: true,
                productId: true,
                product: true,
              },
            },
          },
        }, // جلب بيانات الأهداف المرتبطة بالمستخدم
      },
    });
    return new Response(JSON.stringify({ success: true, data: users }), { status: 200 });
  } catch (error) {
    console.error("Prisma Error:", error);
    return new Response(JSON.stringify({ success: false, error: "فشل في جلب المستخدمين" }), { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const createuser = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: await bcrypt.hash(data.password, 10), //
        phone: data.phone || null,
        jobTitle: data.jobTitle,
        accountType: data.accountType,
        salesCommissionPercent: Number(data.salesCommissionPercent) || 0,
        wage: Number.isFinite(Number(data.wage)) ? Math.trunc(Number(data.wage)) : 0,
        // الربط مع جدول الصلاحيات باستخدام المعرف (ID)
        permission: {
          connect: { id: data.permissions } 
        },
        },
    });
    return new Response(JSON.stringify({ success: true, data: createuser }), { status: 201 });
  } catch (error: any) {
    console.error("Prisma Error:", error);  
    // معالجة خطأ تكرار البريد الإلكتروني   
    if (error.code === 'P2002') {
      return new Response(JSON.stringify({ success: false, error: "هذا البريد الإلكتروني مستخدم بالفعل" }), { status: 400 });
    }
    return new Response(JSON.stringify({ success: false, error: "فشل في إنشاء المستخدم، يرجى التحقق من المدخلات" }), { status: 500 });
  }
}