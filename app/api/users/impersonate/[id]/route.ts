import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * Returns an employee profile for authorized dashboard switching in a separate tab.
 * ADMIN can open all users. Non-admin can open only linked users (parentId === currentUser.id).
 */
export async function GET(_: Request, context: RouteContext) {
  try {
    const session = cookies().get("skynova")?.value;
    if (!session) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
    }

    const decoded = await decrypt(session);
    const currentUser = await prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      select: { id: true, accountType: true },
    });

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const targetId = String(context.params.id || "").trim();
    if (!targetId) {
      return NextResponse.json({ success: false, error: "معرف المستخدم غير صالح" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      include: { permission: true },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "المستخدم غير موجود" }, { status: 404 });
    }

    const canAccessAll = currentUser.accountType === "ADMIN";
    const isSelf = targetUser.id === currentUser.id;
    const isLinkedSubordinate = String(targetUser.parentId || "") === String(currentUser.id);

    if (!canAccessAll && !isSelf && !isLinkedSubordinate) {
      return NextResponse.json({ success: false, error: "ليس لديك صلاحية" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: targetUser }, { status: 200 });
  } catch (error) {
    console.error("Impersonate User Error:", error);
    return NextResponse.json({ success: false, error: "فشل في تحميل المستخدم" }, { status: 500 });
  }
}
