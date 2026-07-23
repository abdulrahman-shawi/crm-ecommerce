"use client";

import * as React from "react";
import toast from "react-hot-toast";
import {
  BarChart2,
  Eye,
  Megaphone,
  Pencil,
  Play,
  Plus,
  Rocket,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/lib/utils";
import { AppModal } from "@/components/ui/app-modal";
import { DataTable, TableAction } from "@/components/shared/DataTable";
import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  getCampaigns,
  launchCampaign,
  recordCampaignMetric,
  updateCampaign,
} from "@/server/marketing";

const CAMPAIGN_TYPES = [
  { value: "EMAIL", label: "بريد إلكتروني" },
  { value: "SOCIAL", label: "تواصل اجتماعي" },
  { value: "SMS", label: "رسائل نصية" },
  { value: "CONTENT", label: "محتوى" },
];

const CAMPAIGN_STATUSES = [
  { value: "DRAFT", label: "مسودة" },
  { value: "SCHEDULED", label: "مجدولة" },
  { value: "RUNNING", label: "قيد التنفيذ" },
  { value: "COMPLETED", label: "مكتملة" },
  { value: "CANCELLED", label: "ملغاة" },
];

const CAMPAIGN_AUDIENCES = [
  { value: "ALL_CUSTOMERS", label: "كل العملاء" },
  { value: "ALL_WHOLESALE", label: "عملاء الجملة" },
  { value: "CUSTOM", label: "قائمة مخصصة" },
];

const METRIC_KEYS = [
  { key: "sent", label: "إرسال" },
  { key: "opened", label: "فتح" },
  { key: "clicked", label: "نقر" },
  { key: "converted", label: "تحويل" },
] as const;

const PAGE_SIZE = 10;

type Campaign = {
  id: number;
  title: string;
  type: string;
  status: string;
  subject?: string | null;
  content: string;
  channelDetails?: any;
  audience: string;
  targetIds?: any;
  scheduledAt?: Date | string | null;
  sentAt?: Date | string | null;
  metrics?: any;
  createdById: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy?: { id: string; username: string } | null;
};

const emptyForm = () => ({
  title: "",
  type: "EMAIL",
  status: "DRAFT",
  subject: "",
  content: "",
  audience: "ALL_CUSTOMERS",
  targetIds: "",
  scheduledAt: "",
});

function formatDateTimeLocal(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const iso = date.toISOString();
  return iso.slice(0, 16);
}

