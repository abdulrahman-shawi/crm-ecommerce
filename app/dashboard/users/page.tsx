'use client';

import { DynamicForm } from '@/components/shared/dynamic-form';
import { FormInput } from '@/components/ui/form-input';
import { useAuth } from '@/context/AuthContext';
import * as React from 'react';
import z from 'zod';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { assignManagerToEmployees, createUserTarget, deleteuser, getUserActivityTargetProgress, setUserActivityTarget, unassignManagerFromEmployees, updateUserTarget, updateUserCommission, updateUserWage, updateuser } from '@/server/user'; // تأكد من وجود updateuser
import { setAffiliateUserApproval } from '@/server/affiliate';
import { GetUserTargetProgress } from '@/server/analytics';
import { getEmployeeSalaryAdjustments } from '@/server/employee-salaries';
import { Button } from '@/components/ui/button';
import { AppModal } from '@/components/ui/app-modal';
import { Coins, Download, Mail, Plus } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { hasPermission } from '@/lib/utils';
import { getProduct } from '@/server/product';
import PhoneInput from 'react-phone-number-input';
import { Controller } from 'react-hook-form';

const userSchema = z.object({
  username: z.string().min(3, "اسم المستخدم مطلوب"),
  email: z.string().email("بريد غير صالح"),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  password: z.string().min(6, "كلمة المرور ضعيفة").optional().or(z.literal('')), // اختيارية عند التعديل
  jobTitle: z.string().min(2, "المسمى الوظيفي مطلوب"),
  accountType: z.enum(["ADMIN", "MANAGER", "STAFF"]),
  isAffiliate: z.boolean().optional().default(false),
  permissions: z.string().min(1, "يرجى اختيار صلاحية"),
  salesCommissionPercent: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/[٫,]/g, ".") : value),
    z.coerce.number().min(0).optional()
  ),
  wage: z.coerce.number().int().min(0).optional(),
});

const parseNumberList = (value: string) =>
  value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

const formatNumberList = (values?: number[] | null) =>
  Array.isArray(values) && values.length > 0 ? values.join(', ') : '';

const ACTIVITY_WEEKDAY_OPTIONS = [
  { value: "SATURDAY", label: "السبت" },
  { value: "SUNDAY", label: "الأحد" },
  { value: "MONDAY", label: "الإثنين" },
  { value: "TUESDAY", label: "الثلاثاء" },
  { value: "WEDNESDAY", label: "الأربعاء" },
  { value: "THURSDAY", label: "الخميس" },
  { value: "FRIDAY", label: "الجمعة" },
] as const;

const DEFAULT_ACTIVITY_WEEK_DAYS = ACTIVITY_WEEKDAY_OPTIONS.map((item) => item.value);

