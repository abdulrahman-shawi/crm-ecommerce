import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const AFFILIATE_COOKIE_NAME = 'affiliate-code';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = String(params.code || '').trim();
  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const link = await prisma.affiliateLink.findUnique({
    where: { uniqueCode: code },
    include: {
      product: {
        select: {
          seoSlug: true,
          isActive: true,
        },
      },
    },
  });

  if (!link || !link.product?.seoSlug || !link.product.isActive) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  await prisma.affiliateLink.update({
    where: { id: link.id },
    data: {
      clicks: {
        increment: 1,
      },
    },
  });

  const response = NextResponse.redirect(new URL(`/product/${link.product.seoSlug}`, request.url));
  response.cookies.set(AFFILIATE_COOKIE_NAME, code, {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });

  return response;
}