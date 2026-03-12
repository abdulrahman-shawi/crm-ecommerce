import React from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

interface ExportOptions {
  filename?: string;
  sheetName?: string;
}

const getOrderDisplayDate = (orderLike: any) => orderLike?.manualCreatedAt || orderLike?.createdAt;

const getOrderCurrencySymbol = (orderLike: any) => String(orderLike?.warehouse?.location || "").trim() === "تركيا" ? "₺" : "$";

const getOrderShippingName = (orderLike: any) => String(orderLike?.shipping?.name || "").trim() || "غير محدد";

const getOrderShippingPrice = (orderLike: any) => {
  return Number((orderLike?.shippingPrice ?? orderLike?.shipping?.price) || 0);
};

const getOrderShippingCommissions = (orderLike: any) => {
  const moneyTransferCommission = Number(orderLike?.moneyTransferCommission || 0);
  const otherCommissions = Number(orderLike?.otherCommissions || 0);
  return {
    moneyTransferCommission,
    otherCommissions,
  };
};

const getOrderTotalShippingExpenses = (orderLike: any) => {
  const shippingPrice = getOrderShippingPrice(orderLike);
  const { moneyTransferCommission, otherCommissions } = getOrderShippingCommissions(orderLike);
  return shippingPrice + moneyTransferCommission + otherCommissions;
};

const getOrderDeliveryMethod = (orderLike: any) => String(orderLike?.deliveryMethod || "").trim() || "غير محدد";

export const useOrderExport = () => {
  const [isExporting, setIsExporting] = React.useState(false);

  // تصدير الطلبات إلى Excel
  const exportToExcel = async (orders: any[], options: ExportOptions = {}) => {
    const { filename = `Skynova_Full_Report_${new Date().toISOString().split('T')[0]}.xlsx`, sheetName = "كافة الطلبات" } = options;

    try {
      setIsExporting(true);

      const worksheetData = orders.map((order: any) => {
        const itemsSummary = (Array.isArray(order?.items) ? order.items : [])
          .map((i: any) => `${i?.product?.name || i?.name || "غير محدد"} (${Number(i?.quantity || 1)})`)
          .join(" - ");

        const itemsStructured = JSON.stringify(
          (Array.isArray(order?.items) ? order.items : []).map((i: any) => ({
            name: i?.product?.name || i?.name || "",
            quantity: Number(i.quantity || 0),
            price: Number(i.price || 0),
            discount: Number(i.discount || 0),
          }))
        );

        return {
          "رقم المرجع": order.orderNumber,
          "تاريخ الإنشاء": new Date(getOrderDisplayDate(order)).toLocaleString('ar-EG'),
          "تاريخ الإنشاء ISO": new Date(getOrderDisplayDate(order)).toISOString(),
          "حالة الطلب": order.status,
          "اسم العميل": order.customer?.name,
          "هاتف العميل": order.customer?.phone ? (Array.isArray(order.customer.phone) ? order.customer.phone.join(' - ') : order.customer.phone) : "لم يسجل",
          "الجنس": order.customer?.gender || "غير محدد",
          "الفئة العمرية": order.customer?.age || "غير محدد",
          "المبلغ الإجمالي": order.totalAmount,
          "الخصم": order.discount,
          "المبلغ النهائي": order.finalAmount,
          "طريقة الدفع": order.paymentMethod,
          "المنتجات المشتراة": itemsSummary,
          "اسم المستلم": order.receiverName || "نفس العميل",
          "هاتف المستلم": order.receiverPhone ? (Array.isArray(order.receiverPhone) ? order.receiverPhone.join(' - ') : order.receiverPhone) : "لم يسجل",
          "الدولة": order.country,
          "المدينة": order.city,
          "البلدية": order.municipality,
          "العنوان الكامل": order.fullAddress,
          "بلد المخزون": order?.warehouse?.location || order?.country || "",
          "رابط الخريطة": order.googleMapsLink,
          "طريقة التوصيل": getOrderDeliveryMethod(order),
          "شركة الشحن": getOrderShippingName(order),
          "سعر الشحن": getOrderShippingPrice(order),
          "عمولة تحويل الأموال": Number(order.moneyTransferCommission || 0),
          "عمولات أخرى": Number(order.otherCommissions || 0),
          "إجمالي مصاريف الشحن": getOrderTotalShippingExpenses(order),
          "المجموع الكلي مع الشحن": Number(order.finalAmount || 0) + getOrderTotalShippingExpenses(order),
          "المنتجات (JSON)": itemsStructured,
          "كود التتبع": order.trackingCode,
          "ملاحظات التوصيل": order.deliveryNotes,
          "بواسطة الموظف": order.user?.name || "Admin",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      worksheet['!dir'] = "rtl";
      XLSX.writeFile(workbook, filename);

      toast.success("تم تصدير الطلبات بنجاح");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("فشل تصدير الطلبات");
    } finally {
      setIsExporting(false);
    }
  };

  // تصدير الطلب إلى PDF
  const exportOrderToPdf = async (elementId: string, filename: string = "order.pdf") => {
    try {
      setIsExporting(true);
      const element = document.getElementById(elementId);

      if (!element) {
        toast.error("لم يتم العثور على العنصر المراد تصديره");
        return;
      }

      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(filename);

      toast.success("تم تصدير الطلب بنجاح");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("فشل تصدير الطلب إلى PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // طباعة الطلب
  const printOrder = (elementId: string) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        toast.error("لم يتم العثور على العنصر المراد طباعته");
        return;
      }

      const printWindow = window.open("", "", "height=500,width=500");
      if (printWindow) {
        printWindow.document.write(element.innerHTML);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error("Print error:", error);
      toast.error("فشلت عملية الطباعة");
    }
  };

  return {
    isExporting,
    exportToExcel,
    exportOrderToPdf,
    printOrder,
  };
};
