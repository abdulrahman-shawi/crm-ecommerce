"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { getGeneralSettings, upsertGeneralSettings } from "@/server/general-settings";
import { Button } from "@/components/ui/button";
import { MultiFileUpload, FileItem } from "@/components/ui/ImageUpload";

type FormState = {
  siteName: string;
  companyEmail: string;
  companyPhone: string;
  siteCurrency: string;
  usdToTryRate: string;
  cashboxUsd: string;
  logo: string;
  facebookUrl: string;
  instagramUrl: string;
  topBannerText: string;
  primaryColor: string;
  secondaryColor: string;
};

const initialForm: FormState = {
  siteName: "",
  companyEmail: "",
  companyPhone: "",
  siteCurrency: "USD",
  usdToTryRate: "0",
  cashboxUsd: "0",
  logo: "",
  facebookUrl: "",
  instagramUrl: "",
  topBannerText: "",
  primaryColor: "#10b981",
  secondaryColor: "#0f766e",
};

const CURRENCIES = [
  { code: "USD", name: "الدولار الأمريكي" },
  { code: "EUR", name: "اليورو" },
  { code: "GBP", name: "الجنيه الإسترليني" },
  { code: "JPY", name: "الين الياباني" },
  { code: "CNY", name: "اليوان الصيني" },
  { code: "INR", name: "الروبية الهندية" },
  { code: "AUD", name: "الدولار الأسترالي" },
  { code: "CAD", name: "الدولار الكندي" },
  { code: "CHF", name: "الفرنك السويسري" },
  { code: "SEK", name: "الكرونة السويدية" },
  { code: "NZD", name: "الدولار النيوزيلندي" },
  { code: "SGD", name: "الدولار السنغافوري" },
  { code: "HKD", name: "الدولار الهونغ كونغي" },
  { code: "KRW", name: "الوون الكوري الجنوبي" },
  { code: "MXN", name: "البيزو المكسيكي" },
  { code: "BRL", name: "الريال البرازيلي" },
  { code: "RUB", name: "الروبل الروسي" },
  { code: "ZAR", name: "الراند الجنوب أفريقي" },
  { code: "AED", name: "الدرهم الإماراتي" },
  { code: "SAR", name: "الريال السعودي" },
  { code: "QAR", name: "الريال القطري" },
  { code: "KWD", name: "الدينار الكويتي" },
  { code: "BHD", name: "الدينار البحريني" },
  { code: "OMR", name: "الريال العماني" },
  { code: "JOD", name: "الدينار الأردني" },
  { code: "EGP", name: "الجنيه المصري" },
  { code: "LBP", name: "الليرة اللبنانية" },
  { code: "TRY", name: "الليرة التركية" },
  { code: "SYP", name: "الليرة السورية" },
  { code: "IQD", name: "الدينار العراقي" },
  { code: "TND", name: "الدينار التونسي" },
  { code: "MAD", name: "الدرهم المغربي" },
  { code: "DZD", name: "الدينار الجزائري" },
  { code: "LYD", name: "الدينار الليبي" },
  { code: "SDG", name: "الجنيه السوداني" },
  { code: "YER", name: "الريال اليمني" },
  { code: "AFN", name: "الأفغاني" },
  { code: "ALL", name: "الليك الألباني" },
  { code: "AMD", name: "الدرام الأرميني" },
  { code: "ANG", name: "الغيلدر الأنتيلي" },
  { code: "AOA", name: "الكوانزا الأنغولي" },
  { code: "ARS", name: "البيزو الأرجنتيني" },
  { code: "AWG", name: "الفلورن الأروبي" },
  { code: "AZN", name: "المانات الأذربيجاني" },
  { code: "BAM", name: "المارك البوسني" },
  { code: "BBD", name: "الدولار البربادوسي" },
  { code: "BDT", name: "التاكا البنغلاديشية" },
  { code: "BGN", name: "الليف البلغاري" },
  { code: "BIF", name: "الفرنك البوروندي" },
  { code: "BMD", name: "الدولار البرمودي" },
  { code: "BND", name: "الدولار البروني" },
  { code: "BOB", name: "البوليفيانو" },
  { code: "BSD", name: "الدولار البهامي" },
  { code: "BTN", name: "النولتوم البوتاني" },
  { code: "BWP", name: "البولا البوتسواني" },
  { code: "BYN", name: "الروبل البيلاروسي" },
  { code: "BZD", name: "الدولار البليزي" },
  { code: "CDF", name: "الفرنك الكونغولي" },
  { code: "CLP", name: "البيزو التشيلي" },
  { code: "COP", name: "البيزو الكولومبي" },
  { code: "CRC", name: "الكولون الكوستاريكي" },
  { code: "CUP", name: "البيزو الكوبي" },
  { code: "CVE", name: "الاسكودو الرأس الأخضري" },
  { code: "CZK", name: "الكورونا التشيكية" },
  { code: "DJF", name: "الفرنك الجيبوتي" },
  { code: "DKK", name: "الكرونة الدنماركية" },
  { code: "DOP", name: "البيزو الدومينيكاني" },
  { code: "ERN", name: "الناكفا الإريترية" },
  { code: "ETB", name: "البر الإثيوبي" },
  { code: "FJD", name: "الدولار الفيجي" },
  { code: "FKP", name: "الجنيه الفوكلاندي" },
  { code: "GEL", name: "اللاري الجورجي" },
  { code: "GHS", name: "السيدي الغاني" },
  { code: "GIP", name: "الجنيه الجبلطارى" },
  { code: "GMD", name: "الدالاسي الغامبي" },
  { code: "GNF", name: "الفرنك الغيني" },
  { code: "GTQ", name: "الكتزال الغواتيمالي" },
  { code: "GYD", name: "الدولار الغياني" },
  { code: "HNL", name: "اللمبيرا الهندوراسية" },
  { code: "HRK", name: "الكونا الكرواتية" },
  { code: "HTG", name: "الغورد الهايتي" },
  { code: "HUF", name: "الفورنت المجري" },
  { code: "IDR", name: "الروبية الإندونيسية" },
  { code: "ILS", name: "الشيكل الإسرائيلي" },
  { code: "IMP", name: "الجنيه الآيزلندي" },
  { code: "IRR", name: "الريال الإيراني" },
  { code: "ISK", name: "الكرونة الآيسلندية" },
  { code: "JMD", name: "الدولار الجامايكي" },
  { code: "KES", name: "الشيلينغ الكيني" },
  { code: "KGS", name: "السوم القيرغيزستاني" },
  { code: "KHR", name: "الرييل الكمبودي" },
  { code: "KID", name: "الدولار الكيريباتي" },
  { code: "KMF", name: "الفرنك القمري" },
  { code: "KYD", name: "الدولار الكايماني" },
  { code: "KZT", name: "التاينغ الكازاخستاني" },
  { code: "LAK", name: "الكيب اللاوي" },
  { code: "LKR", name: "الروبية السريلانكية" },
  { code: "LRD", name: "الدولار الليبيري" },
  { code: "LSL", name: "اللوتي الليسوتو" },
  { code: "MDL", name: "الليو المولدوفي" },
  { code: "MGA", name: "الأرياري المدغشقري" },
  { code: "MKD", name: "الدينار المقدوني" },
  { code: "MMK", name: "الكيات الميانماري" },
  { code: "MNT", name: "التوغريك المنغولي" },
  { code: "MOP", name: "الباتاكا المكاوية" },
  { code: "MRU", name: "الأوقية الموريتانية" },
  { code: "MUR", name: "الروبية الموريشيوسية" },
  { code: "MVR", name: "الروفيه المالديفية" },
  { code: "MWK", name: "الكواشا الملاوية" },
  { code: "MYR", name: "الرينغيت الماليزي" },
  { code: "MZN", name: "الميتيكال الموزمبيقي" },
  { code: "NAD", name: "الدولار الناميبي" },
  { code: "NGN", name: "النايرة النيجيرية" },
  { code: "NIO", name: "الكوردوبا النيكاراغوية" },
  { code: "NOK", name: "الكرونة النرويجية" },
  { code: "NPR", name: "الروبية النيبالية" },
  { code: "PAB", name: "البالبوا البانامي" },
  { code: "PEN", name: "السول البيروفي" },
  { code: "PGK", name: "الكينا البابوي" },
  { code: "PHP", name: "البيزو الفلبيني" },
  { code: "PKR", name: "الروبية الباكستانية" },
  { code: "PLN", name: "الزلوتي البولندي" },
  { code: "PYG", name: "الغواراني الباراغواياني" },
  { code: "RON", name: "الليو الروماني" },
  { code: "RSD", name: "الدينار الصربي" },
  { code: "RWF", name: "الفرنك الرواندي" },
  { code: "SBD", name: "الدولار الجزر السلمونية" },
  { code: "SCR", name: "الروبية السيشيلية" },
  { code: "SHP", name: "الجنيه سانت هيلينا" },
  { code: "SLE", name: "الليون السيراليوني" },
  { code: "SOS", name: "الشلن الصومالي" },
  { code: "SRD", name: "الدولار السورينامي" },
  { code: "SSP", name: "الجنيه الجنوب سوداني" },
  { code: "STN", name: "الدوبرا ساو تومي وبرينسيبي" },
  { code: "SZL", name: "الليلانغيني السوازيلندي" },
  { code: "THB", name: "الباخت التايلندي" },
  { code: "TJS", name: "السوموني الطاجيكستاني" },
  { code: "TMT", name: "المانات التركمانستاني" },
  { code: "TOP", name: "الباانغا التونغية" },
  { code: "TTD", name: "الدولار الترينيدادي" },
  { code: "TVD", name: "الدولار التوفالي" },
  { code: "TWD", name: "الدولار التايواني" },
  { code: "TZS", name: "الشلن التنزاني" },
  { code: "UAH", name: "الهريفنيا الأوكرانية" },
  { code: "UGX", name: "الشلن الأوغندي" },
  { code: "UYU", name: "البيزو الأوروغواياني" },
  { code: "UZS", name: "السوم الأوزبكستاني" },
  { code: "VES", name: "ال بوليفار" },
  { code: "VND", name: "الدونغ الفيتنامي" },
  { code: "VUV", name: "الفاتو الفانواتي" },
  { code: "WST", name: "التالا الساموي" },
  { code: "XAF", name: "الفرنك وسط أفريقيا" },
  { code: "XCD", name: "الدولار شرق الكاريبي" },
  { code: "XOF", name: "الفرنك غرب أفريقيا" },
  { code: "XPF", name: "الفرنك المحيط الهادئ" },
  { code: "ZMW", name: "الكواشا الزامبي" },
  { code: "ZWL", name: "الدولار الزيمبابوي" },
];

