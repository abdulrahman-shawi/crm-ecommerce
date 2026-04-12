import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// دوال الحصول على معلومات الطلب
export const getOrderCurrencySymbol = (orderLike: any) => 
  String(orderLike?.warehouse?.location || "").trim() === "تركيا" ? "₺" : "$";

export const getOrderShippingName = (orderLike: any) => 
  String(orderLike?.shipping?.name || "").trim() || "غير محدد";

export const getOrderShippingPrice = (orderLike: any) => {
  return Number((orderLike?.shippingPrice ?? orderLike?.shipping?.price) || 0);
};

export const getOrderShippingCommissions = (orderLike: any) => {
  const moneyTransferCommission = Number(orderLike?.moneyTransferCommission || 0);
  const otherCommissions = Number(orderLike?.otherCommissions || 0);
  return {
    moneyTransferCommission,
    otherCommissions,
  };
};

export const getOrderTotalShippingExpenses = (orderLike: any) => {
  const shippingPrice = getOrderShippingPrice(orderLike);
  const { moneyTransferCommission, otherCommissions } = getOrderShippingCommissions(orderLike);
  return shippingPrice + moneyTransferCommission + otherCommissions;
};

export const getOrderAmountToCollect = (orderLike: any) => {
  const paymentMethod = String(orderLike?.paymentMethod || "").trim();
  const finalAmount = Number(orderLike?.finalAmount || 0);
  const receivedAmount = Number(orderLike?.amount || 0);
  const remainingAmount = Number(orderLike?.amountBank || (finalAmount - receivedAmount) || 0);

  if (paymentMethod === "تحويل بنكي") {
    return 0;
  }

  if (paymentMethod === "مختلطة") {
    return Math.max(0, remainingAmount);
  }

  return Math.max(0, finalAmount);
};

export const getOrderNetAmountAfterShipping = (orderLike: any) => {
  return getOrderAmountToCollect(orderLike) - getOrderTotalShippingExpenses(orderLike);
};

export const getOrderDeliveryMethod = (orderLike: any) => 
  String(orderLike?.deliveryMethod || "").trim() || "غير محدد";

export const getOrderDisplayDate = (orderLike: any) => 
  orderLike?.manualCreatedAt || orderLike?.createdAt;

// دوال معالجة التاريخ
export const getMonthKey = (dateValue: Date | string | number) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

export const getCurrentMonthKey = () => getMonthKey(new Date());

export const getPreviousMonthKey = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return getMonthKey(date);
};

// دوال معالجة الهاتف
export const formatPhoneForInvoice = (phoneValue?: string | null) => {
  const raw = String(phoneValue || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const plusMatch = raw.match(/^\+(\d{1,4})(.*)$/);
    if (plusMatch) {
      const countryCode = plusMatch[1];
      const remaining = plusMatch[2].replace(/^[\s-]+/, "") || "-";
      return `+${countryCode} - ${remaining}`;
    }
  }

  if (raw.startsWith("00")) {
    const normalized = `+${raw.slice(2)}`;
    const zeroMatch = normalized.match(/^\+(\d{1,4})(.*)$/);
    if (zeroMatch) {
      const countryCode = zeroMatch[1];
      const remaining = zeroMatch[2].replace(/^[\s-]+/, "") || "-";
      return `+${countryCode} - ${remaining}`;
    }
  }

  return raw.replace(/\s+/g, " ");
};

export const openWhatsAppByPhone = (rawPhone?: string | null) => {
  const phone = String(rawPhone || "").trim();
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) {
    toast.error("لا يوجد رقم هاتف لهذا الموظف");
    return;
  }
  window.open(`https://wa.me/${normalized}`, "_blank");
};

// دوال الحسابات
export const getEffectivePrice = (price: number, discount: number) => {
  return Math.max(0, Number(price || 0) - Number(discount || 0));
};

// دوال معالجة الاستيراد
export const getCellValueByAliases = (row: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

export const parseItemsFromSummary = (summary: string) => {
  return String(summary || "")
    .split(" - ")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = chunk.match(/(.+?)\s*\((\d+)\)$/);
      if (!match) {
        return { name: chunk, quantity: 1 };
      }

      return {
        name: String(match[1] || "").trim(),
        quantity: Number(match[2] || 1),
      };
    })
    .filter((item) => item.name && Number(item.quantity) > 0);
};

