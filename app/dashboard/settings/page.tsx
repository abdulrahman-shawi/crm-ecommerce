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
  logo: "",
  facebookUrl: "",
  instagramUrl: "",
  topBannerText: "",
  primaryColor: "#10b981",
  secondaryColor: "#0f766e",
};

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
            <option value="USD">USD</option>
            <option value="TRY">TRY</option>
            <option value="SYP">SYP</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">سعر صرف الدولار مقابل التركي</label>
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
