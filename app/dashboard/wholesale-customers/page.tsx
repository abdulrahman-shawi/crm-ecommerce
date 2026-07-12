"use client";

import * as React from "react";
import toast from "react-hot-toast";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Route,
  Trash2,
  UserRound,
  ClipboardList,
} from "lucide-react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { formatPhoneForDisplay, hasAnyPermission, isAdmin } from "@/lib/utils";
import {
  createWholesaleCustomer,
  createWholesaleVisit,
  deleteWholesaleCustomer,
  getWholesaleCustomers,
  getWholesaleSalesReps,
  updateWholesaleCustomer,
} from "@/server/wholesale-customer";

type SalesRep = {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  accountType: string;
};

type WholesaleVisit = {
  id: string;
  visitedAt: string | Date;
  result: string;
  status: string;
  notes: string | null;
  voiceNote: string | null;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  nextFollowUpAt: string | Date | null;
  followUpNotes: string | null;
  orderPlaced: boolean;
  syncedAt: string | Date | null;
  createdAt: string | Date;
  user: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
};

type WholesaleCustomer = {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  phone: string[];
  whatsappPhone: string | null;
  country: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  notes: string | null;
  preferredVisitAt: string | Date | null;
  lastVisitAt: string | Date | null;
  nextFollowUpAt: string | Date | null;
  lastVisitResult: string | null;
  visitStatus: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignedUserId: string | null;
  assignedUser: SalesRep | null;
  visits: WholesaleVisit[];
  _count: {
    visits: number;
  };
};

type CustomerFormState = {
  name: string;
  category: string;
  contactName: string;
  phoneText: string;
  whatsappPhone: string;
  country: string;
  city: string;
  area: string;
  address: string;
  latitude: string;
  longitude: string;
  googleMapsLink: string;
  assignedUserId: string;
  notes: string;
  preferredVisitAt: string;
  nextFollowUpAt: string;
  visitStatus: string;
  isActive: boolean;
};

type VisitFormState = {
  userId: string;
  visitedAt: string;
  result: string;
  status: string;
  notes: string;
  voiceNote: string;
  photoUrlsText: string;
  latitude: string;
  longitude: string;
  nextFollowUpAt: string;
  followUpNotes: string;
  orderPlaced: boolean;
};

const CATEGORY_OPTIONS = [
  { value: "PHARMACY", label: "صيدلية" },
  { value: "MARKET", label: "سوبر ماركت" },
  { value: "CLINIC", label: "عيادة" },
  { value: "DISTRIBUTOR", label: "موزع" },
  { value: "OTHER", label: "أخرى" },
];

const VISIT_RESULT_OPTIONS = [
  { value: "VERY_INTERESTED", label: "مهتم جداً" },
  { value: "INTERESTED", label: "مهتم" },
  { value: "THINKING", label: "يفكر" },
  { value: "NOT_INTERESTED", label: "غير مهتم" },
  { value: "PURCHASED", label: "تم الشراء" },
];

const VISIT_STATUS_OPTIONS = [
  { value: "PLANNED", label: "مخطط لها" },
  { value: "VISITED", label: "تمت الزيارة" },
  { value: "FOLLOW_UP_REQUIRED", label: "تحتاج متابعة" },
  { value: "CLOSED", label: "مغلقة" },
];

function createEmptyCustomerForm(): CustomerFormState {
  return {
    name: "",
    category: "PHARMACY",
    contactName: "",
    phoneText: "",
    whatsappPhone: "",
    country: "",
    city: "",
    area: "",
    address: "",
    latitude: "",
    longitude: "",
    googleMapsLink: "",
    assignedUserId: "",
    notes: "",
    preferredVisitAt: "",
    nextFollowUpAt: "",
    visitStatus: "PLANNED",
    isActive: true,
  };
}