export const normalizeText = (value: unknown) => String(value || "").trim().toLowerCase();

export const parseImportedDateValue = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0));
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  const normalizeArabicDigits = (input: string) => {
    const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
    const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
    return input
      .split("")
      .map((ch) => {
        const index1 = arabicIndic.indexOf(ch);
        if (index1 >= 0) return String(index1);
        const index2 = easternArabicIndic.indexOf(ch);
        if (index2 >= 0) return String(index2);
        return ch;
      })
      .join("");
  };

  const rawText = String(value)
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .trim();
  const normalizedText = normalizeArabicDigits(rawText)
    .replace(/\s+/g, " ")
    .trim();

  const arabicDateMatch = normalizedText.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*([AaPp]|AM|PM|ص|م)?)?$/i
  );

  if (arabicDateMatch) {
    let day = Number(arabicDateMatch[1]);
    let month = Number(arabicDateMatch[2]);
    let year = Number(arabicDateMatch[3]);
    let hour = Number(arabicDateMatch[4] || 0);
    const minute = Number(arabicDateMatch[5] || 0);
    const second = Number(arabicDateMatch[6] || 0);
    const ampmToken = String(arabicDateMatch[7] || "").toLowerCase();

    if (year < 100) year += 2000;

    const isPm = ampmToken === "p" || ampmToken === "pm" || ampmToken === "م";
    const isAm = ampmToken === "a" || ampmToken === "am" || ampmToken === "ص";

    if (isPm && hour < 12) hour += 12;
    if (isAm && hour === 12) hour = 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day, hour, minute, second);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  const date = new Date(normalizedText);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

// دوال الألوان
export const statusCardColors: Record<string, string> = {
  "الكل": "bg-slate-900 text-white border-slate-900",
  "طلب جديد": "bg-sky-200 text-sky-900 border-sky-300",
  "تم استلام الطلب": "bg-blue-200 text-blue-900 border-blue-300",
  "تم ارسال الطلب": "bg-amber-200 text-amber-900 border-amber-300",
  "تم تسليم الطلب": "bg-emerald-200 text-emerald-900 border-emerald-300",
  "فشل التسليم مرتجع": "bg-red-600 text-white border-red-700",
  "تم الغاء الطلب": "bg-rose-200 text-rose-900 border-rose-300",
  "معلق / نقص معلومات": "bg-gray-200 text-gray-900 border-gray-300",
};

export const statusColors: Record<string, string> = {
  "طلب جديد": "bg-sky-200 text-sky-900 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
  "تم استلام الطلب": "bg-blue-200 text-blue-900 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  "تم ارسال الطلب": "bg-yellow-200 text-yellow-900 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  "تم تسليم الطلب": "bg-green-200 text-green-900 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  "فشل التسليم مرتجع": "bg-red-600 text-white border-red-700 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800",
  "تم الغاء الطلب": "bg-red-200 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  "معلق / نقص معلومات": "bg-gray-200 text-gray-900 border-gray-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
};

// قوائم البيانات
export const citiesByCountry: Record<string, string[]> = {
  "سوريا": ["دمشق", "ريف دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "إدلب", "درعا", "السويداء", "القنيطرة", "دير الزور", "الرقة", "الحسكة"],
  "لبنان": ["بيروت", "طرابلس", "صيدا", "صور", "زحلة", "بعلبك", "جونية", "جبيل", "البترون", "النبطية"],
  "العراق": ["بغداد", "البصرة", "الموصل", "أربيل", "النجف", "كربلاء", "كركوك", "السليمانية", "دهوك", "الرمادي", "الفلوجة", "سامراء", "الحلة", "الديوانية", "الناصرية", "الكوت", "العمارة"],
  "تركيا": ["إسطنبول", "أنقرة", "إزمير", "بورصة", "أنطاليا", "أضنة", "غازي عنتاب", "قونية", "مرسين", "قيصري", "أسكي شهير", "طرابزون", "سامسون", "ديار بكر", "شانلي أورفا", "فان"],
  "ليبيا": ["طرابلس", "بنغازي", "مصراتة", "الزاوية", "سبها", "سرت", "طبرق", "درنة", "زليتن", "أجدابيا", "البيضاء", "غريان", "الكفرة", "مرزق"],
};
