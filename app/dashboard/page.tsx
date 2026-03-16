"use client";

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { GetEmployeeActivitySummary, GetUserTargetProgress } from '@/server/analytics';
import { createUserTarget, deleteProductTargetRow, deleteSalesTargetRow, getUserActivityTargetProgress, updateUserTarget } from '@/server/user';
import { getProduct } from '@/server/product';
import toast from 'react-hot-toast';

const DashboardPage: React.FunctionComponent = () => {
  const { user } = useAuth();
  const canManageTargets = user?.accountType === "ADMIN";
  const [loading, setLoading] = React.useState(false);
  const [activityFilterPreset, setActivityFilterPreset] = React.useState<"day" | "week" | "month" | "custom">("day");
  const [activityCustomStartDate, setActivityCustomStartDate] = React.useState<string>("");
  const [activityCustomEndDate, setActivityCustomEndDate] = React.useState<string>("");
  const [activitySummary, setActivitySummary] = React.useState<{
    success: boolean;
    data: {
      communicatedMessages: number;
      createdOrders: number;
      addedCustomers: number;
      userName?: string;
    } | null;
  }>({ success: true, data: null });
  const [targetProgress, setTargetProgress] = React.useState<{
    success: boolean;
    data: Array<{
      targetId: string;
      userId?: string;
      userName?: string;
      targetCreatedAt?: string | Date;
      targetEndedAt?: string | Date | null;
      salesTargetValue?: number[];
      salesRewardValue?: number[];
      productId: number;
      productName: string;
      requiredQty: number;
      rewardValue?: number;
      soldQty: number;
      soldAmount?: number;
      remaining: number;
      reached: boolean;
      isValueOnly?: boolean;
    }>;
    summary?: {
      totalSalesAmount: number;
      totalOrdersCount: number;
      deliveredOrdersCount?: number;
      totalCommissionAmount: number;
      commissionPercent: number;
      assignedCommissionPercent: number;
    };
    error?: string;
  }>({ success: true, data: [] });

  const [editTargets, setEditTargets] = React.useState<Record<string, {
    salesTargetValues: number[];
    salesRewardValues: number[];
    products: Record<number, { requiredQty: number; rewardValue: number }>;
    startDate: string;
    endDate: string;
    saving?: boolean;
  }>>({});
  const [products, setProducts] = React.useState<any[]>([]);
  const [usersList, setUsersList] = React.useState<any[]>([]);
  const [showCreateTarget, setShowCreateTarget] = React.useState(false);
  const [newTargetUserId, setNewTargetUserId] = React.useState("");
  const [newSalesTargetInput, setNewSalesTargetInput] = React.useState("");
  const [newSalesRewardInput, setNewSalesRewardInput] = React.useState("");
  const [newTargetStartDate, setNewTargetStartDate] = React.useState<string>(
  () => new Date().toISOString().slice(0, 10)
);
  const [newTargetEndDate, setNewTargetEndDate] = React.useState("");
  const [newProducts, setNewProducts] = React.useState<Array<{ productId: string; requiredQty: number; rewardValue: number }>>([
    { productId: "", requiredQty: 1, rewardValue: 0 },
  ]);
  const [creatingTarget, setCreatingTarget] = React.useState(false);
  const [activityTargetToday, setActivityTargetToday] = React.useState<any | null>(null);

  const isInvalidActivityCustomRange =
    activityFilterPreset === "custom" &&
    Boolean(activityCustomStartDate) &&
    Boolean(activityCustomEndDate) &&
    new Date(activityCustomStartDate) > new Date(activityCustomEndDate);

  const activityFilter = React.useMemo(() => {
    if (activityFilterPreset === "custom") {
      return {
        period: "custom" as const,
        startDate: activityCustomStartDate || undefined,
        endDate: activityCustomEndDate || undefined,
      };
    }

    return { period: activityFilterPreset };
  }, [activityFilterPreset, activityCustomStartDate, activityCustomEndDate]);

  const sumNumbers = (values?: number[] | null) =>
    Array.isArray(values) ? values.reduce((sum, value) => sum + (Number(value) || 0), 0) : 0;

  const [monthFilterPreset, setMonthFilterPreset] = React.useState<"this_month" | "last_month" | "custom">("this_month");
  const [customMonth, setCustomMonth] = React.useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [targetPeriod, setTargetPeriod] = React.useState<"day" | "week" | "month" | "custom">("month");
  const [customTargetStartDate, setCustomTargetStartDate] = React.useState<string>(new Date().toISOString().slice(0,10));
  const [customTargetEndDate, setCustomTargetEndDate] = React.useState<string>(new Date().toISOString().slice(0,10));

  const selectedMonth = React.useMemo(() => {
    const now = new Date();
    if (monthFilterPreset === "this_month") {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    if (monthFilterPreset === "last_month") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    }
    return customMonth;
  }, [monthFilterPreset, customMonth]);

  const monthKey = (value?: string | Date) => {
    if (!value) return "unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "unknown";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const parseNumberList = (value: string) =>
    value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));

  const getDaysLeftInMonth = (key: string) => {
    if (key === "all" || key === "unknown") return null;
    const [yearStr, monthStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return null;
    const lastDay = new Date(year, month, 0);
    const today = new Date();
    const endOfDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999);
    const diffMs = endOfDay.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  const filteredTargets = React.useMemo(() => {
    return (targetProgress.data ?? []).filter((item) => monthKey(item.targetCreatedAt) === selectedMonth);
  }, [selectedMonth, targetProgress.data]);

  const filteredProductTargets = React.useMemo(() => {
    return filteredTargets.filter((item) => !item.isValueOnly);
  }, [filteredTargets]);

  React.useEffect(() => {
    const next: Record<string, {
      salesTargetValues: number[];
      salesRewardValues: number[];
      products: Record<number, { requiredQty: number; rewardValue: number }>;
      startDate: string;
      endDate: string;
      saving?: boolean;
    }> = {};

    (targetProgress.data ?? []).forEach((item) => {
      const targetId = item.targetId;
      if (!next[targetId]) {
        next[targetId] = {
          salesTargetValues: Array.isArray(item.salesTargetValue) ? item.salesTargetValue : [],
          salesRewardValues: Array.isArray(item.salesRewardValue) ? item.salesRewardValue : [],
          products: {},
          startDate: item.targetCreatedAt ? new Date(item.targetCreatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          endDate: item.targetEndedAt ? new Date(item.targetEndedAt).toISOString().slice(0, 10) : "",
        };
      }
      if (!next[targetId].salesTargetValues.length && Array.isArray(item.salesTargetValue)) {
        next[targetId].salesTargetValues = item.salesTargetValue;
      }
      if (!next[targetId].salesRewardValues.length && Array.isArray(item.salesRewardValue)) {
        next[targetId].salesRewardValues = item.salesRewardValue;
      }
      if (!item.isValueOnly && item.productId) {
        next[targetId].products[item.productId] = {
          requiredQty: Number(item.requiredQty) || 0,
          rewardValue: Number(item.rewardValue) || 0,
        };
      }
    });

    setEditTargets(next);
  }, [targetProgress.data]);

  const updateSalesValue = (targetId: string, index: number, field: "target" | "reward", value: string) => {
    const numeric = Number(value) || 0;
    setEditTargets((prev) => {
      const current = prev[targetId] || { salesTargetValues: [], salesRewardValues: [], products: {}, startDate: new Date().toISOString().slice(0, 10), endDate: "" };
      const targets = [...current.salesTargetValues];
      const rewards = [...current.salesRewardValues];
      if (field === "target") {
        targets[index] = numeric;
      } else {
        rewards[index] = numeric;
      }
      return {
        ...prev,
        [targetId]: { ...current, salesTargetValues: targets, salesRewardValues: rewards },
      };
    });
  };

  const updateProductValue = (targetId: string, productId: number, field: "requiredQty" | "rewardValue", value: string) => {
    const numeric = Number(value) || 0;
    setEditTargets((prev) => {
      const current = prev[targetId] || { salesTargetValues: [], salesRewardValues: [], products: {}, startDate: new Date().toISOString().slice(0, 10), endDate: "" };
      const products = { ...current.products };
      const existing = products[productId] || { requiredQty: 0, rewardValue: 0 };
      products[productId] = { ...existing, [field]: numeric };
      return {
        ...prev,
        [targetId]: { ...current, products },
      };
    });
  };

  const updateTargetDate = (targetId: string, field: "startDate" | "endDate", value: string) => {
    setEditTargets((prev) => {
      const current = prev[targetId] || { salesTargetValues: [], salesRewardValues: [], products: {}, startDate: new Date().toISOString().slice(0, 10), endDate: "" };
      return {
        ...prev,
        [targetId]: { ...current, [field]: value },
      };
    });
  };

  const saveTarget = async (targetId: string) => {
    if (!canManageTargets) {
      toast.error("غير مسموح بالتعديل");
      return;
    }
    const current = editTargets[targetId];
    if (!current) return;
    setEditTargets((prev) => ({
      ...prev,
      [targetId]: { ...current, saving: true },
    }));

    const payload = {
      salesTargetValue: current.salesTargetValues,
      salesRewardValue: current.salesRewardValues,
      startDate: current.startDate,
      endDate: current.endDate,
      products: Object.entries(current.products).map(([productId, values]) => ({
        productId: Number(productId),
        requiredQty: values.requiredQty,
        rewardValue: values.rewardValue,
      })),
    };

    const res = await updateUserTarget(targetId, payload);
    if (res?.success) {
      toast.success("تم تحديث التاركت");
      // const refreshed = await GetUserTargetProgress(user?.id || "", selectedMonth);
      // setTargetProgress(refreshed as any);
    } else {
      toast.error(res?.error || "فشل تحديث التاركت");
    }

    setEditTargets((prev) => ({
      ...prev,
      [targetId]: { ...current, saving: false },
    }));
  };

  const handleDeleteSalesRow = async (targetId: string, rowIndex: number) => {
    if (!canManageTargets) return;
    const confirmed = window.confirm("هل تريد حذف هذا الصف من تاركت المبيعات؟");
    if (!confirmed) return;

    const res = await deleteSalesTargetRow(targetId, rowIndex);
    if (res?.success) {
      toast.success("تم حذف الصف");
      // const refreshed = await GetUserTargetProgress(user?.id || "", selectedMonth);
      // setTargetProgress(refreshed as any);
    } else {
      toast.error(res?.error || "فشل حذف الصف");
    }
  };

  const handleDeleteProductRow = async (targetId: string, productId: number) => {
    if (!canManageTargets) return;
    const confirmed = window.confirm("هل تريد حذف هذا الصف من تاركت المنتجات؟");
    if (!confirmed) return;

    const res = await deleteProductTargetRow(targetId, productId);
    if (res?.success) {
      toast.success("تم حذف الصف");
      // const refreshed = await GetUserTargetProgress(user?.id || "", selectedMonth);
      // setTargetProgress(refreshed as any);
    } else {
      toast.error(res?.error || "فشل حذف الصف");
    }
  };

  const addNewProductRow = () => {
    setNewProducts((prev) => [...prev, { productId: "", requiredQty: 1, rewardValue: 0 }]);
  };

  const removeNewProductRow = (index: number) => {
    setNewProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateNewProductRow = (index: number, patch: Partial<{ productId: string; requiredQty: number; rewardValue: number }>) => {
    setNewProducts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleCreateTarget = async () => {
    if (!canManageTargets) {
      toast.error("غير مسموح بإضافة التاركت");
      return;
    }
    if (!user?.id) return;
    const targetUserId = user.accountType === "ADMIN" ? (newTargetUserId || user.id) : user.id;
    const salesTargetValue = parseNumberList(newSalesTargetInput);
    const salesRewardValue = parseNumberList(newSalesRewardInput);
    const selectedProducts = newProducts.filter((item) => Boolean(item.productId));

    if (salesTargetValue.length === 0 && selectedProducts.length === 0) {
      toast.error("أدخل تاركت المبيعات أو منتجات التاركت على الأقل");
      return;
    }

    setCreatingTarget(true);
    const res = await createUserTarget({
      userId: targetUserId,
      salesTargetValue,
      salesRewardValue,
      startDate: newTargetStartDate,
      endDate: newTargetEndDate,
      products: selectedProducts.map((item) => ({
        productId: Number(item.productId),
        requiredQty: Number(item.requiredQty) || 0,
        rewardValue: Number(item.rewardValue) || 0,
      })),
    });

    if (res?.success) {
      toast.success("تم إنشاء التاركت");
      setNewSalesTargetInput("");
      setNewSalesRewardInput("");
      setNewTargetStartDate(new Date().toISOString().slice(0, 10));
      setNewTargetEndDate("");
      setNewProducts([{ productId: "", requiredQty: 1, rewardValue: 0 }]);
      // const refreshed = await GetUserTargetProgress(user.id, selectedMonth);
      // setTargetProgress(refreshed as any);
    } else {
      toast.error(res?.error || "فشل إنشاء التاركت");
    }
    setCreatingTarget(false);
  };

  const valueTargets = React.useMemo(() => {
    const map = new Map<string, {
      targetId: string;
      userId: string;
      userName: string;
      salesTargetValue: number[];
      salesRewardValue: number[];
      soldAmount: number;
    }>();

    filteredTargets.forEach((item) => {
      const key = item.targetId;
      const current = map.get(key) || {
        targetId: key,
        userId: item.userId || "me",
        userName: item.userName || "-",
        salesTargetValue: Array.isArray(item.salesTargetValue) ? item.salesTargetValue : [],
        salesRewardValue: Array.isArray(item.salesRewardValue) ? item.salesRewardValue : [],
        soldAmount: 0,
      };
      current.soldAmount = Math.max(current.soldAmount, item.soldAmount || 0);
      if (!current.salesTargetValue.length && Array.isArray(item.salesTargetValue)) {
        current.salesTargetValue = item.salesTargetValue;
      }
      if (!current.salesRewardValue.length && Array.isArray(item.salesRewardValue)) {
        current.salesRewardValue = item.salesRewardValue;
      }
      map.set(key, current);
    });

    return Array.from(map.values()).flatMap((row) => {
      const targets = (row.salesTargetValue || []).filter((value) => Number(value) > 0);
      if (targets.length === 0) {
        return [];
      }
      const rewards = row.salesRewardValue.length ? row.salesRewardValue : [];
      const rowCount = targets.length;
      return Array.from({ length: rowCount }).map((_, index) => ({
        ...row,
        rewardValue: rewards[index] ?? 0,
        targetValue: targets[index] ?? 0,
        rewardIndex: index,
      }));
    });
  }, [filteredTargets]);

  const { totalSalesReward, productRewardTotal, valueRewardTotal } = React.useMemo(() => {
    const currentUserId = user?.id;
    const valueRewards = valueTargets.reduce((sum, row) => {
      if (currentUserId && row.userId !== currentUserId) return sum;
      const reached = row.soldAmount >= row.targetValue && row.targetValue > 0;
      return reached ? sum + (Number(row.rewardValue) || 0) : sum;
    }, 0);

    const productRewards = filteredTargets.reduce((sum, row) => {
      if (currentUserId && row.userId !== currentUserId) return sum;
      const reached = row.soldQty >= row.requiredQty && row.requiredQty > 0;
      return reached ? sum + (Number(row.rewardValue) || 0) : sum;
    }, 0);

    return {
      totalSalesReward: valueRewards + productRewards,
      productRewardTotal: productRewards,
      valueRewardTotal: valueRewards,
    };
  }, [filteredTargets, valueTargets, user?.id]);

  const wageAmount = Number(user?.wage || 0);
  const showSalesSummary = user?.accountType === "ADMIN";
  const totalEarnings = (targetProgress.summary?.totalCommissionAmount ?? 0) + totalSalesReward + wageAmount;

  React.useEffect(() => {
    const fetchTargetProgress = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const options: any = { period: targetPeriod };
        if (targetPeriod === "custom") {
          options.startDate = customTargetStartDate;
          options.endDate = customTargetEndDate;
        }
        const res = await GetUserTargetProgress(user.id, selectedMonth, options);
        setTargetProgress(res as any);
      } catch (error) {
        console.error("Error fetching target progress:", error);
        setTargetProgress({ success: false, data: [], error: "Internal Error" });
      } finally {
        setLoading(false);
      }
    };

    fetchTargetProgress();
  }, [user?.id, selectedMonth, targetPeriod, customTargetStartDate, customTargetEndDate]);

  React.useEffect(() => {
    const fetchActivitySummary = async () => {
      if (!user?.id || isInvalidActivityCustomRange) return;
      const res = await GetEmployeeActivitySummary(user.id, activityFilter);
      setActivitySummary((res as any) || { success: false, data: null });
    };

    fetchActivitySummary();
  }, [user?.id, activityFilter, isInvalidActivityCustomRange]);

  React.useEffect(() => {
    const fetchActivityTargetToday = async () => {
      if (!user?.id || isInvalidActivityCustomRange) return;
      const res = await getUserActivityTargetProgress([user.id], activityFilter);
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setActivityTargetToday(res.data[0]);
      } else {
        setActivityTargetToday(null);
      }
    };

    fetchActivityTargetToday();
  }, [user?.id, activityFilter, isInvalidActivityCustomRange]);

  React.useEffect(() => {
    getProduct().then(setProducts).catch(() => setProducts([]));
  }, []);

  React.useEffect(() => {
    if (!user || user.accountType !== "ADMIN") return;
    fetch("/api/users")
      .then((res) => res.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setUsersList(rows);
        if (!newTargetUserId && user?.id) {
          setNewTargetUserId(user.id);
        }
      })
      .catch(() => setUsersList([]));
  }, [user?.id, user?.accountType]);

  return (
    <div className="p-2 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">لوحة التحكم</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">متابعة التاركت حسب المنتج</p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">نشاطك مع العملاء</h2>
            <p className="text-xs text-slate-500">عدد الرسائل والطلبات والعملاء المضافين حسب الفترة</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">الفترة</label>
              <select
                value={activityFilterPreset}
                onChange={(e) => setActivityFilterPreset(e.target.value as "day" | "week" | "month" | "custom")}
                className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="day">اليوم</option>
                <option value="week">الأسبوع</option>
                <option value="month">الشهر</option>
                <option value="custom">مخصص</option>
              </select>
            </div>

            {activityFilterPreset === "custom" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">من تاريخ</label>
                  <input
                    type="date"
                    value={activityCustomStartDate}
                    onChange={(e) => setActivityCustomStartDate(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">إلى تاريخ</label>
                  <input
                    type="date"
                    value={activityCustomEndDate}
                    onChange={(e) => setActivityCustomEndDate(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {isInvalidActivityCustomRange && (
          <p className="mt-2 text-xs font-bold text-red-500">تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.</p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-500">الرسائل المتواصَل بها</div>
            <div className="mt-1 text-2xl font-black text-blue-600">{Number(activitySummary.data?.communicatedMessages || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-500">الطلبات المُنشأة بواسطتك</div>
            <div className="mt-1 text-2xl font-black text-emerald-600">{Number(activitySummary.data?.createdOrders || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-500">العملاء المضافون</div>
            <div className="mt-1 text-2xl font-black text-violet-600">{Number(activitySummary.data?.addedCustomers || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {activityFilterPreset === "day" ? "مهامي اليوم" : "مهامي ضمن الفترة"}
            </div>
            <div className="text-xs text-slate-500">
              {activityTargetToday
                ? (activityTargetToday.cycle === "MONTHLY" ? "الدورية: شهري" : "الدورية: يومي")
                : "لم يتم تعيين تاركت نشاط بعد"}
            </div>
          </div>

          {activityTargetToday ? (() => {
            const custTarget = Number(activityTargetToday.customersTargetTodayOrPeriod || 0);
            const custDone   = Math.min(Number(activityTargetToday.customersTodayOrPeriod || 0), custTarget);
            const commTarget = Number(activityTargetToday.communicationsTargetTodayOrPeriod || 0);
            const commDone   = Math.min(Number(activityTargetToday.communicationsTodayOrPeriod || 0), commTarget);
            const DOT_LIMIT  = 30;
            const penalty    = Number(activityTargetToday.penaltyAmount || 0);
            const custPenalty = !activityTargetToday.customersReached && custTarget > 0
              ? Number(activityTargetToday.customerMissPenaltyAmount || 0) : 0;
            const commPenalty = !activityTargetToday.communicationsReached && commTarget > 0
              ? Number(activityTargetToday.communicationMissPenaltyAmount || 0) : 0;

            const renderDots = (total: number, filled: number, color: string) => {
              if (total === 0) return <span className="text-xs text-slate-400">لا يوجد هدف</span>;
              if (total > DOT_LIMIT) {
                const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                return (
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>{filled} / {total}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from({ length: total }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                        i < filled
                          ? `${color} border-transparent scale-110`
                          : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                      }`}
                    />
                  ))}
                </div>
              );
            };

            return (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {/* customers progress */}
                <div className={`rounded-lg border p-3 ${activityTargetToday.customersReached ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-500">تقدم إضافة العملاء</div>
                    {activityTargetToday.customersReached && (
                      <span className="text-[10px] font-bold text-violet-600 bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 rounded-full">مكتمل ✓</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="text-2xl font-black text-violet-600">{custDone}</span>
                    <span className="text-sm text-slate-400 mb-0.5">/ {custTarget}</span>
                  </div>
                  {renderDots(custTarget, custDone, "bg-violet-500")}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>المكافأة: <span className="font-bold text-emerald-600">{Number(activityTargetToday.customerReward || 0).toLocaleString()}</span></span>
                    {custPenalty > 0 && <span className="font-bold text-red-500">خسارة: -{custPenalty.toLocaleString()}</span>}
                  </div>
                </div>

                {/* communications progress */}
                <div className={`rounded-lg border p-3 ${activityTargetToday.communicationsReached ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-500">تقدم التواصل مع العملاء</div>
                    {activityTargetToday.communicationsReached && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">مكتمل ✓</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="text-2xl font-black text-blue-600">{commDone}</span>
                    <span className="text-sm text-slate-400 mb-0.5">/ {commTarget}</span>
                  </div>
                  {renderDots(commTarget, commDone, "bg-blue-500")}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>المكافأة: <span className="font-bold text-emerald-600">{Number(activityTargetToday.communicationReward || 0).toLocaleString()}</span></span>
                    {commPenalty > 0 && <span className="font-bold text-red-500">خسارة: -{commPenalty.toLocaleString()}</span>}
                  </div>
                </div>

                {/* penalty card */}
                <div className={`rounded-lg border p-3 ${penalty > 0 ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/20" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
                  <div className="text-[11px] font-semibold text-slate-500">الخسائر (عند عدم تحقيق التاركت)</div>
                  <div className={`mt-1 text-2xl font-black ${penalty > 0 ? "text-red-500" : "text-slate-400"}`}>
                    {penalty > 0 ? `-${penalty.toLocaleString()}` : "لا خسائر"}
                  </div>
                  {penalty > 0 && (
                    <div className="mt-1.5 space-y-0.5 text-[10px] text-slate-500">
                      {custPenalty > 0 && <div className="flex justify-between"><span>عملاء غير مكتملين</span><span className="font-bold text-red-500">-{custPenalty.toLocaleString()}</span></div>}
                      {commPenalty > 0 && <div className="flex justify-between"><span>تواصل غير مكتمل</span><span className="font-bold text-red-500">-{commPenalty.toLocaleString()}</span></div>}
                    </div>
                  )}
                </div>

                {/* reward card */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-semibold text-slate-500">المكافأة الصافية المحققة</div>
                  <div className="mt-1 text-2xl font-black text-emerald-600">{Number(activityTargetToday.totalRewardEarned || 0).toLocaleString()}</div>
                  {activityTargetToday.cycle === "DAILY" && (Number(activityTargetToday.carryOverCustomers || 0) > 0 || Number(activityTargetToday.carryOverCommunications || 0) > 0) && (
                    <div className="mt-1 text-[10px] text-slate-500">
                      ترحيل: عملاء +{Number(activityTargetToday.carryOverCustomers || 0).toLocaleString()} - تواصل +{Number(activityTargetToday.carryOverCommunications || 0).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })() : null}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">تقدم التاركت</h2>
          {loading && <span className="text-xs text-slate-500">جاري التحميل...</span>}
        </div>

        {canManageTargets && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">إضافة تاركت من الداشبورد</div>
            <button
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
              onClick={() => setShowCreateTarget((prev) => !prev)}
            >
              {showCreateTarget ? "إخفاء" : "إضافة تاركت"}
            </button>
          </div>

          {showCreateTarget && (
            <div className="grid gap-3">
              {user?.accountType === "ADMIN" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">الموظف</label>
                  <select
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={newTargetUserId}
                    onChange={(e) => setNewTargetUserId(e.target.value)}
                  >
                    <option value="">اختر الموظف</option>
                    {usersList.map((row: any) => (
                      <option key={row.id} value={row.id}>{row.username}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">تاركت المبيعات</label>
                  <input
                    type="text"
                    placeholder="مثال: 100, 300"
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={newSalesTargetInput}
                    onChange={(e) => setNewSalesTargetInput(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">مكافأة المبيعات</label>
                  <input
                    type="text"
                    placeholder="مثال: 10, 20"
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={newSalesRewardInput}
                    onChange={(e) => setNewSalesRewardInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">تاريخ بدء التاركت</label>
                  <input
                    type="date"
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={newTargetStartDate}
                    onChange={(e) => setNewTargetStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">تاريخ نهاية التاركت</label>
                  <input
                    type="date"
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={newTargetEndDate}
                    onChange={(e) => setNewTargetEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">منتجات التاركت (اختياري)</div>
              <div className="hidden sm:grid sm:grid-cols-4 gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <div className="sm:col-span-2">المنتج</div>
                <div>الكمية المطلوبة</div>
                <div>مكافأة المنتج</div>
              </div>
              {newProducts.map((row, index) => (
                <div key={`${row.productId}-${index}`} className="grid gap-2 sm:grid-cols-4">
                  <select
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2"
                    value={row.productId}
                    onChange={(e) => updateNewProductRow(index, { productId: e.target.value })}
                  >
                    <option value="">اختر المنتج...</option>
                    {products.map((product: any) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={row.requiredQty}
                    onChange={(e) => updateNewProductRow(index, { requiredQty: Number(e.target.value) || 0 })}
                    placeholder="الكمية"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      value={row.rewardValue}
                      onChange={(e) => updateNewProductRow(index, { rewardValue: Number(e.target.value) || 0 })}
                      placeholder="المكافأة"
                    />
                    {newProducts.length > 1 && (
                      <button
                        className="rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white hover:bg-rose-700"
                        onClick={() => removeNewProductRow(index)}
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                  onClick={addNewProductRow}
                >
                  إضافة منتج
                </button>
                <button
                  className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                  onClick={handleCreateTarget}
                  disabled={creatingTarget}
                >
                  حفظ التاركت
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {!loading && (!targetProgress.success || filteredTargets.length === 0) && (
          <div className="text-sm text-slate-500">لا يوجد تاركت مضاف لهذا المستخدم.</div>
        )}

        {targetProgress.success && (
          <div className="overflow-x-auto">
            <div className="mb-6 grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-right shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-semibold text-slate-500">{showSalesSummary ? "إجمالي المبيعات" : "عدد الطلبات الكلي"}</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {showSalesSummary
                    ? (targetProgress.summary?.totalSalesAmount ?? 0).toFixed(2)
                    : String(targetProgress.summary?.totalOrdersCount ?? 0)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-right shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-semibold text-slate-500">{showSalesSummary ? "النسبة المعيّنة" : "تم تسليمها"}</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {showSalesSummary
                    ? `${(targetProgress.summary?.assignedCommissionPercent ?? 0).toFixed(2)}%`
                    : String(targetProgress.summary?.deliveredOrdersCount ?? 0)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-right shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-semibold text-slate-500">البدل الثابت</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {wageAmount.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-right shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-semibold text-slate-500">قيمة العمولة</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {(targetProgress.summary?.totalCommissionAmount ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500">إجمالي أرباحك</div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white">
                    {totalEarnings.toFixed(2)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <div>قيمة العمولة: {(targetProgress.summary?.totalCommissionAmount ?? 0).toFixed(2)}</div>
                  <div>مكافأة المنتجات: {productRewardTotal.toFixed(2)}</div>
                  <div>مكافأة قيمة المبيعات: {valueRewardTotal.toFixed(2)}</div>
                  <div>البدل الثابت: {wageAmount.toFixed(2)}</div>
                  <div>نسبة الأرباح: {(targetProgress.summary?.assignedCommissionPercent ?? 0).toFixed(2)}%</div>
                </div>
              </div>
            </div>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <label className="text-xs font-bold text-slate-500">عرض التاركت حسب الفترة</label>
                  <select
                    value={targetPeriod}
                    onChange={(e) => setTargetPeriod(e.target.value as "day" | "week" | "month" | "custom")}
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="day">اليوم</option>
                    <option value="week">الأسبوع</option>
                    <option value="month">الشهر</option>
                    <option value="custom">مخصص</option>
                  </select>
                </div>

                {targetPeriod === "custom" && (
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500">من تاريخ</label>
                      <input
                        type="date"
                        className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        value={customTargetStartDate}
                        onChange={(e) => setCustomTargetStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500">إلى تاريخ</label>
                      <input
                        type="date"
                        className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        value={customTargetEndDate}
                        onChange={(e) => setCustomTargetEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1 min-w-[220px]">
                  <label className="text-xs font-bold text-slate-500">عرض التاركت حسب الشهر</label>
                  <select
                    value={monthFilterPreset}
                    onChange={(e) => setMonthFilterPreset(e.target.value as "this_month" | "last_month" | "custom")}
                    className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="this_month">هذا الشهر</option>
                    <option value="last_month">الشهر الماضي</option>
                    <option value="custom">مخصص</option>
                  </select>
                </div>

                {monthFilterPreset === "custom" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500">اختر الشهر</label>
                    <input
                      type="month"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                )}

                <span className="text-xs text-slate-500 md:mr-auto">
                  باقي {getDaysLeftInMonth(selectedMonth)} يوم لنهاية الشهر
                </span>
              </div>
            </div>

            {valueTargets.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">تاركت قيمة المبيعات</h3>
                <div className="overflow-auto line-clamp-2 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      {user?.accountType === "ADMIN" && <th className="py-3 px-3">الموظف</th>}
                      <th className="py-3 px-3">قيمة المبيعات المستهدفة</th>
                      <th className="py-3 px-3">قيمة المبيعات المحققة</th>
                      <th className="py-3 px-3">المتبقي</th>
                      <th className="py-3 px-3 text-emerald-700 dark:text-emerald-300">المكافأة</th>
                      <th className="py-3 px-3">الحالة</th>
                      {canManageTargets && <th className="py-3 px-3">حفظ</th>}
                      {canManageTargets && <th className="py-3 px-3">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {valueTargets.map((row) => {
                      const remaining = Math.max(row.targetValue - row.soldAmount, 0);
                      const reached = row.soldAmount >= row.targetValue && row.targetValue > 0;
                      const isRewardRow = reached && (Number(row.rewardValue) || 0) > 0;
                      return (
                        <tr
                          key={`${row.targetId}-${row.rewardIndex}`}
                          className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60 ${isRewardRow
                            ? "bg-emerald-50/70 dark:bg-emerald-900/20"
                            : "odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-950 dark:even:bg-slate-900/30"
                            }`}
                        >
                          {user?.accountType === "ADMIN" && (
                            <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                              {row.userName}
                            </td>
                          )}
                          <td className="py-3 px-3">
                            {canManageTargets ? (
                              <input
                                type="number"
                                min={0}
                                className="w-24 rounded-md border border-slate-300 bg-white p-1 text-center text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                value={editTargets[row.targetId]?.salesTargetValues?.[row.rewardIndex] ?? row.targetValue}
                                onChange={(e) => updateSalesValue(row.targetId, row.rewardIndex, "target", e.target.value)}
                              />
                            ) : (
                              <span>{row.targetValue}</span>
                            )}
                          </td>
                          <td className="py-3 px-3">{row.soldAmount.toFixed(2)}</td>
                          <td className="py-3 px-3">{remaining.toFixed(2)}</td>
                          <td className="py-3 px-3">
                            {canManageTargets ? (
                              <input
                                type="number"
                                min={0}
                                className="w-24 rounded-md border border-emerald-200 bg-emerald-50 p-1 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                                value={editTargets[row.targetId]?.salesRewardValues?.[row.rewardIndex] ?? row.rewardValue}
                                onChange={(e) => updateSalesValue(row.targetId, row.rewardIndex, "reward", e.target.value)}
                              />
                            ) : (
                              <span>{row.rewardValue}</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold ${reached
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}
                            >
                              {reached ? "تم الوصول" : "لم يكتمل"}
                            </span>
                          </td>
                          {canManageTargets && (
                            <td className="py-3 px-3">
                              <button
                                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                                onClick={() => saveTarget(row.targetId)}
                                disabled={editTargets[row.targetId]?.saving}
                              >
                                حفظ
                              </button>
                            </td>
                          )}
                          {canManageTargets && (
                            <td className="py-3 px-3">
                              <button
                                className="rounded-md bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700"
                                onClick={() => handleDeleteSalesRow(row.targetId, row.rewardIndex)}
                              >
                                حذف
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
            {filteredProductTargets.length > 0 && (
              <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    {user?.accountType === "ADMIN" && <th className="py-3 px-3">الموظف</th>}
                    <th className="py-3 px-3">المنتج</th>
                    <th className="py-3 px-3">المطلوب</th>
                    <th className="py-3 px-3">المباع</th>
                    <th className="py-3 px-3">المتبقي</th>
                    <th className="py-3 px-3 text-emerald-700 dark:text-emerald-300">المكافأة</th>
                    <th className="py-3 px-3">الحالة</th>
                    {canManageTargets && <th className="py-3 px-3">حفظ</th>}
                    {canManageTargets && <th className="py-3 px-3">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProductTargets.map((item) => {
                    const isRewardRow = item.reached && (Number(item.rewardValue) || 0) > 0;
                    return (
                    <tr
                      key={`${item.userId || "me"}-${item.productId}`}
                      className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60 ${isRewardRow
                        ? "bg-emerald-50/70 dark:bg-emerald-900/20"
                        : "odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-950 dark:even:bg-slate-900/30"
                        }`}
                    >
                      {user?.accountType === "ADMIN" && (
                        <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                          {item.userName || "-"}
                        </td>
                      )}
                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">{item.productName}</td>
                      <td className="py-3 px-3">
                        {canManageTargets ? (
                          <input
                            type="number"
                            min={0}
                            className="w-24 rounded-md border border-slate-300 bg-white p-1 text-center text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            value={editTargets[item.targetId]?.products?.[item.productId]?.requiredQty ?? item.requiredQty}
                            onChange={(e) => updateProductValue(item.targetId, item.productId, "requiredQty", e.target.value)}
                          />
                        ) : (
                          <span>{item.requiredQty}</span>
                        )}
                      </td>
                      
                      <td className="py-3 px-3">{item.soldQty}</td>
                      <td className="py-3 px-3">{item.remaining}</td>
                      <td className="py-3 px-3">
                        {canManageTargets ? (
                          <input
                            type="number"
                            min={0}
                            className="w-24 rounded-md border border-emerald-200 bg-emerald-50 p-1 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                            value={editTargets[item.targetId]?.products?.[item.productId]?.rewardValue ?? item.rewardValue ?? 0}
                            onChange={(e) => updateProductValue(item.targetId, item.productId, "rewardValue", e.target.value)}
                          />
                        ) : (
                          <span>{item.rewardValue ?? 0}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${item.reached
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}
                        >
                          {item.reached ? "تم الوصول" : "لم يكتمل"}
                        </span>
                      </td>
                      {canManageTargets && (
                        <td className="py-3 px-3">
                          <button
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                            onClick={() => saveTarget(item.targetId)}
                            disabled={editTargets[item.targetId]?.saving}
                          >
                            حفظ
                          </button>
                        </td>
                      )}
                      {canManageTargets && (
                        <td className="py-3 px-3">
                          <button
                            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700"
                            onClick={() => handleDeleteProductRow(item.targetId, item.productId)}
                          >
                            حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  )})}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