function CampaignsPageContent() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [selectedCampaign, setSelectedCampaign] = React.useState<Campaign | null>(null);
  const [form, setForm] = React.useState(emptyForm());
  const [metricForm, setMetricForm] = React.useState<Record<string, number>>({
    sent: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const canView = React.useMemo(() => {
    if (!user) return false;
    return hasAnyPermission(user, ["viewMarketing", "addMarketing", "editMarketing", "deleteMarketing"]);
  }, [user]);

  const canAdd = React.useMemo(() => Boolean(user && hasPermission(user, "addMarketing")), [user]);
  const canEdit = React.useMemo(() => Boolean(user && hasPermission(user, "editMarketing")), [user]);
  const canDelete = React.useMemo(() => Boolean(user && hasPermission(user, "deleteMarketing")), [user]);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getCampaigns();
      if (!response.success) {
        toast.error(response.error || "تعذر تحميل الحملات");
      } else {
        setCampaigns(Array.isArray(response.data) ? response.data : []);
      }
    } catch {
      toast.error("حدث خطأ أثناء تحميل الحملات");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    loadData();
  }, [canView, loadData]);

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, statusFilter]);

  const filteredCampaigns = React.useMemo(() => {
    return campaigns.filter((campaign) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesText =
        !query ||
        String(campaign.title || "").toLowerCase().includes(query) ||
        String(campaign.subject || "").toLowerCase().includes(query) ||
        String(campaign.createdBy?.username || "").toLowerCase().includes(query);
      if (!matchesText) return false;
      if (typeFilter && campaign.type !== typeFilter) return false;
      if (statusFilter && campaign.status !== statusFilter) return false;
      return true;
    });
  }, [campaigns, searchQuery, typeFilter, statusFilter]);

  const totalCount = filteredCampaigns.length;
  const paginated = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCampaigns.slice(start, start + PAGE_SIZE);
  }, [filteredCampaigns, page]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = React.useCallback(async (id: number) => {
    const loading = toast.loading("جاري تحميل بيانات الحملة...");
    try {
      const response = await getCampaignById(id);
      if (!response.success || !response.data) {
        toast.error(response.error || "تعذر تحميل الحملة");
        return;
      }
      const data = response.data as Campaign;
      setEditingId(data.id);
      setForm({
        title: data.title || "",
        type: data.type || "EMAIL",
        status: data.status || "DRAFT",
        subject: data.subject || "",
        content: data.content || "",
        audience: data.audience || "ALL_CUSTOMERS",
        targetIds: Array.isArray(data.targetIds) ? data.targetIds.join(", ") : "",
        scheduledAt: formatDateTimeLocal(data.scheduledAt),
      });
      setIsFormOpen(true);
    } finally {
      toast.dismiss(loading);
    }
  }, []);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("يرجى إدخال عنوان الحملة");
      return;
    }
    if (!form.content.trim()) {
      toast.error("يرجى إدخال محتوى الحملة");
      return;
    }
    if (form.type === "EMAIL" && !form.subject.trim()) {
      toast.error("يرجى إدخال موضوع البريد الإلكتروني");
      return;
    }

    setIsSubmitting(true);
    const loading = toast.loading(editingId ? "جاري تحديث الحملة..." : "جاري إنشاء الحملة...");
    try {
      const payload = {
        ...form,
        targetIds: form.audience === "CUSTOM" ? form.targetIds : "",
      };
      const response = editingId
        ? await updateCampaign(editingId, payload)
        : await createCampaign(payload);
      if (!response.success) {
        toast.error(response.error || "فشل في حفظ الحملة");
        return;
      }
      toast.success(editingId ? "تم تحديث الحملة" : "تم إنشاء الحملة");
      setIsFormOpen(false);
      await loadData();
    } finally {
      setIsSubmitting(false);
      toast.dismiss(loading);
    }
  };

  const handleDelete = React.useCallback(async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الحملة؟")) return;
    const loading = toast.loading("جاري حذف الحملة...");
    try {
      const response = await deleteCampaign(id);
      if (!response.success) {
        toast.error(response.error || "فشل في حذف الحملة");
        return;
      }
      toast.success("تم حذف الحملة");
      await loadData();
    } finally {
      toast.dismiss(loading);
    }
  }, [loadData]);

  const handleLaunch = React.useCallback(async (id: number) => {
    const loading = toast.loading("جاري إطلاق الحملة...");
    try {
      const response = await launchCampaign(id);
      if (!response.success) {
        toast.error(response.error || "فشل في إطلاق الحملة");
        return;
      }
      toast.success("تم إطلاق الحملة بنجاح");
      await loadData();
    } finally {
      toast.dismiss(loading);
    }
  }, [loadData]);

  const openMetrics = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setMetricForm({ sent: 0, opened: 0, clicked: 0, converted: 0 });
    setIsMetricsOpen(true);
  };

  const handleRecordMetrics = async () => {
    if (!selectedCampaign) return;
    const loading = toast.loading("جاري تسجيل المقاييس...");
    try {
      const results = await Promise.all(
        Object.entries(metricForm).map(([key, value]) =>
          recordCampaignMetric(selectedCampaign.id, key as any, Number(value))
        )
      );
      if (results.some((r) => !r.success)) {
        toast.error("فشل في تسجيل بعض المقاييس");
        return;
      }
      toast.success("تم تسجيل المقاييس");
      setIsMetricsOpen(false);
      await loadData();
    } finally {
      toast.dismiss(loading);
    }
  };

  const typeLabel = (value: string) =>
    CAMPAIGN_TYPES.find((t) => t.value === value)?.label || value;

  const statusLabel = (value: string) =>
    CAMPAIGN_STATUSES.find((s) => s.value === value)?.label || value;

  const audienceLabel = (value: string) =>
    CAMPAIGN_AUDIENCES.find((a) => a.value === value)?.label || value;

  const statusColor = (value: string) => {
    switch (value) {
      case "DRAFT":
        return "bg-slate-100 text-slate-600";
      case "SCHEDULED":
        return "bg-amber-100 text-amber-700";
      case "RUNNING":
        return "bg-blue-100 text-blue-700";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-700";
      case "CANCELLED":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const columns = React.useMemo(
    () => [
      { header: "#", accessor: (campaign: Campaign) => campaign.id, className: "w-16" },
      { header: "العنوان", accessor: (campaign: Campaign) => <span className="font-bold">{campaign.title}</span> },
      { header: "القناة", accessor: (campaign: Campaign) => typeLabel(campaign.type) },
      {
        header: "الحالة",
        accessor: (campaign: Campaign) => (
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${statusColor(campaign.status)}`}>
            {statusLabel(campaign.status)}
          </span>
        ),
      },
      { header: "الجمهور", accessor: (campaign: Campaign) => audienceLabel(campaign.audience) },
      {
        header: "المقاييس",
        accessor: (campaign: Campaign) => {
          const metrics = campaign.metrics || { sent: 0, opened: 0, clicked: 0, converted: 0 };
          return (
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              إرسال: {metrics.sent} · فتح: {metrics.opened} · نقر: {metrics.clicked} · تحويل: {metrics.converted}
            </div>
          );
        },
      },
      {
        header: "الجدولة",
        accessor: (campaign: Campaign) =>
          campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString("ar-EG") : "-",
      },
      {
        header: "الإنشاء",
        accessor: (campaign: Campaign) => new Date(campaign.createdAt).toLocaleDateString("ar-EG"),
      },
    ],
    []
  );

  const actions = React.useMemo<TableAction<Campaign>[]>(() => {
    const list: TableAction<Campaign>[] = [
      {
        label: "مقاييس",
        icon: <BarChart2 size={16} />,
        onClick: (campaign) => openMetrics(campaign),
      },
    ];
    if (canEdit) {
      list.push(
        {
          label: "تعديل",
          icon: <Pencil size={16} />,
          onClick: (campaign) => void openEdit(campaign.id),
        },
        {
          label: "إطلاق",
          icon: <Rocket size={16} />,
          onClick: (campaign) => void handleLaunch(campaign.id),
        }
      );
    }
    if (canDelete) {
      list.push({
        label: "حذف",
        icon: <Trash2 size={16} />,
        variant: "danger",
        onClick: (campaign) => void handleDelete(campaign.id),
      });
    }
    return list;
  }, [canEdit, canDelete, openEdit, handleLaunch, handleDelete]);

  if (!canView) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-black text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
        لا تملك صلاحية الوصول إلى الحملات التسويقية
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">الحملات التسويقية</h1>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
            إدارة حملات البريد، التواصل، الرسائل، والمحتوى.
          </p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 dark:shadow-none"
          >
            <Plus size={18} />
            حملة جديدة
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="بحث بعنوان الحملة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">كل القنوات</option>
          {CAMPAIGN_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">كل الحالات</option>
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        data={paginated}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        currentPage={page}
        onPageChange={setPage}
      />

      <AppModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? "تعديل حملة" : "حملة تسويقية جديدة"}
        size="xl"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={16} />
              {editingId ? "حفظ التعديلات" : "إنشاء الحملة"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">عنوان الحملة</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="مثال: عرض شهر رمضان"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">القناة</span>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">الحالة</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {form.type === "EMAIL" && (
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300">موضوع البريد</span>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="موضوع الرسالة"
              />
            </label>
          )}

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">المحتوى</span>
            <textarea
              rows={5}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="نص أو وصف الحملة..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">الجمهور</span>
            <select
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {CAMPAIGN_AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">موعد الجدولة</span>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          {form.audience === "CUSTOM" && (
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300">معرّفات الجمهور المخصص (مفصولة بفاصلة)</span>
              <input
                type="text"
                value={form.targetIds}
                onChange={(e) => setForm((f) => ({ ...f, targetIds: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="1, 2, 3"
              />
            </label>
          )}
        </div>
      </AppModal>

      <AppModal
        isOpen={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
        title={`تسجيل مقاييس الحملة: ${selectedCampaign?.title || ""}`}
        size="md"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsMetricsOpen(false)}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => void handleRecordMetrics()}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-blue-700"
            >
              <BarChart2 size={16} />
              تسجيل
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {METRIC_KEYS.map(({ key, label }) => (
            <label key={key} className="space-y-2">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300">{label} (إضافة)</span>
              <input
                type="number"
                min={0}
                value={metricForm[key]}
                onChange={(e) =>
                  setMetricForm((m: Record<string, number>) => ({ ...m, [key]: Math.max(0, Number(e.target.value || 0)) }))
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          ))}
        </div>
      </AppModal>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-black text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          جاري تحميل الحملات التسويقية...
        </div>
      }
    >
      <CampaignsPageContent />
    </React.Suspense>
  );
}