export default function GeneralSettingsPage() {
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [logoFiles, setLogoFiles] = React.useState<FileItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const res = await getGeneralSettings();

    if (!res.success) {
      toast.error("تعذر تحميل الإعدادات العامة");
      setLoading(false);
      return;
    }

    const data = res.data;
    if (data) {
      setForm({
        siteName: data.siteName || "",
        companyEmail: data.companyEmail || "",
        companyPhone: data.companyPhone || "",
        siteCurrency: data.siteCurrency || "USD",
        usdToTryRate: String(data.usdToTryRate ?? 0),
        cashboxUsd: String(data.cashboxUsd ?? 0),
        logo: data.logo || "",
        facebookUrl: data.facebookUrl || "",
        instagramUrl: data.instagramUrl || "",
        topBannerText: data.topBannerText || "",
        primaryColor: data.primaryColor || "#10b981",
        secondaryColor: data.secondaryColor || "#0f766e",
      });

      if (data.logo) {
        setLogoFiles([{ url: data.logo, type: "image/*", name: "site-logo" }]);
      }
    }

    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    const loadingToast = toast.loading("جاري حفظ الإعدادات...");

    try {
      const formData = new FormData();
      formData.append("siteName", form.siteName);
      formData.append("companyEmail", form.companyEmail);
      formData.append("companyPhone", form.companyPhone);
      formData.append("siteCurrency", form.siteCurrency);
      formData.append("usdToTryRate", form.usdToTryRate);
      formData.append("cashboxUsd", form.cashboxUsd);
      formData.append("facebookUrl", form.facebookUrl);
      formData.append("instagramUrl", form.instagramUrl);
      formData.append("topBannerText", form.topBannerText);
      formData.append("primaryColor", form.primaryColor);
      formData.append("secondaryColor", form.secondaryColor);

      const logoFile = logoFiles[0]?.rawFile;
      if (logoFile instanceof File && logoFile.size > 0) {
        formData.append("logo", logoFile);
      } else if (form.logo && !logoFiles.length) {
        // تم مسح اللوجو
      } else if (form.logo) {
        formData.append("logo", form.logo);
      }

      const res = await upsertGeneralSettings(formData);

      if (res.success) {
        toast.success("تم حفظ الإعدادات العامة بنجاح");
      } else {
        toast.error(res.error || "فشل في حفظ الإعدادات العامة");
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      toast.dismiss(loadingToast);
      setSaving(false);
    }
  };

  const downloadDataFile = (blob: Blob, filePrefix: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const fileName = `${filePrefix}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.json`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (filePrefix: string) => {
    setExporting(true);
    const loadingToast = toast.loading("جاري تصدير البيانات...");

    try {
      const response = await fetch("/api/settings/data-transfer", { method: "GET" });
      if (!response.ok) {
        throw new Error("فشل في تصدير البيانات");
      }

      const blob = await response.blob();
      downloadDataFile(blob, filePrefix);
      toast.success("تم تصدير البيانات بنجاح");
    } catch (error) {
      toast.error("تعذر تصدير البيانات");
    } finally {
      toast.dismiss(loadingToast);
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    const loadingToast = toast.loading("جاري استيراد البيانات...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("replace", "true");

      const response = await fetch("/api/settings/data-transfer", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "فشل في استيراد البيانات");
      }

      toast.success("تم استيراد البيانات بنجاح");
      await loadData();
    } catch (error) {
      toast.error("تعذر استيراد البيانات");
    } finally {
      toast.dismiss(loadingToast);
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">الإعدادات العامة</h1>
        <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">إعدادات أساسية للموقع والشركة</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">اسم الموقع</label>
          <input
            type="text"
            value={form.siteName}
            onChange={(e) => handleChange("siteName", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            placeholder="Skynova"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">إيميل الشركة</label>
          <input
            type="email"
            value={form.companyEmail}
            onChange={(e) => handleChange("companyEmail", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            placeholder="company@example.com"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">رقم هاتف الشركة</label>
          <input
            type="text"
            value={form.companyPhone}
            onChange={(e) => handleChange("companyPhone", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            placeholder="+963 946 975 244"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">عملة الموقع</label>
          <select
            value={form.siteCurrency}
            onChange={(e) => handleChange("siteCurrency", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            disabled={loading}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} - {currency.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">سعر صرف عملة الموقع بالدولار</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={form.usdToTryRate}
            onChange={(e) => handleChange("usdToTryRate", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            placeholder="0"
            disabled={loading}
          />
        </div>

        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-4">
            <h2 className="text-base font-black text-slate-900 dark:text-white">الصناديق</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">يتم خصم المصاريف اليومية تلقائيًا من صندوق الدولار.</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">صندوق الدولار</label>
              <input
                type="number"
                step="0.01"
                value={form.cashboxUsd}
                onChange={(e) => handleChange("cashboxUsd", e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                placeholder="0"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">نص البانر العلوي</label>
          <input
            type="text"
            value={form.topBannerText}
            onChange={(e) => handleChange("topBannerText", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            placeholder="مثال: شحن مجاني للطلبات فوق 100$"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">رابط فيسبوك</label>
          <input
            type="url"
            value={form.facebookUrl}
            onChange={(e) => handleChange("facebookUrl", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            placeholder="https://facebook.com/..."
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">رابط إنستغرام</label>
          <input
            type="url"
            value={form.instagramUrl}
            onChange={(e) => handleChange("instagramUrl", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            placeholder="https://instagram.com/..."
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">اللون الأساسي</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => handleChange("primaryColor", e.target.value)}
              className="h-10 w-14 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              disabled={loading}
            />
            <input
              type="text"
              value={form.primaryColor}
              onChange={(e) => handleChange("primaryColor", e.target.value)}
              className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              placeholder="#10b981"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">اللون الثانوي</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.secondaryColor}
              onChange={(e) => handleChange("secondaryColor", e.target.value)}
              className="h-10 w-14 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              disabled={loading}
            />
            <input
              type="text"
              value={form.secondaryColor}
              onChange={(e) => handleChange("secondaryColor", e.target.value)}
              className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              placeholder="#0f766e"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">لوجو الموقع</label>
          <MultiFileUpload
            label=""
            value={logoFiles}
            onChange={(files) => setLogoFiles(files.slice(0, 1))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading || saving}>
          {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">النسخ الاحتياطي والبيانات</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">يمكنك تصدير نسخة احتياطية كاملة أو استيراد ملف بيانات سابق.</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportFile}
        />

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => handleExport("backup")} disabled={exporting || importing || loading}>
            {exporting ? "جاري التصدير..." : "أخذ نسخة احتياطية"}
          </Button>
          <Button onClick={() => handleExport("export")} disabled={exporting || importing || loading}>
            {exporting ? "جاري التصدير..." : "تصدير البيانات"}
          </Button>
          <Button onClick={handleImportClick} disabled={exporting || importing || loading}>
            {importing ? "جاري الاستيراد..." : "استيراد البيانات"}
          </Button>
        </div>
      </div>
    </div>
  );
}
