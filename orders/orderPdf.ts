import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import { formatPhoneForDisplay } from '@/lib/utils';
import {
  getOrderCurrencySymbol,
  getOrderDeliveryMethod,
  getOrderDisplayDate,
  getOrderShippingCommissions,
  getOrderShippingName,
  getOrderShippingPrice,
  getOrderTotalShippingExpenses,
} from '@/orders/orderHelpers';

export const buildOrderPdfFile = async (data: any) => {
  const currencySymbol = getOrderCurrencySymbol(data);
  const invoiceNo = data?.orderNumber || '-';
  const createdAt = getOrderDisplayDate(data)
    ? new Date(getOrderDisplayDate(data)).toLocaleDateString('en-US')
    : '-';
  const customerName = data?.customer?.name || 'غير محدد';
  const paymentMethodText = data?.paymentMethod || '-';
  const deliveryMethodText = getOrderDeliveryMethod(data);
  const shippingName = getOrderShippingName(data);
  const shippingPrice = getOrderShippingPrice(data);
  const { moneyTransferCommission, otherCommissions } = getOrderShippingCommissions(data);
  const shippingTotalExpenses = getOrderTotalShippingExpenses(data);
  const receiverName = data?.receiverName || 'غير محدد';
  const receiverPhone = Array.isArray(data?.receiverPhone)
    ? data.receiverPhone.filter(Boolean).map((phone: string) => formatPhoneForDisplay(phone)).join(' - ') || 'لم يسجل'
    : formatPhoneForDisplay(data?.receiverPhone) || 'لم يسجل';
  const country = data?.country || '-';
  const city = data?.city || 'لم يسجل';
  const municipality = data?.municipality || 'لم يسجل';
  const fullAddress = data?.fullAddress || 'لم يسجل';
  const mapLink = data?.googleMapsLink || '';
  const deliveryNotes = String(data?.deliveryNotes || '').trim();
  const additionalNotes = String(data?.additionalNotes || '').trim();
  const items = Array.isArray(data?.items) ? data.items : [];

  const formatMoney = (value: any) => Number(value || 0).toLocaleString('en-US');
  const totalDiscount = Number(data?.discount || 0);
  const finalAmount = Number(data?.finalAmount || 0);
  const invoiceGrandTotal = finalAmount;
  const subtotal = finalAmount + totalDiscount;
  const amountBank = Number(data?.amountBank || 0);
  const amount = Number(data?.amount || 0);

  const logoUrl = `${window.location.origin}/skynova-light.png`;

  const rowsHtml = items.length
    ? items
        .map((item: any, idx: number) => {
          const name = item?.product?.name || item?.name || `منتج ${idx + 1}`;
          const quantity = Number(item?.quantity || 0);
          const price = Number(item?.price || 0);
          const discount = Number(item?.discount || 0);
          const effectivePrice = Math.max(0, price - discount);
          const total = effectivePrice * quantity;
          return `
                    <tr>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
                            <div style="font-weight:800;color:#0f172a;">${name}</div>
                            ${discount > 0 ? `<div style="font-size:11px;color:#ef4444;">خصم: ${formatMoney(discount)} ${currencySymbol}</div>` : ''}
                        </td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#475569;">x${quantity}</td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#475569;">${formatMoney(effectivePrice)} ${currencySymbol}</td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-weight:900;color:#0f172a;">${formatMoney(total)} ${currencySymbol}</td>
                    </tr>
                `;
        })
        .join('')
    : `
                <tr>
                    <td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;">لا توجد منتجات</td>
                </tr>
            `;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('dir', 'rtl');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.style.width = '900px';
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#0f172a';
  wrapper.style.padding = '28px';
  wrapper.style.fontFamily = 'Tahoma, Arial, sans-serif';
  wrapper.style.lineHeight = '1.7';

  wrapper.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:18px;">
                <div style="display:flex;gap:12px;align-items:center;">
                    <img src="${logoUrl}" alt="SKYNOVA" style="height:48px;object-fit:contain;" />
                    <div style="font-size:18px;font-weight:800;color:#94a3b8;">فاتورة مبيعات</div>
                </div>
                <div style="text-align:left;font-size:12px;color:#64748b;font-weight:700;">
                    <div>رقم الفاتورة: <span style="color:#0f172a;font-weight:900;">#${invoiceNo}</span></div>
                    <div>تاريخ الإصدار: <span style="color:#0f172a;">${createdAt}</span></div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:18px;">
                <div style="background:#eff6ff;border:1px solid #dbeafe;border-radius:18px;padding:16px;">
                    <div style="font-size:18px;font-weight:900;color:#0f172a;">${customerName}</div>
                    <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:6px;">طريقة الدفع: ${paymentMethodText}</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:16px;">
                    <div style="font-size:12px;font-weight:900;color:#94a3b8;letter-spacing:1px;">تفاصيل العنوان والتوصيل</div>
                    <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:6px;">المستلم: ${receiverName}</div>
                    <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:6px;line-height:1.7;">
                        <div>البلد: ${country}</div>
                        <div>المحافظة: ${city}</div>
                        <div>المنطقة: ${municipality}</div>
                        <div>العنوان: ${fullAddress}</div>
                        <div>رقم التواصل: <span dir="ltr">${receiverPhone}</span></div>
                        ${mapLink ? `<div>رابط الخريطة: ${mapLink}</div>` : ''}
                    </div>
                </div>
            </div>

            <div style="border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;margin-bottom:18px;">
                <table style="width:100%;border-collapse:collapse;text-align:right;">
                    <thead>
                        <tr style="background:#0f172a;color:#ffffff;">
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;">المنتج</th>
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;text-align:center;">الكمية</th>
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;text-align:center;">السعر</th>
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;text-align:left;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>

            <div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-end;">
                <div style="flex:1;font-size:11px;font-weight:700;color:#94a3b8;">
                    * هذه الفاتورة صدرت إلكترونياً وهي وثيقة رسمية.<br />
                    * شكراً لتعاملك معنا.
                ${
                  deliveryNotes || additionalNotes
                  ? `
                <div style="margin-top:10px;padding:10px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#334155;">
                  <div style="font-size:12px;font-weight:900;color:#0f172a;margin-bottom:4px;">الملاحظات</div>
                  ${deliveryNotes ? `<div style="font-size:11px;font-weight:700;">ملاحظات التوصيل: ${deliveryNotes}</div>` : ''}
                  ${additionalNotes ? `<div style="font-size:11px;font-weight:700;">ملاحظات إضافية: ${additionalNotes}</div>` : ''}
                </div>
                `
                  : ''
                }
                </div>
                <div style="width:280px;display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#64748b;">
                        <span>المجموع الفرعي:</span>
                        <span>${formatMoney(subtotal)} ${currencySymbol}</span>
                    </div>
                    ${
                      totalDiscount > 0
                        ? `
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#f43f5e;">
                        <span>الخصم الممنوح:</span>
                        <span>-${formatMoney(totalDiscount)} ${currencySymbol}</span>
                    </div>
                    `
                        : ''
                    }
                    ${
                      paymentMethodText === 'مختلطة'
                        ? `
                    <div style="border-top:1px dashed #e2e8f0;border-bottom:1px dashed #e2e8f0;padding:8px 0;display:flex;flex-direction:column;gap:6px;">
                        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#2563eb;">
                            <span>القيمة المستلمة (حوالة):</span>
                            <span>${formatMoney(amount)} ${currencySymbol}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#7c3aed;">
                            <span>القيمة المتبقية (عند الباب):</span>
                            <span>${formatMoney(amountBank)} ${currencySymbol}</span>
                        </div>
                    </div>
                    `
                        : ''
                    }
                    <div style="display:flex;justify-content:space-between;align-items:center;background:#2563eb;color:#ffffff;border-radius:18px;padding:14px 16px;box-shadow:0 12px 24px rgba(37,99,235,0.2);">
                        <span style="font-size:14px;font-weight:900;">الإجمالي النهائي</span>
                        <span style="font-size:22px;font-weight:900;">${formatMoney(invoiceGrandTotal)} <span style="font-size:12px;">${currencySymbol}</span></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#475569;">
                        <span>طريقة الدفع:</span>
                        <span> ${paymentMethodText}</span>
                    </div>
                </div>
            </div>
        `;

  document.body.appendChild(wrapper);
  const canvas = await html2canvas(wrapper, {
    scale: 1.3,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
  document.body.removeChild(wrapper);

  const imgData = canvas.toDataURL('image/jpeg', 0.72);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const imageHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imageHeight;
  let position = 0;

  doc.addImage(imgData, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imageHeight;
    doc.addPage();
    doc.addImage(imgData, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  const blob = doc.output('blob');
  return new File([blob], `order-${invoiceNo}.pdf`, { type: 'application/pdf' });
};

let isSharingOrderPdf = false;
const orderPdfCache = new Map<string, File>();
const orderPdfPending = new Map<string, Promise<File>>();

const getOrderPdfCacheKey = (data: any) => {
  const orderId = data?.id ?? data?._id ?? data?.orderNumber ?? 'unknown';
  const updatedAt = data?.updatedAt ?? data?.createdAt ?? '';
  return `${orderId}-${updatedAt}`;
};

const downloadPdfFile = (pdfFile: File) => {
  const downloadUrl = URL.createObjectURL(pdfFile);
  try {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = pdfFile.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    return true;
  } catch {
    const openedWindow = window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    return !!openedWindow;
  }
};

export const prepareOrderPdfForShare = async (data: any) => {
  if (!data) {
    throw new Error('بيانات الطلب غير متوفرة');
  }

  const key = getOrderPdfCacheKey(data);
  const cachedFile = orderPdfCache.get(key);
  if (cachedFile) {
    return cachedFile;
  }

  const pendingFile = orderPdfPending.get(key);
  if (pendingFile) {
    return pendingFile;
  }

  const generationPromise = buildOrderPdfFile(data)
    .then((file) => {
      orderPdfCache.set(key, file);
      orderPdfPending.delete(key);
      return file;
    })
    .catch((error) => {
      orderPdfPending.delete(key);
      throw error;
    });

  orderPdfPending.set(key, generationPromise);
  return generationPromise;
};

export const shareOrderPdfToCustomerWhatsApp = async (data: any) => {
  if (!data) {
    toast.error('بيانات الطلب غير متوفرة');
    return;
  }

  if (isSharingOrderPdf) {
    toast('جاري تجهيز المشاركة...');
    return;
  }

  isSharingOrderPdf = true;
  try {
    const cacheKey = getOrderPdfCacheKey(data);
    const shareTitle = `فاتورة الطلب #${data?.orderNumber || ''}`;
    const shareText = `فاتورة #${data?.orderNumber || ''} - ${data?.customer?.name || ''}`;
    const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const hasCanShare = hasShare && typeof navigator.canShare === 'function';
    const cachedFile = orderPdfCache.get(cacheKey);

    if (cachedFile && hasShare && hasCanShare) {
      let canShareCachedFile = false;
      try {
        canShareCachedFile = navigator.canShare({ files: [cachedFile] });
      } catch {
        canShareCachedFile = false;
      }

      if (canShareCachedFile) {
        try {
          await navigator.share({ title: shareTitle, text: shareText, files: [cachedFile] });
          toast.success('تم فتح شاشة المشاركة');
          return;
        } catch (shareError: any) {
          if (shareError?.name === 'AbortError') {
            return;
          }

          orderPdfCache.delete(cacheKey);
        }
      }
    }

    const loadingToast = toast.loading('جاري إنشاء ملف PDF...');
    try {
      const file = await prepareOrderPdfForShare(data);
      toast.dismiss(loadingToast);

      if (hasShare && hasCanShare) {
        let canShareGeneratedFile = false;
        try {
          canShareGeneratedFile = navigator.canShare({ files: [file] });
        } catch {
          canShareGeneratedFile = false;
        }

        if (canShareGeneratedFile) {
          try {
            await navigator.share({ title: shareTitle, text: shareText, files: [file] });
            toast.success('تم فتح شاشة المشاركة');
            return;
          } catch (shareError: any) {
            if (shareError?.name === 'AbortError') {
              return;
            }
          }
        }
      }

      downloadPdfFile(file);
      if (hasShare) {
        toast.success('تم تنزيل الملف ✓ اضغط مشاركة PDF مرة أخرى لإرساله عبر واتساب أو أي تطبيق');
      } else {
        toast.success('تم تنزيل ملف PDF على جهازك');
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('تعذر إنشاء ملف PDF، حاول مرة أخرى');
      console.error('[shareOrderPdf]', err);
    }
  } finally {
    isSharingOrderPdf = false;
  }
};
