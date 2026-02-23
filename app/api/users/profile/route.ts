import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadUserAvatar } from "@/server/image";

export async function POST(req: NextRequest) {
  try {
    const session = cookies().get("skynova")?.value;
    if (!session) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
    }

    const decoded = await decrypt(session);
    const formData = await req.formData();

    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const jobTitle = String(formData.get("jobTitle") || "").trim();
    const file = formData.get("avatar");

    if (!username || !email) {
      return NextResponse.json({ success: false, error: "الاسم والبريد مطلوبان" }, { status: 400 });
    }

    let avatarUrl: string | undefined;
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadUserAvatar(file);
      avatarUrl = uploaded.url;
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        username,
        email,
        phone: phone || null,
        jobTitle: jobTitle || null,
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        jobTitle: true,
        accountType: true,
        avatar: true,
      },
    });

    return NextResponse.json({ success: true, data: updatedUser }, { status: 200 });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث البيانات" }, { status: 500 });
  }
}
