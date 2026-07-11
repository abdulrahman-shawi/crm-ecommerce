import { NextRequest, NextResponse } from 'next/server';
import { AD_VISITOR_COOKIE_NAME } from '@/lib/affiliate';
import { prisma } from '@/lib/prisma';

function detectDeviceType(userAgent: string) {
  if (/tablet|ipad/i.test(userAgent)) {
    return 'Tablet';
  }

  if (/mobile|android|iphone|ipod/i.test(userAgent)) {
    return 'Mobile';
  }

  return 'Desktop';
}

function detectBrowser(userAgent: string) {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) return 'Opera';
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent) && !/opr\//i.test(userAgent)) return 'Chrome';
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return 'Safari';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  return 'Unknown';
}

function detectOperatingSystem(userAgent: string) {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod|ios/i.test(userAgent)) return 'iOS';
  if (/mac os|macintosh/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Unknown';
}

function isAdAnalyticsTableMissing(error: any) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').trim();

  if (code === 'P2021' || code === 'P2022') {
    return true;
  }

  return /ad_page_visits|AdPageVisit/i.test(message) && /does not exist|not exist|missing/i.test(message);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = Number(body?.productId || 0);
    const path = String(body?.path || '').trim() || `/ad/${productId}`;

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ success: false, error: 'بيانات التتبع غير صالحة' }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        showInAds: true,
        landingPage: {
          is: {
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'الإعلان غير موجود أو غير مفعل' }, { status: 404 });
    }

    const existingVisitorId = String(request.cookies.get(AD_VISITOR_COOKIE_NAME)?.value || '').trim();
    const visitorId = existingVisitorId || crypto.randomUUID();
    const userAgent = String(request.headers.get('user-agent') || '').trim();
    const referrer = String(request.headers.get('referer') || '').trim() || null;
    const localeHeader = String(request.headers.get('accept-language') || '').trim();
    const locale = localeHeader ? localeHeader.split(',')[0]?.trim() || null : null;

    try {
      await prisma.adPageVisit.create({
        data: {
          productId,
          visitorId,
          path,
          referrer,
          userAgent: userAgent || null,
          browser: detectBrowser(userAgent),
          os: detectOperatingSystem(userAgent),
          deviceType: detectDeviceType(userAgent),
          locale,
        },
      });
    } catch (error: any) {
      if (!isAdAnalyticsTableMissing(error)) {
        throw error;
      }
    }

    const response = NextResponse.json({ success: true });

    if (!existingVisitorId) {
      response.cookies.set(AD_VISITOR_COOKIE_NAME, visitorId, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'تعذر تتبع زيارة صفحة الإعلان' }, { status: 500 });
  }
}