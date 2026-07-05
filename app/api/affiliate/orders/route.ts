import { NextRequest, NextResponse } from 'next/server';
import { createPublicCustomerForAffiliateOrder } from '@/server/affiliate';
import { createOrder } from '@/server/order';
import { calculateQuantityDiscountPricing } from '@/lib/ad-pricing';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = Number(body?.productId || 0);
    const quantity = Number(body?.quantity || 0);

    if (Number.isNaN(productId) || productId <= 0 || Number.isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ success: false, error: 'بيانات الطلب غير صالحة' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        landingPage: true,
        stocks: {
          include: {
            warehouse: true,
          },
          orderBy: { quantity: 'desc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: 'المنتج غير موجود' }, { status: 404 });
    }

    const customerResult = await createPublicCustomerForAffiliateOrder({
      name: body?.customerName,
      phone: body?.phone,
      country: body?.country,
      city: body?.city,
    });

    if (!customerResult.success || !customerResult.data) {
      return NextResponse.json({ success: false, error: customerResult.error || 'تعذر إنشاء العميل' }, { status: 400 });
    }

    const orderPrice = Number(product.affiliatePrice || 0) > 0
      ? Number(product.affiliatePrice)
      : Number(product.stocks?.[0]?.price || 0);
    const pricing = calculateQuantityDiscountPricing(orderPrice, quantity, product.landingPage?.quantityDiscountTiers);

    const items = [
      {
        productId: String(product.id),
        quantity: pricing.quantity,
        price: orderPrice,
        discount: pricing.unitDiscountAmount,
      },
    ];

    const grandTotal = pricing.finalAmount;
    const orderResult = await createOrder(
      {
        customerId: customerResult.data.id,
        status: 'طلب جديد',
        receiverName: String(body?.receiverName || body?.customerName || '').trim(),
        receiverPhone: [String(body?.phone || '').trim()],
        stockCountry: String(body?.stockCountry || 'سوريا').trim() || 'سوريا',
        country: String(body?.country || '').trim(),
        city: String(body?.city || '').trim(),
        municipality: String(body?.municipality || '').trim(),
        fullAddress: String(body?.fullAddress || '').trim(),
        googleMapsLink: '',
        shippingId: null,
        deliveryMethod: 'توصيل',
        amount: '',
        amountBank: grandTotal,
        deliveryNotes: String(body?.deliveryNotes || '').trim(),
        paymentMethod: String(body?.paymentMethod || 'عند الاستلام').trim() || 'عند الاستلام',
        additionalNotes: 'affiliate-order',
        grandTotal,
        overallDiscount: 0,
        subTotal: pricing.subtotal,
      },
      items,
      null
    );

    if (!orderResult.success) {
      return NextResponse.json({ success: false, error: orderResult.error || 'تعذر إنشاء الطلب' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: orderResult.order }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'حدث خطأ أثناء إنشاء الطلب' }, { status: 500 });
  }
}