type ActivityWeekDay = (typeof ACTIVITY_WEEKDAY_OPTIONS)[number]["value"];

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const formatMoney = (value: number | undefined | null) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const getLatestTarget = (targets: any[] | undefined | null) => {
  if (!Array.isArray(targets) || targets.length === 0) return null;

  const sorted = [...targets].sort((a: any, b: any) => {
    const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return sorted.find((item: any) => item?.isActive !== false) || sorted[0];
};

const UserManagement: React.FunctionComponent = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [roles, setRoles] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [formData, setFormData] = React.useState<any>(null);
  const [commissionValues, setCommissionValues] = React.useState<Record<string, string>>({});
  const [commissionSaving, setCommissionSaving] = React.useState<Record<string, boolean>>({});
  const [wageValues, setWageValues] = React.useState<Record<string, string>>({});
  const [wageSaving, setWageSaving] = React.useState<Record<string, boolean>>({});
  const [affiliateApprovalSaving, setAffiliateApprovalSaving] = React.useState<Record<string, boolean>>({});
  const [products, setProducts] = React.useState<any[]>([]);
  const [isSalesTargetOpen, setIsSalesTargetOpen] = React.useState(false);
  const [isActivityTargetOpen, setIsActivityTargetOpen] = React.useState(false);
  const [targetMode, setTargetMode] = React.useState<"assign" | "edit">("assign");
  const [targetUser, setTargetUser] = React.useState<any>(null);
  const [editTargetId, setEditTargetId] = React.useState<string | null>(null);
  const [isAssignManagerOpen, setIsAssignManagerOpen] = React.useState(false);
  const [assignManagerId, setAssignManagerId] = React.useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([]);
  const [assignSaving, setAssignSaving] = React.useState(false);
  const [salesTargetValue, setSalesTargetValue] = React.useState<string>('');
  const [salesRewardValue, setSalesRewardValue] = React.useState<string>('');
  const [salesTargetStartDate, setSalesTargetStartDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [targetItems, setTargetItems] = React.useState<Array<{
    productId: string;
    requiredQty: number;
    rewardValue: number;
  }>>([{ productId: "", requiredQty: 1, rewardValue: 0 }]);
  const [activityCycle, setActivityCycle] = React.useState<"DAILY" | "MONTHLY">("DAILY");
  const [requiredCustomersTarget, setRequiredCustomersTarget] = React.useState<string>("0");
  const [customerRewardTarget, setCustomerRewardTarget] = React.useState<string>("0");
  const [customerMissPenaltyAmountTarget, setCustomerMissPenaltyAmountTarget] = React.useState<string>("0");
  const [requiredCommunicationsTarget, setRequiredCommunicationsTarget] = React.useState<string>("0");
  const [communicationRewardTarget, setCommunicationRewardTarget] = React.useState<string>("0");
  const [communicationMissPenaltyAmountTarget, setCommunicationMissPenaltyAmountTarget] = React.useState<string>("0");
  const [activityTargetStartDate, setActivityTargetStartDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [activityWeekDays, setActivityWeekDays] = React.useState<ActivityWeekDay[]>(DEFAULT_ACTIVITY_WEEK_DAYS);
  const [activityProgressByUser, setActivityProgressByUser] = React.useState<Record<string, any>>({});
  const [isFinancialReportOpen, setIsFinancialReportOpen] = React.useState(false);
  const [financialReportUser, setFinancialReportUser] = React.useState<any>(null);
  const [financialReportMonth, setFinancialReportMonth] = React.useState<string>(getCurrentMonthKey);
  const [financialReportLoading, setFinancialReportLoading] = React.useState(false);
  const [isFinancialReportPdfExporting, setIsFinancialReportPdfExporting] = React.useState(false);
  const [financialReportData, setFinancialReportData] = React.useState<{
    employeeNotes: string | null;
    fixedSalary: number;
    assignedCommissionPercent: number;
    totalCommissionAmount: number;
    totalSalesRewardAmount: number;
    totalProductRewardAmount: number;
    totalSalesAmount: number;
    totalShippingAmount: number;
    netSalesForCommission: number;
    totalOrdersCount: number;
    deliveredOrdersCount: number;
    totalDefaultSalary: number;
    editedSalary: number | null;
    payableSalary: number;
    exchangeRateBreakdown: Array<{ label: string; exchangeRate: number | null; sourceType: "TRY_CONVERTED" | "USD_DIRECT"; revenue: number; shipping: number; netRevenue: number; ordersCount: number }>;
    productBreakdown: Array<{ productId: number; productName: string; quantity: number; revenue: number; ordersCount: number }>;
    dailySalesBreakdown: Array<{ date: string; quantity: number; revenue: number; ordersCount: number }>;
    statusBreakdown: Array<{ status: string; count: number; amount: number }>;
  } | null>(null);
  const {user} = useAuth()
  const getAlluser = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        setUsers([]);
        console.error("Users fetch failed:", res.status, res.statusText);
        return;
      }
      const data = await res.json();
      const rows = Array.isArray(data?.data) ? data.data : [];
      setUsers(rows);
      setCommissionValues((prev) => {
        const next = { ...prev };
        rows.forEach((row: any) => {
          const raw = Number(row.salesCommissionPercent) || 0;
          next[row.id] = String(raw);
        });
        return next;
      });
      setWageValues((prev) => {
        const next = { ...prev };
        rows.forEach((row: any) => {
          const raw = Number(row.wage) || 0;
          next[row.id] = String(raw);
        });
        return next;
      });
      console.log("Users:", res);
    } catch (error) {
      setUsers([]);
      console.error("Users fetch error:", error);
    }
  }
  const getRoul = async () => {
     try {
            const res = await fetch('/api/permissions');
            const response = await res.json();
            if (response.success && Array.isArray(response.data)) {
                setRoles(response.data);
            }
        } catch (err) {
            toast.error("خطأ في جلب البيانات");
        }
  }

  React.useEffect(() => { getRoul(); getAlluser(); }, []);
  React.useEffect(() => {
    getProduct().then(setProducts).catch(console.error);
  }, []);

  React.useEffect(() => {
    const loadActivityProgress = async () => {
      if (!users.length) {
        setActivityProgressByUser({});
        return;
      }
      const ids = users.map((row: any) => String(row.id)).filter(Boolean);
      const res = await getUserActivityTargetProgress(ids);
      if (res?.success) {
        const map = (res.data || []).reduce((acc: Record<string, any>, row: any) => {
          acc[row.userId] = row;
          return acc;
        }, {});
        setActivityProgressByUser(map);
      }
    };

    loadActivityProgress();
  }, [users]);

  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;

  const nonAdminUsers = React.useMemo(
    () => users.filter((row: any) => row?.accountType !== "ADMIN"),
    [users]
  );

  const assignableEmployees = React.useMemo(
    () => nonAdminUsers.filter((row: any) => String(row?.id || "") !== String(assignManagerId || "")),
    [nonAdminUsers, assignManagerId]
  );

  /**
   * يجلب الموظفين المرتبطين حاليًا بمسؤول محدد من بيانات parentId.
   */
  const getLinkedEmployeesByManager = React.useCallback((managerId: string) => {
    const normalizedManagerId = String(managerId || "").trim();
    if (!normalizedManagerId) return [] as string[];

    return nonAdminUsers
      .filter((row: any) => String(row?.parentId || "") === normalizedManagerId)
      .map((row: any) => String(row.id));
  }, [nonAdminUsers]);

  /**
   * Opens a new dashboard tab impersonating the selected employee without replacing current admin session.
   */
  const openEmployeeView = (employeeId: string) => {
    if (!employeeId) return;
    window.open(`/dashboard?asUser=${employeeId}`, '_blank', 'noopener,noreferrer');
  };

  const isAffiliateRow = React.useCallback((row: any) => {
    return Boolean(row?.isAffiliate) || String(row?.accountType || '').trim().toUpperCase() === 'AFFILIATE';
  }, []);

  const handleAffiliateApproval = async (row: any, approved: boolean) => {
    const userId = String(row?.id || '').trim();
    if (!userId) {
      toast.error('معرف المستخدم غير صالح');
      return;
    }

    setAffiliateApprovalSaving((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await setAffiliateUserApproval(userId, approved);
      if (!result.success) {
        toast.error(result.error || 'تعذر تحديث حالة الأفلييت');
        return;
      }

      toast.success(approved ? 'تمت الموافقة على حساب الأفلييت' : 'تم إلغاء الموافقة على حساب الأفلييت');
      await getAlluser();
    } finally {
      setAffiliateApprovalSaving((prev) => ({ ...prev, [userId]: false }));
    }
  };

  /**
   * يفتح نافذة التعيين الجماعي ويعيد تهيئة الاختيارات.
   */
  const openAssignManagerModal = () => {
    setAssignManagerId('');
    setSelectedEmployeeIds([]);
    setIsAssignManagerOpen(true);
  };

  /**
   * يضيف أو يزيل الموظف من الاختيار المتعدد.
   */
  const toggleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((prev) => {
      if (checked) {
        return prev.includes(employeeId) ? prev : [...prev, employeeId];
      }
      return prev.filter((id) => id !== employeeId);
    });
  };

  /**
   * يحفظ تعيين موظف مسؤول على عدة موظفين دفعة واحدة.
   */
  const handleAssignManager = async () => {
    if (!assignManagerId) {
      toast.error("يرجى اختيار الموظف المسؤول");
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      toast.error("يرجى اختيار موظف واحد على الأقل");
      return;
    }

    setAssignSaving(true);
    const loadingToast = toast.loading("جاري حفظ التعيين...");
    try {
      const res = await assignManagerToEmployees({
        managerId: assignManagerId,
        employeeIds: selectedEmployeeIds,
      });

      if (res?.success) {
        toast.success("تم تعيين المسؤول بنجاح");
        setIsAssignManagerOpen(false);
        setAssignManagerId('');
        setSelectedEmployeeIds([]);
        getAlluser();
      } else {
        toast.error(res?.error || "فشل في تعيين المسؤول");
      }
    } catch (error) {
      toast.error("فشل في تعيين المسؤول");
    } finally {
      setAssignSaving(false);
      toast.dismiss(loadingToast);
    }
  };

  /**
   * يفك ارتباط مجموعة موظفين من أي مسؤول حالي دفعة واحدة.
   */
  const handleUnassignManager = async () => {
    if (selectedEmployeeIds.length === 0) {
      toast.error("يرجى اختيار موظف واحد على الأقل");
      return;
    }

    setAssignSaving(true);
    const loadingToast = toast.loading("جاري فك الارتباط...");
    try {
      const res = await unassignManagerFromEmployees(selectedEmployeeIds);

      if (res?.success) {
        toast.success("تم فك الارتباط بنجاح");
        setIsAssignManagerOpen(false);
        setAssignManagerId('');
        setSelectedEmployeeIds([]);
        getAlluser();
      } else {
        toast.error(res?.error || "فشل في فك الارتباط");
      }
    } catch (error) {
      toast.error("فشل في فك الارتباط");
    } finally {
      setAssignSaving(false);
      toast.dismiss(loadingToast);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditId(null);
    setFormData(null);
  };

  const openSalesTargetModal = (mode: "assign" | "edit", data: any) => {
    setTargetMode(mode);
    setTargetUser(data);
    const currentTarget = mode === "edit" ? getLatestTarget(data?.targets) : null;
    setEditTargetId(currentTarget?.id || null);
    if (currentTarget) {
      const items = Array.isArray(currentTarget.products) && currentTarget.products.length > 0
        ? currentTarget.products.map((item: any) => ({
            productId: String(item.productId),
            requiredQty: item.requiredQty ?? 1,
            rewardValue: item.rewardValue ?? 0,
          }))
        : [{ productId: "", requiredQty: 1, rewardValue: 0 }];
      setSalesTargetValue(formatNumberList(currentTarget.salesTargetValue));
      setSalesRewardValue(formatNumberList(currentTarget.salesRewardValue));
      setSalesTargetStartDate(
        currentTarget?.createdAt
          ? new Date(currentTarget.createdAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      setTargetItems(items);
    } else {
      setSalesTargetValue('');
      setSalesRewardValue('');
      setSalesTargetStartDate(new Date().toISOString().slice(0, 10));
      setTargetItems([{ productId: "", requiredQty: 1, rewardValue: 0 }]);
    }

    setIsSalesTargetOpen(true);
  };

  const openActivityTargetModal = (data: any) => {
    setTargetUser(data);
    const activityTarget = data?.activityTarget;
    setActivityCycle(activityTarget?.cycle === "MONTHLY" ? "MONTHLY" : "DAILY");
    setRequiredCustomersTarget(String(Number(activityTarget?.requiredCustomers || 0)));
    setCustomerRewardTarget(String(Number(activityTarget?.customerReward || 0)));
    setCustomerMissPenaltyAmountTarget(String(Number(activityTarget?.customerMissPenaltyAmount || 0)));
    setRequiredCommunicationsTarget(String(Number(activityTarget?.requiredCommunications || 0)));
    setCommunicationRewardTarget(String(Number(activityTarget?.communicationReward || 0)));
    setCommunicationMissPenaltyAmountTarget(String(Number(activityTarget?.communicationMissPenaltyAmount || 0)));
    setActivityTargetStartDate(
      activityTarget?.startsAt
        ? new Date(activityTarget.startsAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    const nextDays = Array.isArray(activityTarget?.activeWeekDays)
      ? activityTarget.activeWeekDays.filter((day: string) => DEFAULT_ACTIVITY_WEEK_DAYS.includes(day as ActivityWeekDay))
      : [];
    setActivityWeekDays(nextDays.length > 0 ? (nextDays as ActivityWeekDay[]) : DEFAULT_ACTIVITY_WEEK_DAYS);

      setIsActivityTargetOpen(true);
  };

  const toggleActivityWeekDay = (weekDay: ActivityWeekDay, checked: boolean) => {
    setActivityWeekDays((prev) => {
      if (checked) {
        return prev.includes(weekDay) ? prev : [...prev, weekDay];
      }
      return prev.filter((item) => item !== weekDay);
    });
  };

  const updateTargetItem = (index: number, patch: Partial<typeof targetItems[number]>) => {
    setTargetItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addTargetItem = () => {
    setTargetItems((prev) => [
      ...prev,
      { productId: "", requiredQty: 1, rewardValue: 0 }
    ]);
  };

  const removeTargetItem = (index: number) => {
    setTargetItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveSalesTarget = async () => {
    if (!targetUser?.id) return;

    const salesTargetValues = parseNumberList(salesTargetValue);
    const salesRewardValues = parseNumberList(salesRewardValue);

    const selectedProducts = targetItems.filter((item) => Boolean(item.productId));
    const hasSalesOrProducts = salesTargetValues.length > 0 || selectedProducts.length > 0;
    const parsedStartDate = new Date(salesTargetStartDate);

    if (!hasSalesOrProducts) {
      toast.error("يرجى إدخال تاركت مبيعات أو إضافة منتجات مستهدفة");
      return;
    }

    if (!salesTargetStartDate || Number.isNaN(parsedStartDate.getTime())) {
      toast.error("يرجى إدخال تاريخ بداية صحيح للتاركت");
      return;
    }

    const seenProducts = new Set<string>();
    for (const item of selectedProducts) {
      if (seenProducts.has(item.productId)) {
        toast.error("لا يمكن تكرار نفس المنتج في التاركت");
        return;
      }
      seenProducts.add(item.productId);
      if (!item.requiredQty || item.requiredQty <= 0) {
        toast.error("يرجى إدخال كمية صحيحة");
        return;
      }
    }

    const loadingToast = toast.loading("جاري حفظ تاركت المبيعات...");
    try {
      const payload = {
        userId: targetUser.id,
        salesTargetValue: salesTargetValues,
        salesRewardValue: salesRewardValues,
        startDate: salesTargetStartDate,
        products: selectedProducts.map((item) => ({
          productId: Number(item.productId),
          requiredQty: item.requiredQty,
          rewardValue: item.rewardValue,
        }))
      };

      // حفظ من مودال التعيين ينشئ تاركت جديد دائمًا (لا يحدّث القديم).
      const res = await createUserTarget(payload);

      if (!res.success) {
        toast.error(res.error || "فشل حفظ تاركت المبيعات");
        return;
      }

      toast.success("تم إنشاء تاركت المبيعات بنجاح");
      setIsSalesTargetOpen(false);
      getAlluser();
    } catch (error) {
      toast.error("فشل حفظ تاركت المبيعات");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleSaveActivityTarget = async () => {
    if (!targetUser?.id) return;

    const requiredCustomers = Math.max(0, Math.trunc(Number(requiredCustomersTarget) || 0));
    const requiredCommunications = Math.max(0, Math.trunc(Number(requiredCommunicationsTarget) || 0));
    const customerReward = Math.max(0, Number(customerRewardTarget) || 0);
    const customerMissPenaltyAmount = Math.max(0, Number(customerMissPenaltyAmountTarget) || 0);
    const communicationReward = Math.max(0, Number(communicationRewardTarget) || 0);
    const communicationMissPenaltyAmount = Math.max(0, Number(communicationMissPenaltyAmountTarget) || 0);

    if (requiredCustomers <= 0 && requiredCommunications <= 0) {
      toast.error("يرجى إدخال تاركت النشاط (العملاء أو التواصل)");
      return;
    }

    if (activityCycle === "DAILY" && activityWeekDays.length === 0) {
      toast.error("يرجى اختيار يوم واحد على الأقل لتاركت النشاط اليومي");
      return;
    }

    const loadingToast = toast.loading("جاري حفظ تاركت النشاط...");
    try {
      const activityRes = await setUserActivityTarget(targetUser.id, {
        cycle: activityCycle,
        activeWeekDays: activityCycle === "DAILY" ? activityWeekDays : DEFAULT_ACTIVITY_WEEK_DAYS,
        requiredCustomers,
        customerReward,
        customerMissPenaltyAmount,
        requiredCommunications,
        communicationReward,
        communicationMissPenaltyAmount,
        startDate: activityTargetStartDate,
        isActive: true,
      });

      if (!activityRes.success) {
        toast.error(activityRes.error || "فشل حفظ تاركت النشاط");
        return;
      }

      toast.success("تم حفظ تاركت النشاط بنجاح");
      setIsActivityTargetOpen(false);
      getAlluser();
    } catch (error) {
      toast.error("فشل حفظ تاركت النشاط");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const normalizeDecimalInput = (value: string) => {
    const normalized = value.replace(/[٫,]/g, ".").replace(/[^0-9.]/g, "");
    const [head, ...rest] = normalized.split(".");
    return rest.length > 0 ? `${head}.${rest.join("")}` : head;
  };

  const handleCommissionChange = (userId: string, value: string) => {
    setCommissionValues((prev) => ({ ...prev, [userId]: normalizeDecimalInput(value) }));
  };

  const handleCommissionBlur = async (userId: string) => {
    const raw = commissionValues[userId] ?? "0";
    const value = Number(normalizeDecimalInput(raw)) || 0;
    setCommissionSaving((prev) => ({ ...prev, [userId]: true }));
    const res = await updateUserCommission(userId, value);
    if (res?.success) {
      toast.success(`تم تحديث نسبة الأرباح إلى ${value}%`);
      setCommissionValues((prev) => ({ ...prev, [userId]: String(value) }));
    } else {
      toast.error(res?.error || "فشل تحديث نسبة الأرباح");
    }
    setCommissionSaving((prev) => ({ ...prev, [userId]: false }));
  };

  const normalizeIntegerInput = (value: string) => value.replace(/[^0-9]/g, "");

  const handleWageChange = (userId: string, value: string) => {
    setWageValues((prev) => ({ ...prev, [userId]: normalizeIntegerInput(value) }));
  };

  const handleWageBlur = async (userId: string) => {
    const raw = wageValues[userId] ?? "0";
    const value = Number(normalizeIntegerInput(raw)) || 0;
    setWageSaving((prev) => ({ ...prev, [userId]: true }));
    const res = await updateUserWage(userId, value);
    if (res?.success) {
      toast.success(`تم تحديث البدل الثابت إلى ${value}`);
      setWageValues((prev) => ({ ...prev, [userId]: String(value) }));
    } else {
      toast.error(res?.error || "فشل تحديث البدل الثابت");
    }
    setWageSaving((prev) => ({ ...prev, [userId]: false }));
  };

  const onSubmit = async (data: z.infer<typeof userSchema>) => {
  const loadingToast = toast.loading(editId ? 'جاري تحديث البيانات...' : 'جاري إنشاء الحساب...');
  try {
    let response;
    if (editId) {
      // تحديث مستخدم موجود
      const res = await updateuser(editId, data);
      if (res?.success) {
        toast.success('تم التحديث بنجاح');
        getAlluser();
      } else {
        toast.error(res?.error || 'فشل التحديث');
      }
    } else {
      // إنشاء مستخدم جديد عبر API
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // ضروري جداً ليتمكن السيرفر من قراءة البيانات
        },
        body: JSON.stringify(data), // تحويل الكائن إلى نص JSON
      });
      
      const result = await res.json();

      if (result.success) {
        toast.success('تم إنشاء المستخدم بنجاح');
        getAlluser();
      } else {
        toast.error(result.error || 'فشل في إنشاء المستخدم');
      }
    }
    handleClose();
  } catch (error) {
    console.error(error);
    toast.error('حدث خطأ غير متوقع');
  } finally {
    toast.dismiss(loadingToast);
  }
};
  const selectClasses = `w-full p-3 rounded-md border transition-all outline-none bg-white border-gray-300 text-gray-900 dark:bg-[#0f172a] dark:border-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50`;

  /**
   * يحدد هل يحق للمستخدم الحالي إدارة تاركت هذا الصف.
   */
  const canManageTargetForRow = (row: any) => {
    if (!user) return false;
    if (user.accountType === "ADMIN") return true;
    return String(row?.parentId || "") === String(user?.id || "");
  };

  const canManageAnyTargets = React.useMemo(() => {
    if (!user) return false;
    if (user.accountType === "ADMIN") return true;
    return users.some((row: any) => String(row?.parentId || "") === String(user?.id || ""));
  }, [user, users]);

  const loadFinancialReport = React.useCallback(async (employee: any, monthKey: string) => {
    setFinancialReportLoading(true);
    try {
      const employeeId = String(employee?.id || "");
      if (!employeeId) {
        toast.error("تعذر تحميل التقرير المالي لهذا الموظف");
        return;
      }

      const [targetRes, adjustmentsRes] = await Promise.all([
        GetUserTargetProgress(employeeId, monthKey),
        getEmployeeSalaryAdjustments(monthKey),
      ]);

      if (!targetRes?.success) {
        toast.error(targetRes?.error || "فشل في تحميل التقرير المالي");
        setFinancialReportData(null);
        return;
      }

      const summary: any = targetRes?.summary || {};
      const fixedSalary = Number(employee?.wage || 0);
      const totalCommissionAmount = Number(summary?.totalCommissionAmount || 0);
      const totalSalesRewardAmount = Number(summary?.totalSalesRewardAmount || 0);
      const totalProductRewardAmount = Number(summary?.totalProductRewardAmount || 0);
      const totalDefaultSalary = fixedSalary + totalCommissionAmount + totalSalesRewardAmount + totalProductRewardAmount;

      const editedSalaryRecord = adjustmentsRes?.success
        ? (adjustmentsRes.data || []).find((item: any) => String(item?.userId || "") === employeeId)
        : null;
      const editedSalaryValue = Number(editedSalaryRecord?.editedSalary);
      const hasEditedSalary = Number.isFinite(editedSalaryValue);
      const payableSalary = hasEditedSalary ? editedSalaryValue : totalDefaultSalary;

      setFinancialReportData({
        employeeNotes: String(employee?.notes || "").trim() || null,
        fixedSalary,
        assignedCommissionPercent: Number((summary?.assignedCommissionPercent ?? employee?.salesCommissionPercent) || 0),
        totalCommissionAmount,
        totalSalesRewardAmount,
        totalProductRewardAmount,
        totalSalesAmount: Number(summary?.totalSalesAmount || 0),
        totalShippingAmount: Number(summary?.totalShippingAmount || 0),
        netSalesForCommission: Number(summary?.netSalesForCommission || 0),
        totalOrdersCount: Number(summary?.totalOrdersCount || 0),
        deliveredOrdersCount: Number(summary?.deliveredOrdersCount || 0),
        totalDefaultSalary,
        editedSalary: hasEditedSalary ? editedSalaryValue : null,
        payableSalary,
        exchangeRateBreakdown: Array.isArray(summary?.exchangeRateBreakdown) ? summary.exchangeRateBreakdown : [],
        productBreakdown: Array.isArray(summary?.productBreakdown) ? summary.productBreakdown : [],
        dailySalesBreakdown: Array.isArray(summary?.dailySalesBreakdown) ? summary.dailySalesBreakdown : [],
        statusBreakdown: Array.isArray(summary?.statusBreakdown) ? summary.statusBreakdown : [],
      });
    } catch (error) {
      toast.error("حدث خطأ أثناء تحميل التقرير المالي");
      setFinancialReportData(null);
    } finally {
      setFinancialReportLoading(false);
    }
  }, []);

  const openFinancialReportModal = (employee: any) => {
    const monthKey = getCurrentMonthKey();
    setFinancialReportUser(employee);
    setFinancialReportMonth(monthKey);
    setIsFinancialReportOpen(true);
    loadFinancialReport(employee, monthKey);
  };

  const handleFinancialMonthChange = async (nextMonth: string) => {
    setFinancialReportMonth(nextMonth);
    if (!financialReportUser || !nextMonth) return;
    await loadFinancialReport(financialReportUser, nextMonth);
  };

  const exportFinancialReportPdf = React.useCallback(async () => {
    if (financialReportLoading) {
      toast.error("انتظر حتى يكتمل تحميل التقرير");
      return;
    }

    if (!financialReportData) {
      toast.error("لا توجد بيانات مالية لتصديرها");
      return;
    }

    setIsFinancialReportPdfExporting(true);

    try {
      const monthLabel = financialReportMonth
        ? new Date(`${financialReportMonth}-01`).toLocaleDateString("ar-EG", { year: "numeric", month: "long" })
        : "الشهر الحالي";

      const exchangeRowsHtml = financialReportData.exchangeRateBreakdown.length
        ? financialReportData.exchangeRateBreakdown
            .map(
              (row) => `
                <div style="display:grid;grid-template-columns:1.1fr .85fr .55fr .8fr;gap:6px;padding:6px 8px;border-bottom:1px solid #e2e8f0;align-items:center;">
                  <div style="font-weight:700;color:#0f172a;">${row.sourceType === "TRY_CONVERTED" ? "طلبات تركيا" : "طلبات USD مباشرة"}</div>
                  <div style="color:#475569;">${row.exchangeRate === null ? "-" : row.label}</div>
                  <div style="color:#475569;">${Number(row.ordersCount || 0).toLocaleString()}</div>
                  <div style="font-weight:800;color:#2563eb;">${formatMoney(row.netRevenue)} $</div>
                </div>
              `
            )
            .join("")
        : `<div style="padding:10px 8px;color:#64748b;">لا توجد بيانات</div>`;

      const productRowsHtml = financialReportData.productBreakdown.length
        ? financialReportData.productBreakdown
            .map(
              (row) => `
                <div style="display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-bottom:1px solid #e2e8f0;">
                  <div style="min-width:0;">
                    <div style="font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:235px;">${row.productName}</div>
                    <div style="font-size:10px;color:#64748b;">الكمية ${Number(row.quantity || 0).toLocaleString()} | الطلبات ${Number(row.ordersCount || 0).toLocaleString()}</div>
                  </div>
                  <div style="font-weight:800;color:#059669;white-space:nowrap;">${formatMoney(row.revenue)} $</div>
                </div>
              `
            )
            .join("")
        : `<div style="padding:10px 8px;color:#64748b;">لا توجد بيانات</div>`;

      const dailyRowsHtml = financialReportData.dailySalesBreakdown.length
        ? financialReportData.dailySalesBreakdown
            .map(
              (row) => `
                <div style="display:grid;grid-template-columns:.9fr .55fr .55fr .7fr;gap:6px;padding:5px 8px;border-bottom:1px solid #e2e8f0;align-items:center;">
                  <div style="font-weight:700;color:#0f172a;">${new Date(row.date).toLocaleDateString("ar-EG")}</div>
                  <div style="color:#475569;">${Number(row.quantity || 0).toLocaleString()}</div>
                  <div style="color:#475569;">${Number(row.ordersCount || 0).toLocaleString()}</div>
                  <div style="font-weight:800;color:#2563eb;">${formatMoney(row.revenue)} $</div>
                </div>
              `
            )
            .join("")
        : `<div style="padding:10px 8px;color:#64748b;">لا توجد بيانات</div>`;

      const statusRowsHtml = financialReportData.statusBreakdown.length
        ? financialReportData.statusBreakdown
            .map(
              (row) => `
                <div style="display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-bottom:1px solid #e2e8f0;">
                  <div>
                    <div style="font-weight:700;color:#0f172a;">${row.status}</div>
                    <div style="font-size:10px;color:#64748b;">الطلبات ${Number(row.count || 0).toLocaleString()}</div>
                  </div>
                  <div style="font-weight:800;color:#7c3aed;white-space:nowrap;">${formatMoney(row.amount)} $</div>
                </div>
              `
            )
            .join("")
        : `<div style="padding:10px 8px;color:#64748b;">لا توجد بيانات</div>`;

      const wrapper = document.createElement("div");
      wrapper.setAttribute("dir", "rtl");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-99999px";
      wrapper.style.top = "0";
      wrapper.style.width = "1123px";
      wrapper.style.minHeight = "794px";
      wrapper.style.background = "#ffffff";
      wrapper.style.color = "#0f172a";
      wrapper.style.padding = "18px";
      wrapper.style.fontFamily = "Tahoma, Arial, sans-serif";
      wrapper.style.boxSizing = "border-box";

      wrapper.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #e2e8f0;">
          <div>
            <div style="font-size:24px;font-weight:900;color:#0f172a;">التقرير المالي للموظف</div>
            <div style="margin-top:4px;font-size:16px;font-weight:700;color:#1e293b;">${financialReportUser?.username || "-"}</div>
          </div>
          <div style="text-align:left;font-size:11px;color:#475569;line-height:1.6;">
            <div><strong>الشهر:</strong> ${monthLabel}</div>
            <div><strong>تاريخ التصدير:</strong> ${new Date().toLocaleDateString("ar-EG")}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:8px;margin-bottom:12px;">
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc;"><div style="font-size:10px;color:#64748b;">البدل الثابت</div><div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:4px;">${formatMoney(financialReportData.fixedSalary)}</div></div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc;"><div style="font-size:10px;color:#64748b;">عمولة المبيعات</div><div style="font-size:16px;font-weight:900;color:#059669;margin-top:4px;">${formatMoney(financialReportData.totalCommissionAmount)}</div></div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc;"><div style="font-size:10px;color:#64748b;">مكافأة المبيعات</div><div style="font-size:16px;font-weight:900;color:#b45309;margin-top:4px;">${formatMoney(financialReportData.totalSalesRewardAmount)}</div></div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc;"><div style="font-size:10px;color:#64748b;">مكافأة المنتجات</div><div style="font-size:16px;font-weight:900;color:#7c3aed;margin-top:4px;">${formatMoney(financialReportData.totalProductRewardAmount)}</div></div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#eff6ff;"><div style="font-size:10px;color:#64748b;">المستحق الافتراضي</div><div style="font-size:16px;font-weight:900;color:#1d4ed8;margin-top:4px;">${formatMoney(financialReportData.totalDefaultSalary)}</div></div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#ecfeff;"><div style="font-size:10px;color:#64748b;">الراتب النهائي</div><div style="font-size:16px;font-weight:900;color:#0f766e;margin-top:4px;">${formatMoney(financialReportData.payableSalary)}</div></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#ffffff;">
            <div style="font-size:13px;font-weight:900;margin-bottom:6px;">تفاصيل المبيعات</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;font-size:11px;color:#334155;line-height:1.7;">
              <div>إجمالي المبيعات: <strong>${formatMoney(financialReportData.totalSalesAmount)}</strong></div>
              <div>إجمالي الشحن: <strong>${formatMoney(financialReportData.totalShippingAmount)}</strong></div>
              <div>صافي المبيعات للعمولة: <strong>${formatMoney(financialReportData.netSalesForCommission)}</strong></div>
              <div>الطلبات الكلية: <strong>${Number(financialReportData.totalOrdersCount || 0).toLocaleString()}</strong></div>
              <div>الطلبات المسلمة: <strong>${Number(financialReportData.deliveredOrdersCount || 0).toLocaleString()}</strong></div>
              <div>نسبة العمولة: <strong>${formatMoney(financialReportData.assignedCommissionPercent)}%</strong></div>
            </div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#ffffff;">
            <div style="font-size:13px;font-weight:900;margin-bottom:6px;">تفاصيل الراتب</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;font-size:11px;color:#334155;line-height:1.7;">
              <div>البدل الثابت: <strong>${formatMoney(financialReportData.fixedSalary)}</strong></div>
              <div>عمولة المبيعات: <strong>${formatMoney(financialReportData.totalCommissionAmount)}</strong></div>
              <div>مكافأة المبيعات: <strong>${formatMoney(financialReportData.totalSalesRewardAmount)}</strong></div>
              <div>مكافأة المنتجات: <strong>${formatMoney(financialReportData.totalProductRewardAmount)}</strong></div>
              <div>المستحق الافتراضي: <strong>${formatMoney(financialReportData.totalDefaultSalary)}</strong></div>
              <div>الراتب المعدل: <strong>${financialReportData.editedSalary === null ? "لا يوجد تعديل" : formatMoney(financialReportData.editedSalary)}</strong></div>
            </div>
          </div>
        </div>

        <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#ffffff;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:900;margin-bottom:6px;">ملاحظات الموظف</div>
          <div style="font-size:11px;color:#334155;line-height:1.9;white-space:pre-wrap;word-break:break-word;">${financialReportData.employeeNotes || "لا توجد ملاحظات لهذا الموظف"}</div>
        </div>

        <div style="display:grid;grid-template-columns:1.05fr .95fr 1fr 1fr;gap:10px;align-items:start;">
          <div style="border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">
            <div style="padding:8px 10px;background:#f8fafc;font-size:12px;font-weight:900;">تفصيل سعر الصرف</div>
            <div style="font-size:10px;">${exchangeRowsHtml}</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">
            <div style="padding:8px 10px;background:#f8fafc;font-size:12px;font-weight:900;">أفضل المنتجات</div>
            <div style="font-size:10px;">${productRowsHtml}</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">
            <div style="padding:8px 10px;background:#f8fafc;font-size:12px;font-weight:900;">التوزيع اليومي</div>
            <div style="font-size:10px;">${dailyRowsHtml}</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">
            <div style="padding:8px 10px;background:#f8fafc;font-size:12px;font-weight:900;">تفصيل الحالات</div>
            <div style="font-size:10px;">${statusRowsHtml}</div>
          </div>
        </div>
      `;

      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(wrapper);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pdfWidth) / canvas.width;
      const renderHeight = Math.min(pdfHeight, imageHeight);

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, renderHeight);

      const safeUserName = String(financialReportUser?.username || "employee").replace(/\s+/g, "-");
      const safeMonth = String(financialReportMonth || getCurrentMonthKey());
      pdf.save(`financial-report-${safeUserName}-${safeMonth}.pdf`);

      toast.success("تم تحميل التقرير المالي PDF");
    } catch (error) {
      console.error("Financial report PDF export error:", error);
      toast.error("فشل إنشاء ملف PDF للتقرير المالي");
    } finally {
      setIsFinancialReportPdfExporting(false);
    }
  }, [financialReportLoading, financialReportData, financialReportUser, financialReportMonth]);

  // هذا الجزء يستخدم عادة داخل مكون الجدول (DataTable)
  const tableActions: any[] = [
    (user && canManageAnyTargets) && {
      label: "تاركت المبيعات",
      icon: <Plus size={14} />,
      onClick: (data: any) => {
        if (!canManageTargetForRow(data)) {
          toast.error("يمكنك إدارة التاركت للموظفين المرتبطين بك فقط");
          return;
        }

        openSalesTargetModal("assign", data);
      }
    },
    (user && canManageAnyTargets) && {
      label: "تاركت النشاط",
      icon: <Plus size={14} />,
      onClick: (data: any) => {
        if (!canManageTargetForRow(data)) {
          toast.error("يمكنك إدارة التاركت للموظفين المرتبطين بك فقط");
          return;
        }

        openActivityTargetModal(data);
      }
    },
    (user && (user.accountType === "ADMIN" || hasPermission(user, "viewEmployees"))) && {
      label: "التقرير المالي",
      icon: <Coins size={14} />,
      onClick: (data: any) => {
        openFinancialReportModal(data);
      }
    },
    (user && hasPermission(user, "editEmployees")) && {
      label: "تعديل",
      icon: <Mail size={14} />,
      onClick: (data: any) => {
        setEditId(data.id);
        setFormData({
          username: data.username,
          email: data.email,
          phone: data.phone,
          notes: data.notes || "",
          jobTitle: data.jobTitle,
          accountType: data.accountType,
          isAffiliate: Boolean(data.isAffiliate),
          salesCommissionPercent: data.salesCommissionPercent ?? 0,
          wage: data.wage ?? 0,
          permissions: data.permission.id || "", // الربط مع ID الصلاحية
        });
        console.log("data", data);
        setIsOpen(true);
      }
    },
    (user && hasPermission(user, "deleteEmployees")) && {
      label: "حذف",
      icon: <Plus className="rotate-45" size={14} />,
      variant: "danger",
      onClick: async (data: any) => {
        const confirm = window.confirm("هل أنت متأكد من حذف هذا المستخدم؟");
        if (confirm) {
          const loadingToast = toast.loading('جاري الحذف...');
          try {
            // استدعاء دالة الحذف من السيرفر هنا
            const res = await deleteuser(data.id);
            if (res.success) {
              toast.success('تم حذف المستخدم بنجاح');
              getAlluser(); // تحديث قائمة المستخدمين بعد الحذف
            } else {
              toast.error(res.error || 'فشل في حذف المستخدم');
            }
          } catch (error) {
            toast.error('فشل في حذف المستخدم');
          } finally {
            toast.dismiss(loadingToast);
          }
        }
      }
    },
  ].filter(Boolean);

  return (
    <div className="p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة المستخدمين</h1>
        <div className="flex items-center gap-2">
          {user?.accountType === "ADMIN" && (
            <Button
              onClick={openAssignManagerModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
            >
              تعيين مسؤول لموظفين
            </Button>
          )}
          {user && hasPermission(user, "addEmployees") && (
            <Button onClick={() => { setEditId(null); setFormData(null); setIsOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
            إضافة مستخدم جديد
          </Button>
          )}
        </div>
      </div>
      <DataTable data={users} 
       totalCount={users.length} // لنفترض وجود 150 عميل في الداتا بيز
                pageSize={PAGE_SIZE}
                currentPage={page}
                onPageChange={(newPage) => setPage(newPage)}
      actions={tableActions} columns={
        [
          {
            header: "الاسم",
            accessor: (row: any) => {
              // الادمن يرى جميع لوحات التحكم، وغير الادمن يرى فقط لوحات المستخدمين المرتبطين به.
              const isAdmin = user?.accountType === "ADMIN";
              const isLinkedUser = String(row?.parentId || "") === String(user?.id || "");
              const canImpersonate = Boolean(user) && (isAdmin || isLinkedUser);
              if (!canImpersonate) return row?.username;

              return (
                <button
                  type="button"
                  onClick={() => openEmployeeView(String(row.id))}
                  className="font-semibold text-blue-600 hover:underline"
                  title="فتح لوحة الموظف في تبويب جديد"
                >
                  {row?.username}
                </button>
              );
            }
          },
          { header: "البريد الإلكتروني", accessor: "email" },
          { header: "رقم الهاتف", accessor: "phone" },
          {
            header: "نوع المستخدم",
            accessor: (row: any) => isAffiliateRow(row) ? "أفلييت" : "داخلي"
          },
          {
            header: "حالة الأفلييت",
            accessor: (row: any) => {
              if (!isAffiliateRow(row)) return "-";
              return row.affiliateApproved ? "تمت الموافقة" : "بانتظار الموافقة";
            }
          },
          {
            header: "موافقة الأفلييت",
            accessor: (row: any) => {
              if (!isAffiliateRow(row)) return "-";

              const isSaving = Boolean(affiliateApprovalSaving[row.id]);
              return (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAffiliateApproval(row, true)}
                    disabled={isSaving || Boolean(row.affiliateApproved)}
                    className="rounded-md border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    موافقة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAffiliateApproval(row, false)}
                    disabled={isSaving || !Boolean(row.affiliateApproved)}
                    className="rounded-md border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>
              );
            }
          },
          {
            header: "تاركت العملاء",
            accessor: (row: any) => {
              const progress = activityProgressByUser[row.id];
              if (!progress) return "-";
              const cycleLabel = progress.cycle === "MONTHLY" ? "شهري" : "يومي";
              return `${progress.customersTodayOrPeriod}/${progress.customersTargetTodayOrPeriod} (${cycleLabel})`;
            }
          },
          {
            header: "تاركت التواصل",
            accessor: (row: any) => {
              const progress = activityProgressByUser[row.id];
              if (!progress) return "-";
              const reward = Number(progress.communicationReward || 0).toLocaleString();
              return `${progress.communicationsTodayOrPeriod}/${progress.communicationsTargetTodayOrPeriod} | مكافأة: ${reward}`;
            }
          },
          {
            header: "نسبة الأرباح على المبيعات (%)",
            accessor: (row: any) => (
              <input
                type="text"
                min={0}
                inputMode="decimal"
                pattern="[0-9]+([.,][0-9]+)?"
                className="w-24 rounded-md border border-slate-300 bg-white p-1 text-center text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={commissionValues[row.id] ?? "0"}
                onChange={(e) => handleCommissionChange(row.id, e.target.value)}
                onBlur={() => handleCommissionBlur(row.id)}
                disabled={commissionSaving[row.id]}
              />
            )
          },
          {
            header: "البدل الثابت",
            accessor: (row: any) => (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]+"
                className="w-24 rounded-md border border-slate-300 bg-white p-1 text-center text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={wageValues[row.id] ?? "0"}
                onChange={(e) => handleWageChange(row.id, e.target.value)}
                onBlur={() => handleWageBlur(row.id)}
                disabled={wageSaving[row.id]}
              />
            )
          },
          { header: "مجموعة الصلاحيات", accessor: (row: any) => row.permission?.roleName || "غير محدد" },

        ]
      } />

      <AppModal
        title={`التقرير المالي - ${financialReportUser?.username || ""}`}
        isOpen={isFinancialReportOpen}
        size='lg'
        onClose={() => setIsFinancialReportOpen(false)}
      >
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-300">اختر الشهر لعرض التقرير المالي للموظف</div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">الشهر</label>
                <input
                  type="month"
                  value={financialReportMonth}
                  onChange={(e) => handleFinancialMonthChange(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <Button
                type="button"
                onClick={exportFinancialReportPdf}
                disabled={financialReportLoading || !financialReportData || isFinancialReportPdfExporting}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white"
              >
                <Download size={16} />
                {isFinancialReportPdfExporting ? "جار تجهيز PDF..." : "تحميل PDF"}
              </Button>
            </div>
          </div>

          {financialReportLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              جاري تحميل التقرير المالي...
            </div>
          ) : !financialReportData ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20">
              لا توجد بيانات مالية متاحة لهذا الموظف في الشهر المحدد.
            </div>
          ) : (
            <div className="space-y-4 bg-white dark:bg-slate-950 p-1 rounded-md">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs text-slate-500 dark:text-slate-300">الراتب الثابت</div>
                  <div className="mt-1 text-lg font-black text-slate-700 dark:text-slate-100">{formatMoney(financialReportData.fixedSalary)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs text-slate-500 dark:text-slate-300">عمولة المبيعات</div>
                  <div className="mt-1 text-lg font-black text-emerald-600">{formatMoney(financialReportData.totalCommissionAmount)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-300">النسبة المعتمدة: {formatMoney(financialReportData.assignedCommissionPercent)}%</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs text-slate-500 dark:text-slate-300">المستحق النهائي</div>
                  <div className="mt-1 text-lg font-black text-blue-600">{formatMoney(financialReportData.payableSalary)}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 font-black text-slate-700 dark:text-slate-100">تفاصيل المبيعات</div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-300">
                    <div>إجمالي المبيعات: <span className="font-bold">{formatMoney(financialReportData.totalSalesAmount)}</span></div>
                    <div>إجمالي الشحن: <span className="font-bold">{formatMoney(financialReportData.totalShippingAmount)}</span></div>
                    <div>صافي المبيعات للعمولة: <span className="font-bold">{formatMoney(financialReportData.netSalesForCommission)}</span></div>
                    <div>إجمالي الطلبات: <span className="font-bold">{Number(financialReportData.totalOrdersCount || 0).toLocaleString()}</span></div>
                    <div>الطلبات المسلمة: <span className="font-bold">{Number(financialReportData.deliveredOrdersCount || 0).toLocaleString()}</span></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 font-black text-slate-700 dark:text-slate-100">تفاصيل الراتب</div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-300">
                    <div>البدل الثابت: <span className="font-bold">{formatMoney(financialReportData.fixedSalary)}</span></div>
                    <div>عمولة المبيعات: <span className="font-bold text-emerald-600">{formatMoney(financialReportData.totalCommissionAmount)}</span></div>
                    <div>مكافأة المبيعات: <span className="font-bold text-amber-600">{formatMoney(financialReportData.totalSalesRewardAmount)}</span></div>
                    <div>مكافأة المنتجات: <span className="font-bold text-violet-600">{formatMoney(financialReportData.totalProductRewardAmount)}</span></div>
                    <div>المستحق الافتراضي: <span className="font-bold">{formatMoney(financialReportData.totalDefaultSalary)}</span></div>
                    <div>
                      الراتب المعدل:
                      <span className="font-bold"> {financialReportData.editedSalary === null ? "لا يوجد تعديل" : formatMoney(financialReportData.editedSalary)}</span>
                    </div>
                    <div>الراتب النهائي المعتمد: <span className="font-bold text-blue-600">{formatMoney(financialReportData.payableSalary)}</span></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 font-black text-slate-700 dark:text-slate-100">ملاحظات الموظف</div>
                <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                  {financialReportData.employeeNotes || "لا توجد ملاحظات لهذا الموظف."}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-black text-slate-800 dark:text-white">تفصيل المبيعات حسب سعر صرف الدولار</div>
                    <div className="text-xs text-slate-500 dark:text-slate-300">الطلبات التركية تُجمع حسب سعر الصرف المستخدم، والطلبات المباشرة بالدولار تبقى في قسم مستقل</div>
                  </div>
                </div>
                {financialReportData.exchangeRateBreakdown.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-300">لا توجد بيانات لسعر الصرف في هذا الشهر.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-300">
                          <th className="px-3 py-2 text-right">نوع التسعير</th>
                          <th className="px-3 py-2 text-right">سعر الصرف</th>
                          <th className="px-3 py-2 text-right">الطلبات</th>
                          <th className="px-3 py-2 text-right">المبيعات</th>
                          <th className="px-3 py-2 text-right">الشحن</th>
                          <th className="px-3 py-2 text-right">الصافي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financialReportData.exchangeRateBreakdown.map((row) => (
                          <tr key={`${row.label}-${row.ordersCount}`} className="border-b border-slate-100 dark:border-slate-800/70">
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{row.sourceType === "TRY_CONVERTED" ? "طلبات تركيا" : "طلبات USD مباشرة"}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.exchangeRate === null ? "-" : row.label}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{Number(row.ordersCount || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 font-bold text-emerald-600">{formatMoney(row.revenue)}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{formatMoney(row.shipping)}</td>
                            <td className="px-3 py-2 font-bold text-blue-600">{formatMoney(row.netRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3">
                    <div className="font-black text-slate-800 dark:text-white">أفضل المنتجات مبيعًا</div>
                    <div className="text-xs text-slate-500 dark:text-slate-300">مرتب حسب أعلى إيراد خلال الشهر المحدد</div>
                  </div>
                  {financialReportData.productBreakdown.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-300">لا توجد منتجات مباعة في هذا الشهر.</div>
                  ) : (
                    <div className="space-y-2">
                      {financialReportData.productBreakdown.slice(0, 8).map((row) => (
                        <div key={row.productId} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-bold text-slate-800 dark:text-slate-100">{row.productName}</div>
                            <div className="text-sm font-black text-emerald-600">{formatMoney(row.revenue)} $</div>
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                            الكمية: {Number(row.quantity || 0).toLocaleString()} | الطلبات: {Number(row.ordersCount || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3">
                    <div className="font-black text-slate-800 dark:text-white">التوزيع اليومي للمبيعات</div>
                    <div className="text-xs text-slate-500 dark:text-slate-300">متابعة الأداء يومًا بيوم داخل الشهر</div>
                  </div>
                  {financialReportData.dailySalesBreakdown.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-300">لا توجد حركة يومية في هذا الشهر.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-300">
                            <th className="px-3 py-2 text-right">التاريخ</th>
                            <th className="px-3 py-2 text-right">الكمية</th>
                            <th className="px-3 py-2 text-right">الطلبات</th>
                            <th className="px-3 py-2 text-right">الإيراد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialReportData.dailySalesBreakdown.map((row) => (
                            <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800/70">
                              <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{new Date(row.date).toLocaleDateString("ar-EG")}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{Number(row.quantity || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{Number(row.ordersCount || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 font-bold text-blue-600">{formatMoney(row.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3">
                  <div className="font-black text-slate-800 dark:text-white">تفصيل الحالات</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300">عدد الطلبات وقيمتها حسب حالة الطلب</div>
                </div>
                {financialReportData.statusBreakdown.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-300">لا توجد حالات مسجلة في هذا الشهر.</div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {financialReportData.statusBreakdown.map((row) => (
                      <div key={row.status} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{row.status}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">الطلبات: {Number(row.count || 0).toLocaleString()}</div>
                        <div className="text-sm font-black text-violet-600">{formatMoney(row.amount)} $</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppModal>

      <AppModal
        title="تعيين موظف مسؤول لعدة موظفين"
        isOpen={isAssignManagerOpen}
        onClose={() => setIsAssignManagerOpen(false)}
      >
        <div className="p-4 grid gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold dark:text-slate-300">الموظف المسؤول</label>
            <select
              className={selectClasses}
              value={assignManagerId}
              onChange={(e) => {
                const nextManagerId = String(e.target.value || "");
                setAssignManagerId(nextManagerId);
                setSelectedEmployeeIds(getLinkedEmployeesByManager(nextManagerId));
              }}
              disabled={assignSaving}
            >
              <option value="">اختر الموظف المسؤول...</option>
              {nonAdminUsers.map((row: any) => (
                <option key={row.id} value={row.id}>{row.username}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold dark:text-slate-300">الموظفون المراد ربطهم / فك ارتباطهم</label>
            <div className="max-h-64 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 p-2 grid gap-2">
              {assignableEmployees.length === 0 && (
                <div className="text-sm text-slate-500">لا يوجد موظفون متاحون للتعيين.</div>
              )}
              {assignableEmployees.map((employee: any) => {
                const employeeId = String(employee.id);
                const checked = selectedEmployeeIds.includes(employeeId);
                return (
                  <label key={employeeId} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={(e) => toggleEmployeeSelection(employeeId, e.target.checked)}
                      disabled={assignSaving || !assignManagerId}
                    />
                    <span>{employee.username}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleUnassignManager}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={assignSaving || selectedEmployeeIds.length === 0}
            >
              فك الارتباط
            </Button>
            <Button
              onClick={handleAssignManager}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={assignSaving || !assignManagerId || selectedEmployeeIds.length === 0}
            >
              حفظ التعيين
            </Button>
          </div>
        </div>
      </AppModal>

      <AppModal
        title={editId ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد"}
        isOpen={isOpen}
        onClose={handleClose}
      >
        <div className="p-2 max-h-[80vh]">
          <DynamicForm
            schema={userSchema}
            onSubmit={onSubmit}
            defaultValues={formData} // تمرير البيانات الافتراضية عند التعديل
            key={editId || 'create'} // لإعادة بناء الفورم عند التبديل بين تعديل وإضافة
            submitLabel={editId ? 'تحديث البيانات' : 'إرسال البيانات'}
          >
            {({ register, control, formState: { errors } }) => (
              <div className="grid gap-4">
                <FormInput className='text-gray-800 dark:text-white' label="اسم المستخدم" {...register("username")} error={errors.username?.message as string} />
                <FormInput className='text-gray-800 dark:text-white' label="البريد الإلكتروني" {...register("email")} error={errors.email?.message as string} />
                <FormInput className='text-gray-800 dark:text-white' label="ملاحظات الموظف" {...register("notes")} error={errors.notes?.message as string} />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">رقم الهاتف</label>
                  <div className="dir-ltr">
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <PhoneInput
                          international
                          withCountryCallingCode
                          defaultCountry="SY"
                          value={typeof value === "string" ? value : undefined}
                          onChange={(nextValue) => onChange(nextValue ?? "")}
                          className="PhoneInputCustom"
                          numberInputProps={{
                            className: "w-full bg-white dark:bg-slate-900 p-3 rounded-md border border-gray-300 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-900 dark:text-slate-200"
                          }}
                        />
                      )}
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone.message as string}</p>}
                </div>
                <FormInput className='text-gray-800 dark:text-white' label="كلمة المرور" type="password" {...register("password")} placeholder={editId ? "اتركها فارغة لعدم التغيير" : ""} error={errors.password?.message as string} />
                <FormInput className='text-gray-800 dark:text-white' label="المسمى الوظيفي" {...register("jobTitle")} error={errors.jobTitle?.message as string} />
                <FormInput
                  className='text-gray-800 dark:text-white'
                  label="نسبة عمولة المبيعات (%)"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]+([.,][0-9]+)?"
                  min={0}
                  {...register("salesCommissionPercent")}
                  error={errors.salesCommissionPercent?.message as string}
                />
                <FormInput
                  className='text-gray-800 dark:text-white'
                  label="البدل الثابت"
                  type="number"
                  step="1"
                  min={0}
                  {...register("wage")}
                  error={errors.wage?.message as string}
                />

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">نوع الحساب</label>
                  <select className={selectClasses} {...register("accountType")}>
                    <option value="ADMIN">مشرف نظام</option>
                    <option value="MANAGER">مدير</option>
                    <option value="STAFF">موظف</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  <input type="checkbox" className="h-4 w-4" {...register("isAffiliate")} />
                  <span>هذا الحساب أفلييت ويحتاج موافقة الأدمن قبل الاستخدام</span>
                </label>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">مجموعة الصلاحيات</label>
                  <select className={selectClasses} {...register("permissions")}>
                    <option value="">اختر الصلاحية...</option>
                    {roles.map((role: any) => (
                      <option key={role.id} value={role.id}>{role.roleName}</option>
                    ))}
                  </select>
                  {errors.permissions && <p className="text-red-500 text-xs">{errors.permissions.message as string}</p>}
                </div>

              </div>
            )}
          </DynamicForm>
        </div>
      </AppModal>

      <AppModal
        title={targetMode === "assign" ? "تعيين تاركت المبيعات والمنتجات" : "تعديل تاركت المبيعات والمنتجات"}
        isOpen={isSalesTargetOpen}
        size='xl'
        onClose={() => setIsSalesTargetOpen(false)}
      >
        <div className="p-4">
          {targetMode === "edit" && (!targetUser?.targets || targetUser.targets.length === 0) ? (
            <div className="text-sm text-slate-500">لا يوجد منتجات مرتبطة بتاركت لهذا المستخدم.</div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">قيمة المبيعات المستهدفة</label>
                  <input
                    type="text"
                    placeholder="مثال: 1000, 2000"
                    className={selectClasses}
                    value={salesTargetValue}
                    onChange={(e) => setSalesTargetValue(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold dark:text-slate-300">مكافأة قيمة المبيعات</label>
                  <input
                    type="text"
                    placeholder="مثال: 100, 200"
                    className={selectClasses}
                    value={salesRewardValue}
                    onChange={(e) => setSalesRewardValue(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-semibold dark:text-slate-300">تاريخ بداية التاركت</label>
                  <input
                    type="date"
                    className={selectClasses}
                    value={salesTargetStartDate}
                    onChange={(e) => setSalesTargetStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold dark:text-slate-300">المنتجات المستهدفة</div>
                <Button onClick={addTargetItem} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  إضافة منتج
                </Button>
              </div>

              {targetItems.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-4">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-sm font-semibold dark:text-slate-300">المنتج</label>
                    <select
                      className={selectClasses}
                      value={item.productId}
                      onChange={(e) => updateTargetItem(index, { productId: e.target.value })}
                    >
                      <option value="">اختر المنتج...</option>
                      {products.map((product: any) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold dark:text-slate-300">الكمية</label>
                    <input
                      type="number"
                      min={1}
                      className={selectClasses}
                      value={item.requiredQty}
                      onChange={(e) => updateTargetItem(index, { requiredQty: Number(e.target.value) })}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold dark:text-slate-300">مكافأة المنتج</label>
                    <input
                      type="number"
                      min={0}
                      className={selectClasses}
                      value={item.rewardValue}
                      onChange={(e) => updateTargetItem(index, { rewardValue: Number(e.target.value) })}
                    />
                  </div>

                  <div className="flex items-center justify-end sm:col-span-4">
                    {targetItems.length > 1 && (
                      <Button
                        variant="danger"
                        onClick={() => removeTargetItem(index)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 justify-end">
                <Button onClick={handleSaveSalesTarget} className="bg-blue-600 hover:bg-blue-700 text-white">
                  حفظ
                </Button>
              </div>
            </div>
          )}
        </div>
      </AppModal>

      <AppModal
        title="تاركت النشاط (العملاء والتواصل)"
        isOpen={isActivityTargetOpen}
        size='xl'
        onClose={() => setIsActivityTargetOpen(false)}
      >
        <div className="p-4">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">إعدادات تاركت النشاط</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">نوع التاركت</label>
                <select
                  className={selectClasses}
                  value={activityCycle}
                  onChange={(e) => setActivityCycle(e.target.value as "DAILY" | "MONTHLY")}
                >
                  <option value="DAILY">يومي</option>
                  <option value="MONTHLY">شهري</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">تاريخ البدء</label>
                <input
                  type="date"
                  className={selectClasses}
                  value={activityTargetStartDate}
                  onChange={(e) => setActivityTargetStartDate(e.target.value)}
                />
              </div>

              {activityCycle === "DAILY" && (
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-semibold dark:text-slate-300">أيام الأسبوع المحتسبة</label>
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-4">
                    {ACTIVITY_WEEKDAY_OPTIONS.map((day) => (
                      <label key={day.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={activityWeekDays.includes(day.value)}
                          onChange={(e) => toggleActivityWeekDay(day.value, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span>{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">عدد العملاء المطلوب</label>
                <input
                  type="number"
                  min={0}
                  className={selectClasses}
                  value={requiredCustomersTarget}
                  onChange={(e) => setRequiredCustomersTarget(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">مكافأة تحقيق العملاء</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={selectClasses}
                  value={customerRewardTarget}
                  onChange={(e) => setCustomerRewardTarget(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">خصم ثابت عند عدم تحقيق العملاء</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={selectClasses}
                  value={customerMissPenaltyAmountTarget}
                  onChange={(e) => setCustomerMissPenaltyAmountTarget(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">عدد التواصل المطلوب</label>
                <input
                  type="number"
                  min={0}
                  className={selectClasses}
                  value={requiredCommunicationsTarget}
                  onChange={(e) => setRequiredCommunicationsTarget(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">مكافأة تحقيق التواصل</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={selectClasses}
                  value={communicationRewardTarget}
                  onChange={(e) => setCommunicationRewardTarget(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold dark:text-slate-300">خصم ثابت عند عدم تحقيق التواصل</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={selectClasses}
                  value={communicationMissPenaltyAmountTarget}
                  onChange={(e) => setCommunicationMissPenaltyAmountTarget(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Button onClick={handleSaveActivityTarget} className="bg-blue-600 hover:bg-blue-700 text-white">
                حفظ تاركت النشاط
              </Button>
            </div>
          </div>
        </div>
      </AppModal>
    </div>
  );
};

export default UserManagement;