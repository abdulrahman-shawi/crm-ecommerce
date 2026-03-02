"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { getGeneralSettings, upsertGeneralSettings } from "@/server/general-settings";
import { Button } from "@/components/ui/button";

type FormState = {
  siteName: string;
  companyEmail: string;
  companyPhone: string;
  siteCurrency: string;
  usdToTryRate: string;
};

const initialForm: FormState = {
  siteName: "",
  companyEmail: "",
  companyPhone: "",
  siteCurrency: "USD",
  usdToTryRate: "0",
};

export default function GeneralSettingsPage() {
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

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
      });
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
      const res = await upsertGeneralSettings({
        siteName: form.siteName,
        companyEmail: form.companyEmail,
        companyPhone: form.companyPhone,
        siteCurrency: form.siteCurrency,
        usdToTryRate: Number(form.usdToTryRate || 0),
      });

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
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading || saving}>
          {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}
