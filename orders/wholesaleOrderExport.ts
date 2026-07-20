import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import { formatPhoneForDisplay } from '@/lib/utils';
import { getOrderCurrencySymbol, getOrderDisplayDate } from '@/orders/orderHelpers';

export async function exportWholesaleOrdersToExcel(orders: any[], filename?: string) {
  try {
    const worksheetData = orders.map((order: any) => {
      const itemsSummary = (Array.isArray(order?.items) ? order.items : [])
        .map((item: any) => `${item?.product?.name || 'غير محدد'} (${Number(item?.quantity || 1)})`)
        .join(' - ');

      const itemsStructured = JSON.stringify(
        (Array.isArray(order?.items) ? order.items : []).map((item: any) => ({
          name: item?.product?.name || '',
          quantity: Number(item?.quantity || 0),
          price: Number(item?.price || 0),
          discount: Number(item?.discount || 0),
        }))
      );

      return {
        'رقم الطلب': order?.orderNumber,
        'تاريخ الإنشاء': new Date(getOrderDisplayDate(order)).toLocaleString('ar-EG'),
        'حالة الطلب': order?.status,
        'عميل الجملة': order?.wholesaleCustomer?.name || '',
        'المندوب المسؤول': order?.user?.username || order?.wholesaleCustomer?.assignedUser?.username || '',
        'رقم المستلم': Array.isArray(order?.receiverPhone) ? order.receiverPhone.join(' - ') : '',
        'الدولة': order?.country || '',
        'المدينة': order?.city || '',
        'المنطقة': order?.municipality || '',
        'العنوان': order?.fullAddress || '',
        'المستودع': order?.warehouse?.name || '',
        'بلد المخزون': order?.warehouse?.location || '',
        'طريقة الدفع': order?.paymentMethod || '',
        'المجموع': Number(order?.totalAmount || 0),
        'الخصم': Number(order?.discount || 0),
        'الإجمالي النهائي': Number(order?.finalAmount || 0),
        'المنتجات': itemsSummary,
        'المنتجات (JSON)': itemsStructured,
        'ملاحظات التوصيل': order?.deliveryNotes || '',
        'ملاحظات إضافية': order?.additionalNotes || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'طلبات الجملة');
    worksheet['!dir'] = 'rtl';
    XLSX.writeFile(workbook, filename || `wholesale-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('تم تصدير طلبات الجملة إلى Excel');
  } catch (error) {
    console.error('Wholesale Excel export error:', error);
    toast.error('فشل تصدير طلبات الجملة');
  }
}

export async function downloadWholesaleOrderPdf(data: any) {
  try {
    const currencySymbol = getOrderCurrencySymbol(data);
    const invoiceNo = data?.orderNumber || '-';
    const createdAt = getOrderDisplayDate(data)
      ? new Date(getOrderDisplayDate(data)).toLocaleDateString('ar-EG')
      : '-';
    const customerName = data?.wholesaleCustomer?.name || 'غير محدد';
    const paymentMethodText = data?.paymentMethod || '-';
    const receiverName = data?.receiverName || 'غير محدد';
    const receiverPhone = Array.isArray(data?.receiverPhone)
      ? data.receiverPhone.filter(Boolean).map((phone: string) => formatPhoneForDisplay(phone)).join(' - ') || 'لم يسجل'
      : 'لم يسجل';
    const country = data?.country || '-';
    const city = data?.city || 'لم يسجل';
    const municipality = data?.municipality || 'لم يسجل';
    const fullAddress = data?.fullAddress || 'لم يسجل';
    const deliveryNotes = String(data?.deliveryNotes || '').trim();
    const additionalNotes = String(data?.additionalNotes || '').trim();
    const items = Array.isArray(data?.items) ? data.items : [];
    const totalDiscount = Number(data?.discount || 0);
    const finalAmount = Number(data?.finalAmount || 0);
    const subtotal = Number(data?.totalAmount || 0);

    const rowsHtml = items.length
      ? items
          .map((item: any) => {
            const name = item?.product?.name || 'منتج غير محدد';
            const quantity = Number(item?.quantity || 0);
            const price = Number(item?.price || 0);
            const discount = Number(item?.discount || 0);
            const effectivePrice = Math.max(0, price - discount);
            const total = effectivePrice * quantity;
            return `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
                  <div style="font-weight:800;color:#0f172a;">${name}</div>
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#475569;">x${quantity}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#475569;">${effectivePrice.toLocaleString('en-US')} ${currencySymbol}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-weight:900;color:#0f172a;">${total.toLocaleString('en-US')} ${currencySymbol}</td>
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
        <div style="font-size:18px;font-weight:800;color:#2563eb;">فاتورة طلب جملة</div>
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
          <div style="font-size:12px;font-weight:900;color:#94a3b8;letter-spacing:1px;">تفاصيل التوصيل</div>
          <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:6px;">المستلم: ${receiverName}</div>
          <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:6px;line-height:1.7;">
            <div>البلد: ${country}</div>
            <div>المحافظة: ${city}</div>
            <div>المنطقة: ${municipality}</div>
            <div>العنوان: ${fullAddress}</div>
            <div>رقم التواصل: <span dir="ltr">${receiverPhone}</span></div>
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
          ${deliveryNotes || additionalNotes ? `
          <div style="margin-top:10px;padding:10px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#334155;">
            <div style="font-size:12px;font-weight:900;color:#0f172a;margin-bottom:4px;">الملاحظات</div>
            ${deliveryNotes ? `<div style="font-size:11px;font-weight:700;">ملاحظات التوصيل: ${deliveryNotes}</div>` : ''}
            ${additionalNotes ? `<div style="font-size:11px;font-weight:700;">ملاحظات إضافية: ${additionalNotes}</div>` : ''}
          </div>` : ''}
        </div>
        <div style="width:280px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#64748b;">
            <span>المجموع الفرعي:</span>
            <span>${subtotal.toLocaleString('en-US')} ${currencySymbol}</span>
          </div>
          ${totalDiscount > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#f43f5e;">
            <span>الخصم الممنوح:</span>
            <span>-${totalDiscount.toLocaleString('en-US')} ${currencySymbol}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;background:#2563eb;color:#ffffff;border-radius:18px;padding:14px 16px;box-shadow:0 12px 24px rgba(37,99,235,0.2);">
            <span style="font-size:14px;font-weight:900;">الإجمالي النهائي</span>
            <span style="font-size:22px;font-weight:900;">${finalAmount.toLocaleString('en-US')} <span style="font-size:12px;">${currencySymbol}</span></span>
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

    doc.save(`wholesale-order-${invoiceNo}.pdf`);
    toast.success('تم تصدير طلب الجملة إلى PDF');
  } catch (error) {
    console.error('Wholesale PDF export error:', error);
    toast.error('فشل تصدير طلب الجملة إلى PDF');
  }
}