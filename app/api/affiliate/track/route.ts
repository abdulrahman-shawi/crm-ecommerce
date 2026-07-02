import { NextRequest, NextResponse } from 'next/server';
import { AFFILIATE_COOKIE_NAME } from '@/lib/affiliate';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = String(body?.code || '').trim();
    const productId = Number(body?.productId || 0);

    if (!code || Number.isNaN(productId) || productId <= 0) {
      return NextResponse.json({ success: false, error: 'بيانات التتبع غير صالحة' }, { status: 400 });
    }

    const link = await prisma.affiliateLink.findUnique({
      where: { uniqueCode: code },
      select: {
        id: true,
        productId: true,
      },
    });

    if (!link || link.productId !== productId) {
      return NextResponse.json({ success: false, error: 'رابط الأفلييت غير صالح لهذا المنتج' }, { status: 404 });
    }

    await prisma.affiliateLink.update({
      where: { id: link.id },
      data: {
        clicks: {
          increment: 1,
        },
      },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(AFFILIATE_COOKIE_NAME, code, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'تعذر تتبع رابط الأفلييت' }, { status: 500 });
  }
}