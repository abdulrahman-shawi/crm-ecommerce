import { decrypt } from "@/lib/auth";
import { isAffiliateAccount } from "@/lib/affiliate";
import { prisma } from "@/lib/prisma";
import { withWholesalePermissionAliases } from "@/lib/wholesale-permissions";
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
               select: {
                 id: true,
                 username: true,
                 email: true,
                 phone: true,
                 notes: true,
                 jobTitle: true,
                 avatar: true,
                 accountType: true,
                 password: true,
                 createdAt: true,
                 updatedAt: true,
                 permissionId: true,
                 parentId: true,
                 isAffiliate: true,
                 affiliateApproved: true,
                 affiliateRequestedAt: true,
                 affiliateApprovedAt: true,
                 permission: true,
               }
           });

        if (isAffiliateAccount(users?.accountType, users?.isAffiliate) && !users?.affiliateApproved) {
            cookies().set("skynova", "", { expires: new Date(0), httpOnly: true });
            return NextResponse.json({ 
                success: false, 
                error: "حساب الأفلييت بانتظار موافقة الأدمن" 
            }, { status: 403 });
        }

        return NextResponse.json({ 
            success: true, 
            data: users ? withWholesalePermissionAliases(users) : users 
        }, { status: 200 });
    } catch (error) {
        console.error("Fetch Users Error:", error);
        return NextResponse.json({ 
            success: false, 
            error: "فشل في جلب قائمة المستخدمين" 
        }, { status: 500 });
    }
}