import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs"; //
import { NextRequest } from 'next/server';
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
export async function GET(req :NextRequest) {
    try {
    const session = cookies().get("skynova")?.value;
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: "غير مصرح" }), { status: 401 });
    }

    const decoded = await decrypt(session);
    const currentUser = await prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      select: { id: true, accountType: true },
    });

    if (!currentUser) {
      return new Response(JSON.stringify({ success: false, error: "غير مصرح" }), { status: 401 });
    }

    const whereClause = currentUser.accountType === "ADMIN"
      ? undefined
      : {
          OR: [
            { id: currentUser.id },
            { parentId: currentUser.id },
          ],
        };

    const users = await prisma.user.findMany({
      ...(whereClause ? { where: whereClause } : {}),
      include: {
        permission: true, // جلب بيانات الصلاحيات المرتبطة بالمستخدم
        activityTargets: {
          orderBy: { createdAt: 'desc' },
        },
        targets: {
          orderBy: { updatedAt: 'desc' },
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

    const normalizedUsers = users.map((userRow: any) => ({
      ...userRow,
      activityTarget: Array.isArray(userRow.activityTargets) ? userRow.activityTargets[0] || null : null,
    }));

    return new Response(JSON.stringify({ success: true, data: normalizedUsers }), { status: 200 });
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