function createEmptyVisitForm(): VisitFormState {
  return {
    userId: "",
    visitedAt: toDateTimeLocalValue(new Date()),
    result: "INTERESTED",
    status: "VISITED",
    notes: "",
    voiceNote: "",
    photoUrlsText: "",
    latitude: "",
    longitude: "",
    nextFollowUpAt: "",
    followUpNotes: "",
    orderPlaced: false,
  };
}

function toDateTimeLocalValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateLabel(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseTextList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCategoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getVisitResultLabel(value: string | null | undefined) {
  if (!value) return "-";
  return VISIT_RESULT_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getVisitStatusLabel(value: string) {
  return VISIT_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getVisibleCustomers(customers: WholesaleCustomer[], userId?: string, admin?: boolean) {
  if (admin || !userId) return customers;
  return customers.filter((customer) => {
    if (customer.assignedUserId === userId) return true;
    return customer.visits.some((visit) => visit.user?.id === userId);
  });
}

export default function WholesaleCustomersPage() {
  const { user, loading } = useAuth();
  const [customers, setCustomers] = React.useState<WholesaleCustomer[]>([]);
  const [salesReps, setSalesReps] = React.useState<SalesRep[]>([]);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = React.useState("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState("ALL");
  const [selectedRepId, setSelectedRepId] = React.useState("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = React.useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = React.useState(false);
  const [editingCustomerId, setEditingCustomerId] = React.useState<string | null>(null);
  const [customerForm, setCustomerForm] = React.useState<CustomerFormState>(createEmptyCustomerForm());
  const [visitForm, setVisitForm] = React.useState<VisitFormState>(createEmptyVisitForm());
  const [isPending, startTransition] = React.useTransition();
  const [isLoading, setIsLoading] = React.useState(true);

  const canManageWholesale = React.useMemo(() => {
    if (!user) return false;
    return hasAnyPermission(user, ["viewCustomers", "addCustomers", "editCustomers", "deleteCustomers"]);
  }, [user]);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    const [customersResponse, repsResponse] = await Promise.all([
      getWholesaleCustomers(),
      getWholesaleSalesReps(),
    ]);

    if (!customersResponse.success) {
      toast.error(customersResponse.error || "تعذر تحميل عملاء الجملة");
    } else {
      setCustomers((customersResponse.data as WholesaleCustomer[]) || []);
    }

    if (!repsResponse.success) {
      toast.error(repsResponse.error || "تعذر تحميل المندوبين");
    } else {
      setSalesReps((repsResponse.data as SalesRep[]) || []);
    }

    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (!canManageWholesale) {
      setIsLoading(false);
      return;
    }
    void loadData();
  }, [canManageWholesale, loadData, loading]);

  const visibleCustomers = React.useMemo(() => {
    const scoped = getVisibleCustomers(customers, user?.id, isAdmin(user));
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return scoped.filter((customer) => {
      const matchesSearch = !normalizedSearch
        ? true
        : [
            customer.name,
            customer.contactName,
            customer.city,
            customer.area,
            customer.country,
            customer.address,
            customer.assignedUser?.username,
            ...customer.phone,
          ]
            .filter(Boolean)
            .some((item) => String(item).toLowerCase().includes(normalizedSearch));

      const matchesCategory = selectedCategory === "ALL" || customer.category === selectedCategory;
      const matchesStatus = selectedStatus === "ALL" || customer.visitStatus === selectedStatus;
      const matchesRep = selectedRepId === "ALL" || customer.assignedUserId === selectedRepId;

      return matchesSearch && matchesCategory && matchesStatus && matchesRep;
    });
  }, [customers, deferredSearch, selectedCategory, selectedRepId, selectedStatus, user]);

  const selectedCustomer = React.useMemo(() => {
    return visibleCustomers.find((customer) => customer.id === selectedCustomerId) ?? visibleCustomers[0] ?? null;
  }, [selectedCustomerId, visibleCustomers]);

  React.useEffect(() => {
    if (!selectedCustomer && visibleCustomers.length === 0) {
      setSelectedCustomerId(null);
      return;
    }
    if (!selectedCustomer && visibleCustomers.length > 0) {
      setSelectedCustomerId(visibleCustomers[0].id);
    }
  }, [selectedCustomer, visibleCustomers]);

  const stats = React.useMemo(() => {
    const total = visibleCustomers.length;
    const dueFollowUp = visibleCustomers.filter((customer) => {
      if (!customer.nextFollowUpAt) return false;
      return new Date(customer.nextFollowUpAt).getTime() <= Date.now();
    }).length;
    const purchased = visibleCustomers.filter((customer) => customer.lastVisitResult === "PURCHASED").length;
    const activeRoutes = new Set(
      visibleCustomers
        .map((customer) => `${customer.city || ""}-${customer.area || ""}`)
        .filter((value) => value !== "-")
    ).size;

    return { total, dueFollowUp, purchased, activeRoutes };
  }, [visibleCustomers]);

  function openCreateCustomerModal() {
    setEditingCustomerId(null);
    setCustomerForm(createEmptyCustomerForm());
    setIsCustomerModalOpen(true);
  }

  function openEditCustomerModal(customer: WholesaleCustomer) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      name: customer.name,
      category: customer.category,
      contactName: customer.contactName || "",
      phoneText: customer.phone.join("\n"),
      whatsappPhone: customer.whatsappPhone || "",
      country: customer.country || "",
      city: customer.city || "",
      area: customer.area || "",
      address: customer.address || "",
      latitude: customer.latitude?.toString() || "",
      longitude: customer.longitude?.toString() || "",
      googleMapsLink: customer.googleMapsLink || "",
      assignedUserId: customer.assignedUserId || "",
      notes: customer.notes || "",
      preferredVisitAt: toDateTimeLocalValue(customer.preferredVisitAt),
      nextFollowUpAt: toDateTimeLocalValue(customer.nextFollowUpAt),
      visitStatus: customer.visitStatus,
      isActive: customer.isActive,
    });
    setIsCustomerModalOpen(true);
  }

  function openVisitModal(customer: WholesaleCustomer) {
    setSelectedCustomerId(customer.id);
    setVisitForm({
      ...createEmptyVisitForm(),
      userId: customer.assignedUserId || user?.id || "",
      nextFollowUpAt: toDateTimeLocalValue(customer.nextFollowUpAt),
    });
    setIsVisitModalOpen(true);
  }

  function resetFilters() {
    setSearch("");
    setSelectedCategory("ALL");
    setSelectedStatus("ALL");
    setSelectedRepId("ALL");
  }

  function handleSaveCustomer() {
    if (!customerForm.name.trim()) {
      toast.error("اسم عميل الجملة مطلوب");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: customerForm.name,
        category: customerForm.category,
        contactName: customerForm.contactName,
        phone: parseTextList(customerForm.phoneText),
        whatsappPhone: customerForm.whatsappPhone,
        country: customerForm.country,
        city: customerForm.city,
        area: customerForm.area,
        address: customerForm.address,
        latitude: parseOptionalNumber(customerForm.latitude),
        longitude: parseOptionalNumber(customerForm.longitude),
        googleMapsLink: customerForm.googleMapsLink,
        assignedUserId: customerForm.assignedUserId,
        notes: customerForm.notes,
        preferredVisitAt: customerForm.preferredVisitAt,
        nextFollowUpAt: customerForm.nextFollowUpAt,
        visitStatus: customerForm.visitStatus,
        isActive: customerForm.isActive,
      };

      const response = editingCustomerId
        ? await updateWholesaleCustomer(editingCustomerId, payload)
        : await createWholesaleCustomer(payload);

      if (!response.success) {
        toast.error(response.error || "تعذر حفظ عميل الجملة");
        return;
      }

      toast.success(editingCustomerId ? "تم تعديل عميل الجملة" : "تمت إضافة عميل الجملة");
      setIsCustomerModalOpen(false);
      await loadData();
      const createdId = (response.data as WholesaleCustomer | undefined)?.id;
      if (createdId) {
        setSelectedCustomerId(createdId);
      }
    });
  }

  function handleSaveVisit() {
    if (!selectedCustomerId) {
      toast.error("اختر العميل أولاً");
      return;
    }

    startTransition(async () => {
      const response = await createWholesaleVisit({
        wholesaleCustomerId: selectedCustomerId,
        userId: visitForm.userId || undefined,
        visitedAt: visitForm.visitedAt,
        result: visitForm.result,
        status: visitForm.status,
        notes: visitForm.notes,
        voiceNote: visitForm.voiceNote,
        photoUrls: parseTextList(visitForm.photoUrlsText),
        latitude: parseOptionalNumber(visitForm.latitude),
        longitude: parseOptionalNumber(visitForm.longitude),
        nextFollowUpAt: visitForm.nextFollowUpAt,
        followUpNotes: visitForm.followUpNotes,
        orderPlaced: visitForm.orderPlaced,
      });

      if (!response.success) {
        toast.error(response.error || "تعذر تسجيل الزيارة");
        return;
      }

      toast.success("تم تسجيل الزيارة بنجاح");
      setIsVisitModalOpen(false);
      await loadData();
    });
  }

  function handleDeleteCustomer(customer: WholesaleCustomer) {
    const confirmed = window.confirm(`هل تريد حذف عميل الجملة ${customer.name}؟`);
    if (!confirmed) return;

    startTransition(async () => {
      const response = await deleteWholesaleCustomer(customer.id);
      if (!response.success) {
        toast.error(response.error || "تعذر حذف عميل الجملة");
        return;
      }

      toast.success("تم حذف عميل الجملة");
      if (selectedCustomerId === customer.id) {
        setSelectedCustomerId(null);
      }
      await loadData();
    });
  }

  if (loading || isLoading) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          جاري تحميل صفحة عملاء الجملة...
        </div>
      </div>
    );
  }

  if (!canManageWholesale) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
          لا تملك صلاحية الوصول إلى صفحة عملاء الجملة.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8" dir="rtl">
      <section className="rounded-[32px] border border-slate-200 bg-gradient-to-l from-teal-600 via-cyan-600 to-blue-700 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-bold backdrop-blur">
              <Building2 className="h-4 w-4" />
              إدارة عملاء الجملة
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-4xl">متابعة المندوبين وزيارات العملاء في شاشة واحدة</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/85 md:text-base">
                أضف عميل الجملة، اسنده إلى مندوب، سجّل نتائج الزيارة، وحدد المتابعة القادمة وفق آلية العمل الظاهرة في المخطط.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="md" onClick={() => selectedCustomer && openVisitModal(selectedCustomer)} leftIcon={<ClipboardList className="h-4 w-4" />} disabled={!selectedCustomer}>
              تسجيل زيارة
            </Button>
            <Button variant="primary" size="md" onClick={openCreateCustomerModal} leftIcon={<Plus className="h-4 w-4" />} className="bg-white text-blue-700 hover:bg-blue-50">
              إضافة عميل جملة
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي العملاء" value={stats.total} icon={<Building2 className="h-5 w-5" />} tone="blue" />
        <StatCard title="متابعات مستحقة" value={stats.dueFollowUp} icon={<CalendarClock className="h-5 w-5" />} tone="amber" />
        <StatCard title="تم الشراء" value={stats.purchased} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard title="مناطق نشطة" value={stats.activeRoutes} icon={<Route className="h-5 w-5" />} tone="fuchsia" />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[2fr,1fr,1fr,1fr,auto]">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">بحث</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو المدينة أو المندوب أو رقم الهاتف"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">نوع العميل</label>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            >
              <option value="ALL">الكل</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">حالة المتابعة</label>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            >
              <option value="ALL">الكل</option>
              {VISIT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">المندوب</label>
            <select
              value={selectedRepId}
              onChange={(event) => setSelectedRepId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            >
              <option value="ALL">الكل</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>{rep.username}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" size="md" onClick={resetFilters} className="w-full lg:w-auto">
              إعادة الضبط
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">قائمة عملاء الجملة</h2>
              <p className="text-sm text-slate-500">{visibleCustomers.length} عميل ظاهر حسب الفلاتر والصلاحيات</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">العميل</th>
                  <th className="px-4 py-3 font-bold">المنطقة</th>
                  <th className="px-4 py-3 font-bold">المندوب</th>
                  <th className="px-4 py-3 font-bold">آخر نتيجة</th>
                  <th className="px-4 py-3 font-bold">المتابعة</th>
                  <th className="px-4 py-3 font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((customer) => {
                  const isSelected = selectedCustomer?.id === customer.id;
                  return (
                    <tr
                      key={customer.id}
                      className={isSelected ? "bg-blue-50/70" : "border-t border-slate-100"}
                    >
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => setSelectedCustomerId(customer.id)} className="text-right">
                          <div className="font-bold text-slate-900">{customer.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{getCategoryLabel(customer.category)}</div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            {customer.phone.slice(0, 2).map((phone) => (
                              <span key={phone} className="rounded-full bg-slate-100 px-2 py-1">
                                {formatPhoneForDisplay(phone)}
                              </span>
                            ))}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div>{customer.city || "-"}</div>
                        <div className="text-xs text-slate-400">{customer.area || "-"}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{customer.assignedUser?.username || "غير مسند"}</td>
                      <td className="px-4 py-4 text-slate-600">{getVisitResultLabel(customer.lastVisitResult)}</td>
                      <td className="px-4 py-4">
                        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {getVisitStatusLabel(customer.visitStatus)}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{formatDateLabel(customer.nextFollowUpAt)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditCustomerModal(customer)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                            تعديل
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => openVisitModal(customer)} leftIcon={<Plus className="h-3.5 w-3.5" />}>
                            زيارة
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteCustomer(customer)} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {visibleCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      لا توجد بيانات مطابقة حالياً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          {selectedCustomer ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedCustomer.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{getCategoryLabel(selectedCustomer.category)}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {getVisitStatusLabel(selectedCustomer.visitStatus)}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard icon={<UserRound className="h-4 w-4" />} label="المندوب" value={selectedCustomer.assignedUser?.username || "غير مسند"} />
                <InfoCard icon={<Phone className="h-4 w-4" />} label="هاتف" value={selectedCustomer.phone.map(formatPhoneForDisplay).join(" - ") || "-"} />
                <InfoCard icon={<MapPin className="h-4 w-4" />} label="المنطقة" value={[selectedCustomer.city, selectedCustomer.area].filter(Boolean).join(" - ") || "-"} />
                <InfoCard icon={<CalendarClock className="h-4 w-4" />} label="المتابعة القادمة" value={formatDateLabel(selectedCustomer.nextFollowUpAt)} />
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="mb-2 text-sm font-bold text-slate-700">ملاحظات العميل</div>
                <p className="text-sm leading-7 text-slate-600">{selectedCustomer.notes || "لا توجد ملاحظات مسجلة"}</p>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900">سجل الزيارات</h3>
                <Button variant="outline" size="sm" onClick={() => openVisitModal(selectedCustomer)} leftIcon={<Plus className="h-3.5 w-3.5" />}>
                  إضافة زيارة
                </Button>
              </div>

              <div className="space-y-3">
                {selectedCustomer.visits.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    لا توجد زيارات مسجلة لهذا العميل بعد.
                  </div>
                )}

                {selectedCustomer.visits.map((visit) => (
                  <div key={visit.id} className="rounded-3xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">{getVisitResultLabel(visit.result)}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateLabel(visit.visitedAt)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">{getVisitStatusLabel(visit.status)}</span>
                        {visit.orderPlaced && <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">تم الشراء</span>}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <div>المندوب: {visit.user?.username || "غير محدد"}</div>
                      <div>المتابعة التالية: {formatDateLabel(visit.nextFollowUpAt)}</div>
                      <div>الملاحظات: {visit.notes || "-"}</div>
                      <div>ملاحظات المتابعة: {visit.followUpNotes || "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center text-center text-slate-500">
              اختر عميل جملة من القائمة لعرض التفاصيل.
            </div>
          )}
        </div>
      </section>

      <AppModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title={editingCustomerId ? "تعديل عميل جملة" : "إضافة عميل جملة"}
        description="أدخل بيانات الجهة المستهدفة والمندوب المسؤول عنها."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCustomerModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveCustomer} isLoading={isPending}>حفظ البيانات</Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم العميل">
            <input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} className="field-input" />
          </Field>
          <Field label="نوع العميل">
            <select value={customerForm.category} onChange={(event) => setCustomerForm((current) => ({ ...current, category: event.target.value }))} className="field-input">
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="اسم جهة التواصل">
            <input value={customerForm.contactName} onChange={(event) => setCustomerForm((current) => ({ ...current, contactName: event.target.value }))} className="field-input" />
          </Field>
          <Field label="المندوب المسؤول">
            <select value={customerForm.assignedUserId} onChange={(event) => setCustomerForm((current) => ({ ...current, assignedUserId: event.target.value }))} className="field-input">
              <option value="">غير مسند</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>{rep.username}</option>
              ))}
            </select>
          </Field>
          <Field label="أرقام الهاتف">
            <textarea value={customerForm.phoneText} onChange={(event) => setCustomerForm((current) => ({ ...current, phoneText: event.target.value }))} className="field-input min-h-[110px]" placeholder="كل رقم في سطر أو افصل بينها بفاصلة" />
          </Field>
          <Field label="واتساب">
            <input value={customerForm.whatsappPhone} onChange={(event) => setCustomerForm((current) => ({ ...current, whatsappPhone: event.target.value }))} className="field-input" />
          </Field>
          <Field label="الدولة">
            <input value={customerForm.country} onChange={(event) => setCustomerForm((current) => ({ ...current, country: event.target.value }))} className="field-input" />
          </Field>
          <Field label="المدينة">
            <input value={customerForm.city} onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))} className="field-input" />
          </Field>
          <Field label="المنطقة">
            <input value={customerForm.area} onChange={(event) => setCustomerForm((current) => ({ ...current, area: event.target.value }))} className="field-input" />
          </Field>
          <Field label="رابط خرائط Google">
            <input value={customerForm.googleMapsLink} onChange={(event) => setCustomerForm((current) => ({ ...current, googleMapsLink: event.target.value }))} className="field-input" />
          </Field>
          <Field label="خط العرض">
            <input value={customerForm.latitude} onChange={(event) => setCustomerForm((current) => ({ ...current, latitude: event.target.value }))} className="field-input" />
          </Field>
          <Field label="خط الطول">
            <input value={customerForm.longitude} onChange={(event) => setCustomerForm((current) => ({ ...current, longitude: event.target.value }))} className="field-input" />
          </Field>
          <Field label="الزيارة المفضلة">
            <input type="datetime-local" value={customerForm.preferredVisitAt} onChange={(event) => setCustomerForm((current) => ({ ...current, preferredVisitAt: event.target.value }))} className="field-input" />
          </Field>
          <Field label="المتابعة القادمة">
            <input type="datetime-local" value={customerForm.nextFollowUpAt} onChange={(event) => setCustomerForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} className="field-input" />
          </Field>
          <Field label="حالة العميل">
            <select value={customerForm.visitStatus} onChange={(event) => setCustomerForm((current) => ({ ...current, visitStatus: event.target.value }))} className="field-input">
              {VISIT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="الحالة">
            <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
              <input type="checkbox" checked={customerForm.isActive} onChange={(event) => setCustomerForm((current) => ({ ...current, isActive: event.target.checked }))} />
              نشط وقابل للمتابعة
            </label>
          </Field>
          <div className="md:col-span-2">
            <Field label="العنوان">
              <textarea value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} className="field-input min-h-[88px]" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="ملاحظات عامة">
              <textarea value={customerForm.notes} onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))} className="field-input min-h-[110px]" />
            </Field>
          </div>
        </div>
      </AppModal>

      <AppModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        title="تسجيل زيارة ميدانية"
        description={selectedCustomer ? `العميل: ${selectedCustomer.name}` : "سجل نتائج الزيارة والمتابعة القادمة"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsVisitModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveVisit} isLoading={isPending}>حفظ الزيارة</Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="المندوب">
            <select value={visitForm.userId} onChange={(event) => setVisitForm((current) => ({ ...current, userId: event.target.value }))} className="field-input">
              <option value="">غير محدد</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>{rep.username}</option>
              ))}
            </select>
          </Field>
          <Field label="تاريخ الزيارة">
            <input type="datetime-local" value={visitForm.visitedAt} onChange={(event) => setVisitForm((current) => ({ ...current, visitedAt: event.target.value }))} className="field-input" />
          </Field>
          <Field label="نتيجة الزيارة">
            <select value={visitForm.result} onChange={(event) => setVisitForm((current) => ({ ...current, result: event.target.value }))} className="field-input">
              {VISIT_RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="الحالة بعد الزيارة">
            <select value={visitForm.status} onChange={(event) => setVisitForm((current) => ({ ...current, status: event.target.value }))} className="field-input">
              {VISIT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="موعد المتابعة القادم">
            <input type="datetime-local" value={visitForm.nextFollowUpAt} onChange={(event) => setVisitForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} className="field-input" />
          </Field>
          <Field label="تم الشراء؟">
            <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
              <input type="checkbox" checked={visitForm.orderPlaced} onChange={(event) => setVisitForm((current) => ({ ...current, orderPlaced: event.target.checked }))} />
              نعم، تم الشراء بعد الزيارة
            </label>
          </Field>
          <div className="md:col-span-2">
            <Field label="ملاحظات الزيارة">
              <textarea value={visitForm.notes} onChange={(event) => setVisitForm((current) => ({ ...current, notes: event.target.value }))} className="field-input min-h-[100px]" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="ملاحظات المتابعة">
              <textarea value={visitForm.followUpNotes} onChange={(event) => setVisitForm((current) => ({ ...current, followUpNotes: event.target.value }))} className="field-input min-h-[100px]" />
            </Field>
          </div>
          <Field label="رابط الملاحظة الصوتية">
            <input value={visitForm.voiceNote} onChange={(event) => setVisitForm((current) => ({ ...current, voiceNote: event.target.value }))} className="field-input" />
          </Field>
          <Field label="روابط الصور">
            <textarea value={visitForm.photoUrlsText} onChange={(event) => setVisitForm((current) => ({ ...current, photoUrlsText: event.target.value }))} className="field-input min-h-[100px]" placeholder="كل رابط في سطر أو افصل بينها بفاصلة" />
          </Field>
          <Field label="خط العرض">
            <input value={visitForm.latitude} onChange={(event) => setVisitForm((current) => ({ ...current, latitude: event.target.value }))} className="field-input" />
          </Field>
          <Field label="خط الطول">
            <input value={visitForm.longitude} onChange={(event) => setVisitForm((current) => ({ ...current, longitude: event.target.value }))} className="field-input" />
          </Field>
        </div>
      </AppModal>

      <style jsx>{`
        .field-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.2s ease;
        }

        .field-input:focus {
          border-color: rgb(59 130 246);
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-bold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "emerald" | "fuchsia";
}) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 text-blue-700",
    amber: "from-amber-50 to-orange-50 text-amber-700",
    emerald: "from-emerald-50 to-green-50 text-emerald-700",
    fuchsia: "from-fuchsia-50 to-pink-50 text-fuchsia-700",
  };

  return (
    <div className={`rounded-[28px] border border-slate-200 bg-gradient-to-br ${tones[tone]} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-500">{title}</div>
          <div className="mt-3 text-3xl font-black text-slate-900">{value}</div>
        </div>
        <div className="rounded-2xl bg-white/80 p-3 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
