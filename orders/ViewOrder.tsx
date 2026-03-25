"use client";

import * as React from 'react';
import { Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { formatPhoneForDisplay } from '@/lib/utils';
import {
  getOrderCurrencySymbol,
  getOrderShippingPrice,
  getOrderShippingCommissions,
  getOrderTotalShippingExpenses,
  getOrderDisplayDate,
} from '@/orders/orderHelpers';

export default function ViewOrder({
  data,
  products,
}: {
  data: any;
  products: any;
}) {
  const componentRef = React.useRef<HTMLDivElement>(null);
  const currencySymbol = getOrderCurrencySymbol(data);

  const getEffectivePrice = (price: number, discount: number) => {
    return Math.max(0, Number(price || 0) - Number(discount || 0));
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `فاتورة-${data.orderNumber}`,
    onAfterPrint: () => console.log('تمت الطباعة بنجاح'),
  });

  const totalDiscount = Number(data.discount) || 0;
  const finalAmount = Number(data.finalAmount) || 0;
  const subtotal = finalAmount + totalDiscount;
  const shippingPrice = getOrderShippingPrice(data);
  const { moneyTransferCommission, otherCommissions } = getOrderShippingCommissions(data);
  const totalShippingExpenses = getOrderTotalShippingExpenses(data);
  const invoiceGrandTotal = Number(finalAmount);
  const deliveryNotes = String(data?.deliveryNotes || '').trim();
  const additionalNotes = String(data?.additionalNotes || '').trim();

  const getProductName = (productId: any) => {
    const product = products?.find((p: any) => p.id === productId);
    return product ? product.name : `منتج رقم #${productId}`;
  };

  return (
    <div className="p-4 md:p-10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 p-4 bg-white dark:bg-slate-900 no-print">
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Printer size={20} />
          طباعة الفاتورة
        </button>
      </div>

      <div ref={componentRef} className="p-4 md:p-10 bg-white dark:bg-slate-900" dir="rtl">
        <style
          dangerouslySetInnerHTML={{
            __html: `
                    @media print {
                        @page { size: auto; margin: 10mm; }
                        body { -webkit-print-color-adjust: exact; background-color: white !important; }
                        .no-print { display: none !important; }
                    }
                `,
          }}
        />

        <div id="printable-area">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-8 md:mb-10 pb-6 md:pb-8 border-b-2 border-slate-100">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl md:text-5xl font-black text-blue-600 tracking-tighter italic">SKYNOVA</h1>
              <span className="text-base md:text-2xl font-bold text-slate-400">| فاتورة مبيعات</span>
            </div>
            <div className="text-left space-y-1 text-xs md:text-sm text-slate-500 font-bold">
              <p>
                رقم الفاتورة: <span className="text-slate-900 dark:text-white font-mono">#{data.orderNumber}</span>
              </p>
              <p>
                تاريخ الإصدار:{' '}
                <span className="text-slate-900 dark:text-white">{new Date(getOrderDisplayDate(data)).toLocaleDateString('ar-EG')}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:gap-8 mb-8 md:mb-12">
            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100/50">
              <p className="text-xl font-black text-slate-900 dark:text-white">{data.customer?.name}</p>
              <p className="text-sm font-bold text-slate-500 mt-2">طريقة الدفع: {data.paymentMethod}</p>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100">
              <h3 className="text-slate-400 font-black text-sm mb-3 uppercase tracking-wider">تفاصيل العنوان والتوصيل</h3>
              <p className="text-lg font-black text-slate-800 dark:text-white">المستلم: {data.receiverName || 'غير محدد'}</p>

              <div className="text-sm font-bold text-slate-500 mt-2 space-y-1">
                <p>البلد: {data.country} </p>
                <p>المحافظة:{data.city ? ` - ${data.city}` : 'لم يسجل'}</p>
                <p>المنطقة: {data.municipality ? ` - ${data.municipality}` : 'لم يسجل'}</p>
                <p>العنوان: {data.fullAddress || 'لم يسجل'}</p>
                <p>
                  رقم التواصل:{' '}
                  <span dir="ltr">
                    {Array.isArray(data?.receiverPhone)
                      ? data.receiverPhone.filter(Boolean).map((phone: string) => formatPhoneForDisplay(phone)).join(' - ') || 'لم يسجل'
                      : formatPhoneForDisplay(data?.receiverPhone) || 'لم يسجل'}
                  </span>
                </p>
                {data.googleMapsLink && (
                  <div className="">
                    <a target="_blank" href={`${data.googleMapsLink}`} rel="noreferrer">
                      رابط الخريطة
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[2rem] border border-slate-100 mb-6 md:mb-8">
            <table className="w-full text-right">
              <thead className="border border-slate-600">
                <tr className="bg-slate-900 text-white">
                  <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm">المنتج</th>
                  <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm text-center">الكمية</th>
                  <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm text-center">السعر</th>
                  <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items?.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 md:px-8 py-2">
                      <p className="font-black text-slate-800 dark:text-slate-100">{getProductName(item.productId)}</p>
                    </td>
                    <td className="px-4 md:px-8 py-2 text-center font-bold text-slate-600 italic">x{item.quantity}</td>
                    <td className="px-4 md:px-8 py-2 text-center font-bold text-slate-600">
                      {getEffectivePrice(item.price, item.discount || 0).toLocaleString()} {currencySymbol}
                    </td>
                    <td className="px-4 md:px-8 py-2 text-left font-black text-slate-900 dark:text-white">
                      {(getEffectivePrice(item.price, item.discount || 0) * item.quantity).toLocaleString()} {currencySymbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-end md:gap-10">
            <div className="text-slate-400 text-xs font-bold leading-relaxed flex-1">
              * هذه الفاتورة صدرت إلكترونياً وهي وثيقة رسمية.
              <br />* شكراً لتعاملك مع SKYNOVA.
            </div>

            <div className="w-full md:w-96 space-y-3">
              <div className="flex justify-between px-4 md:px-6 text-slate-500 font-bold text-sm">
                <span>المجموع الفرعي:</span>
                <span>{subtotal.toLocaleString()} {currencySymbol}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between px-4 md:px-6 text-rose-500 font-bold text-sm">
                  <span>الخصم الممنوح:</span>
                  <span>-{totalDiscount.toLocaleString()} {currencySymbol}</span>
                </div>
              )}

              {data.paymentMethod === 'مختلطة' && (
                <div className="border-t border-b border-dashed border-slate-200 py-3 space-y-2">
                  <div className="flex justify-between px-4 md:px-6 text-blue-600 font-bold text-sm">
                    <span>القيمة المستلمة (حوالة):</span>
                    <span>{Number(data.amount).toLocaleString()} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between px-4 md:px-6 text-purple-600 font-bold text-sm">
                    <span>القيمة المتبقية (عند الباب):</span>
                    <span>{Number(data.amountBank).toLocaleString()} {currencySymbol}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center p-4 md:p-6 bg-blue-600 rounded-[2rem] text-white shadow-xl">
                <span className="text-lg md:text-xl font-black">الإجمالي النهائي</span>
                <div className="text-right">
                  <span className="text-2xl md:text-3xl font-black italic tracking-tighter">{invoiceGrandTotal.toLocaleString()}</span>
                  <span className="text-sm font-bold mr-1"> {currencySymbol}</span>
                </div>
              </div>
              <div className="flex justify-between px-4 md:px-6 text-slate-700 dark:text-slate-200 font-bold text-sm">
                <span>طريقة الدفع:</span>
                <span>{data.paymentMethod}</span>
              </div>

              {(deliveryNotes || additionalNotes) && (
                <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-sm">
                  <p className="font-black text-slate-700 dark:text-slate-200">الملاحظات</p>
                  {deliveryNotes && (
                    <p className="font-bold text-slate-600 dark:text-slate-300">
                      ملاحظات التوصيل: <span className="font-medium">{deliveryNotes}</span>
                    </p>
                  )}
                  {additionalNotes && (
                    <p className="font-bold text-slate-600 dark:text-slate-300">
                      ملاحظات إضافية: <span className="font-medium">{additionalNotes}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
