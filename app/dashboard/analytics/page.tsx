"use client";

import * as React from "react";
import DynamicCard from "@/components/ui/dynamicCard";
import { useAuth } from "@/context/AuthContext";
import { getGeneralSettings } from "@/server/general-settings";
import {
  GetBestSellingProducts,
  GetCustomerAcquisitionMonth,
  GetDailyExpensesAnalytics,
  GetEmployeeCustomerReport,
  GetLowStockProducts,
  GetOrdersByCity,
  GetShippingTotalsByCompany,
  GetSalesByCity,
  GetSalesByStatusAction,
  GetSalesTimelineAction,
  GetTopSellingUsersByPermission,
} from "@/server/analytics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapPin, Package, ReceiptText, TrendingDown, TrendingUp, Trophy, Truck, Users, X } from "lucide-react";

type OrderFilterPreset = "this_month" | "last_month" | "custom";
type EmployeeReportPeriod = "day" | "week" | "month" | "custom";

type StatusSummary = {
  totalRevenue: number;
  lostRevenue: number;
  grossTotal: number;
  cancelledCount: number;
  missingInfoCount: number;
  failedReturnCount: number;
};

const DEFAULT_TURKEY_EXCHANGE_RATE = 44;

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPresetDateRange = (preset: OrderFilterPreset) => {
  const now = new Date();

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: toInputDate(start), endDate: toInputDate(end) };
  }

  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { startDate: toInputDate(start), endDate: toInputDate(end) };
};

const formatUSD = (value: number | undefined | null) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

const normalizeToUSD = (amount: number, warehouseLocation?: string | null, exchangeRate: number = DEFAULT_TURKEY_EXCHANGE_RATE) => {
  const numericAmount = Number(amount || 0);
  const safeRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : DEFAULT_TURKEY_EXCHANGE_RATE;
  return String(warehouseLocation || "").trim() === "تركيا" ? numericAmount / safeRate : numericAmount;
};

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const AnalyticPage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState<any>(null);
  const [selectedTopUser, setSelectedTopUser] = React.useState<any>(null);
  const [expandedOrderId, setExpandedOrderId] = React.useState<number | null>(null);

  const [result, setResult] = React.useState<{ success: boolean; data: any[]; summary?: StatusSummary }>({
    success: true,
    data: [],
  });
  const [country, setCountry] = React.useState<{ success: boolean; data: any[] }>({ success: true, data: [] });
  const [ordersByCity, setOrdersByCity] = React.useState<{ success: boolean; data: any[] }>({ success: true, data: [] });
  const [shippingByCompany, setShippingByCompany] = React.useState<{ success: boolean; data: any[] }>({ success: true, data: [] });
  const [dailyExpenses, setDailyExpenses] = React.useState<{ success: boolean; data: any[]; summary?: { USD: number; TRY: number; SYP: number } }>({
    success: true,
    data: [],
    summary: { USD: 0, TRY: 0, SYP: 0 },
  });
  const [topSale, setTopSale] = React.useState<{ success: boolean; data: any[] }>({ success: true, data: [] });
  const [lowStock, setLowStock] = React.useState<{ success: boolean; data: any[] }>({ success: true, data: [] });
  const [topSellingUsers, setTopSellingUsers] = React.useState<{ success: boolean; data: any[] }>({ success: true, data: [] });
  const [timelineData, setTimelineData] = React.useState<any[]>([]);
  const [msgTimeline, setMsgTimeline] = React.useState<{ success: boolean; data: any[] }>({ success: true, data: [] });
  const [employeeCustomerReport, setEmployeeCustomerReport] = React.useState<{ success: boolean; data: any[] }>({
    success: true,
    data: [],
  });
  const [employeeReportLoading, setEmployeeReportLoading] = React.useState(true);

  const [orderFilterPreset, setOrderFilterPreset] = React.useState<OrderFilterPreset>("this_month");
  const [customStartDate, setCustomStartDate] = React.useState("");
  const [customEndDate, setCustomEndDate] = React.useState("");
  const [employeeReportPeriod, setEmployeeReportPeriod] = React.useState<EmployeeReportPeriod>("month");
  const [employeeCustomStartDate, setEmployeeCustomStartDate] = React.useState("");
  const [employeeCustomEndDate, setEmployeeCustomEndDate] = React.useState("");
  const [warehouseLocationFilter, setWarehouseLocationFilter] = React.useState<"all" | "سوريا" | "تركيا">("all");
  const [turkeyExchangeRate, setTurkeyExchangeRate] = React.useState<number>(DEFAULT_TURKEY_EXCHANGE_RATE);

  const isInvalidCustomRange =
    orderFilterPreset === "custom" &&
    Boolean(customStartDate) &&
    Boolean(customEndDate) &&
    new Date(customStartDate) > new Date(customEndDate);

  const orderDateFilter = React.useMemo(() => {
    const warehouseLocation = warehouseLocationFilter === "all" ? undefined : warehouseLocationFilter;

    if (orderFilterPreset === "custom") {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
        warehouseLocation,
      };
    }

    return {
      ...getPresetDateRange(orderFilterPreset),
      warehouseLocation,
    };
  }, [orderFilterPreset, customStartDate, customEndDate, warehouseLocationFilter]);

  const employeeReportFilter = React.useMemo(() => {
    if (employeeReportPeriod === "custom") {
      return {
        period: "custom" as const,
        startDate: employeeCustomStartDate || undefined,
        endDate: employeeCustomEndDate || undefined,
      };
    }

    return { period: employeeReportPeriod };
  }, [employeeReportPeriod, employeeCustomStartDate, employeeCustomEndDate]);

  const isInvalidEmployeeCustomRange =
    employeeReportPeriod === "custom" &&
    Boolean(employeeCustomStartDate) &&
    Boolean(employeeCustomEndDate) &&
    new Date(employeeCustomStartDate) > new Date(employeeCustomEndDate);

  React.useEffect(() => {
    const loadExchangeRate = async () => {
      try {
        const res = await getGeneralSettings();
        const rate = Number(res?.data?.usdToTryRate || 0);
        if (rate > 0) {
          setTurkeyExchangeRate(rate);
        }
      } catch (error) {
      }
    };

    loadExchangeRate();
  }, []);

  React.useEffect(() => {
    const fetchAllData = async () => {
      if (!user?.id || isInvalidCustomRange || isInvalidEmployeeCustomRange) return;

      setLoading(true);
      try {
        const [
          resStatus,
          resCountry,
          resOrdersByCity,
          resShippingByCompany,
          resDailyExpenses,
          resTopSale,
          resLowStock,
          resTopUsers,
          resTimeline,
          resMsgTimeline,
        ] = await Promise.all([
          GetSalesByStatusAction(user.id, orderDateFilter),
          GetSalesByCity(user.id, orderDateFilter),
          GetOrdersByCity(user.id, orderDateFilter),
          GetShippingTotalsByCompany(user.id, orderDateFilter),
          GetDailyExpensesAnalytics(user.id, orderDateFilter),
          GetBestSellingProducts(user.id, orderDateFilter),
          GetLowStockProducts(user.id),
          GetTopSellingUsersByPermission(user.id, orderDateFilter),
          GetSalesTimelineAction(user.id, orderDateFilter),
          GetCustomerAcquisitionMonth(user.id, orderDateFilter),
        ]);

        setResult(resStatus as any);
        setCountry(resCountry as any);
        setOrdersByCity(resOrdersByCity as any);
        setShippingByCompany(resShippingByCompany as any);
        setDailyExpenses(resDailyExpenses as any);
        setTopSale(resTopSale as any);
        setLowStock(resLowStock as any);
        setTopSellingUsers(resTopUsers as any);
        setTimelineData((resTimeline as any)?.data || []);
        setMsgTimeline(resMsgTimeline as any);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user?.id, orderDateFilter, isInvalidCustomRange, isInvalidEmployeeCustomRange]);

  React.useEffect(() => {
    const fetchEmployeeReport = async () => {
      if (!user?.id || isInvalidEmployeeCustomRange) return;

      setEmployeeReportLoading(true);
      try {
        const resEmployeeReport = await GetEmployeeCustomerReport(user.id, employeeReportFilter);
        setEmployeeCustomerReport(resEmployeeReport as any);
      } catch (error) {
        console.error("Error fetching employee report:", error);
      } finally {
        setEmployeeReportLoading(false);
      }
    };

    fetchEmployeeReport();
  }, [user?.id, employeeReportFilter, isInvalidEmployeeCustomRange]);

  const cityData =
    country.data?.map((item: any) => ({
      name: item.location || "غير محدد",
      value: item._sum?.finalAmount || 0,
      count: item._count?.id || 0,
    })) || [];

  const showSalesTimeline = loading || timelineData.length > 0;
  const showCustomerGrowth = loading || (msgTimeline.data?.length || 0) > 0;
  const showSalesByCountry = loading || (country.data?.length || 0) > 0;
  const showOrdersByCity = loading || (ordersByCity.data?.length || 0) > 0;
  const showShippingByCompany = loading || (shippingByCompany.data?.length || 0) > 0;
  const showDailyExpenses = loading || (dailyExpenses.data?.length || 0) > 0;
  const showSalesGeo = loading || cityData.length > 0;
  const showTopProducts = loading || (topSale.data?.length || 0) > 0;
  const showLowStock = loading || (lowStock.data?.length || 0) > 0;
  const showTopSellingUsers = loading || (topSellingUsers.data?.length || 0) > 0;
  const showEmployeeCustomerReport = employeeReportLoading || (employeeCustomerReport.data?.length || 0) > 0;

  return (
    <div className="p-8 relative">
      <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs font-bold text-slate-500">عرض التحليلات حسب الفترة</label>
            <select
              value={orderFilterPreset}
              onChange={(e) => setOrderFilterPreset(e.target.value as OrderFilterPreset)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            >
              <option value="this_month">هذا الشهر</option>
              <option value="last_month">الشهر الماضي</option>
              <option value="custom">مخصص</option>
            </select>
          </div>

          {orderFilterPreset === "custom" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500">من تاريخ</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500">إلى تاريخ</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs font-bold text-slate-500">دولة المستودع</label>
            <select
              value={warehouseLocationFilter}
              onChange={(e) => setWarehouseLocationFilter(e.target.value as "all" | "سوريا" | "تركيا")}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            >
              <option value="all">كل المستودعات</option>
              <option value="سوريا">مستودعات سوريا</option>
              <option value="تركيا">مستودعات تركيا</option>
            </select>
          </div>
        </div>

        {isInvalidCustomRange && (
          <p className="mt-2 text-xs text-red-500 font-bold">تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.</p>
        )}
        {isInvalidEmployeeCustomRange && (
          <p className="mt-2 text-xs text-red-500 font-bold">فلتر تقرير الموظفين: تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.</p>
        )}
      </div>

      {selectedStatus && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setSelectedStatus(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">طلبات حالة: {selectedStatus.status}</h3>
                <p className="text-sm text-slate-500">الإجمالي: {formatUSD(selectedStatus.amount)}$ ({selectedStatus.count} طلب)</p>
              </div>
              <button
                onClick={() => setSelectedStatus(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-xs font-bold text-slate-400 border-b uppercase tracking-wider">
                    <th className="pb-3 px-2">رقم الطلب</th>
                    <th className="pb-3 px-2">العميل</th>
                    <th className="pb-3 px-2">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedStatus.ordersDetails?.map((order: any) => (
                    <tr key={order.id}>
                      <td className="py-3 px-2 text-sm text-blue-600 font-medium font-mono">#{order.orderNumber}</td>
                      <td className="py-3 px-2 text-sm text-slate-600 dark:text-slate-300">{order.customerName}</td>
                      <td className="py-3 px-2 text-sm font-bold text-slate-900 dark:text-white">{formatUSD(order.amount)}$</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedTopUser && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
          onClick={() => {
            setSelectedTopUser(null);
            setExpandedOrderId(null);
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">طلبات الموظف: {selectedTopUser.name}</h3>
                <p className="text-sm text-slate-500">إجمالي المبيعات: {formatUSD(selectedTopUser.totalSalesAmount)}$</p>
              </div>
              <button
                onClick={() => {
                  setSelectedTopUser(null);
                  setExpandedOrderId(null);
                }}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-3">
              {(selectedTopUser.orders || []).map((order: any) => {
                const isExpanded = expandedOrderId === Number(order.id);

                return (
                  <div key={order.id} className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId((prev) => (prev === Number(order.id) ? null : Number(order.id)))}
                      className="w-full p-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">#{order.orderNumber}</span>
                        <span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString("ar-EG")}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500">{order.customer?.name || "بدون عميل"}</span>
                        <span className="font-bold text-emerald-600">{formatUSD(order.orderAmountUSD)} $</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-slate-50/70 dark:bg-slate-900/40">
                        <div className="mb-2 text-xs font-bold text-slate-500">المنتجات المباعة في هذا الطلب</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="text-[11px] font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                <th className="py-2 px-2">المنتج</th>
                                <th className="py-2 px-2">الكمية</th>
                                <th className="py-2 px-2">السعر (USD)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {(order.items || []).map((item: any) => {
                                const netUnitPrice = Math.max(0, Number(item.price || 0) - Number(item.discount || 0));
                                const unitPriceUSD = normalizeToUSD(netUnitPrice, order.warehouse?.location, turkeyExchangeRate);

                                return (
                                  <tr key={item.id}>
                                    <td className="py-2 px-2 text-sm text-slate-700 dark:text-slate-200">{item.product?.name || "منتج"}</td>
                                    <td className="py-2 px-2 text-sm text-blue-600 font-bold">{Number(item.quantity || 0).toLocaleString()}</td>
                                    <td className="py-2 px-2 text-sm text-emerald-600 font-bold">{formatUSD(unitPriceUSD)} $</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(!selectedTopUser.orders || selectedTopUser.orders.length === 0) && (
                <div className="text-sm text-center text-slate-400 italic">لا توجد طلبات لهذا الموظف</div>
              )}
            </div>
          </div>
        </div>
      )}

      <DynamicCard isLoading={loading} isError={!result.success} isEmpty={!loading && result.data?.length === 0} variant="glass">
        <DynamicCard.Header title="حالات الطلبات" description="انقر على أي حالة لعرض تفاصيل الطلبات الخاصة بها" icon={<Package size={20} />} />
        <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {result.data?.map((item: any) => (
            <div
              key={item.status}
              onClick={() => setSelectedStatus(item)}
              className="flex flex-col p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.status}</span>
                  <span className="text-xs text-slate-500">{item.count} طلب</span>
                </div>
                <span className="text-blue-600 font-bold">{formatUSD(item.amount)}$</span>
              </div>
            </div>
          ))}
        </DynamicCard.Content>
        <DynamicCard.Footer>
          <div className="flex flex-col w-full gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">إجمالي المبيعات (الصافي):</span>
              <span className="text-lg font-bold text-green-600">{formatUSD(result.summary?.totalRevenue)} $</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 items-center">
              <span className="text-sm text-red-500">مبالغ ملغاة/فاشلة:</span>
              <span className="text-sm font-semibold text-red-500">-{formatUSD(result.summary?.lostRevenue)} $</span>
            </div>
            <div className="flex justify-between pt-1 items-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider">الإجمالي الكلي المخطط:</span>
              <span className="text-xs text-slate-400 font-medium">{formatUSD(result.summary?.grossTotal)} $</span>
            </div>
          </div>
        </DynamicCard.Footer>
      </DynamicCard>

      {showSalesTimeline && (
        <DynamicCard isLoading={loading} variant="glass" className="mt-6">
          <DynamicCard.Header title="السجل الزمني للمبيعات" description="تحليل أداء الحالات شهرياً" icon={<Package size={20} />} />
          <DynamicCard.Content>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <th className="p-4 rounded-r-lg">الشهر</th>
                    <th className="p-4">تفاصيل الحالات</th>
                    <th className="p-4 rounded-l-lg text-left">إجمالي الشهر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {timelineData?.map((month: any, idx: number) => {
                    const monthTotal = (Object.values(month.statuses || {}) as any[]).reduce(
                      (sum: number, status: any) => sum + (Number(status.amount) || 0),
                      0
                    );

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 font-bold text-sm text-slate-700 dark:text-slate-200 w-32">{month.label}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(month.statuses || {}).map(([status, details]: any) => (
                              <div key={status} className="flex flex-col border border-slate-200 dark:border-slate-700 p-2 rounded bg-white dark:bg-slate-900 min-w-[120px]">
                                <span className="text-[10px] text-slate-500 font-bold">{status}</span>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-xs text-blue-600">{details.count} طلب</span>
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatUSD(details.amount)}$</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-left font-black text-green-600 dark:text-green-400 text-lg">{formatUSD(monthTotal)}$</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {showCustomerGrowth && (
        <DynamicCard isLoading={loading} variant="glass" className="mt-6">
          <DynamicCard.Header title="نمو قاعدة العملاء" description="عدد العملاء الجدد المسجلين خلال آخر 30 يوم" icon={<Users size={20} className="text-blue-500" />} />
          <DynamicCard.Content className="h-[350px] w-full pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={msgTimeline.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(value: number | undefined) => [`${value || 0} عميل جديد`, "العدد"]} />
                <Bar dataKey="العملاء الجدد" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40}>
                  {msgTimeline.data.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity cursor-pointer" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {showSalesByCountry && (
        <DynamicCard isLoading={loading} isError={!country.success} isEmpty={!loading && country.data?.length === 0} variant="glass" className="mt-6">
          <DynamicCard.Header title="الطلبات حسب بلد المستودع" description="تجميع الطلبات والمبالغ بحسب بلد المستودع" icon={<TrendingUp size={20} />} />
          <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {country.data?.map((item: any) => (
              <div key={item.location} className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 h-24">
                <div className="flex flex-col justify-center">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.location || "غير محدد"}</span>
                  <span className="text-xs text-slate-500">{item._count?.id || 0} طلب</span>
                </div>
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">{formatUSD(item._sum?.finalAmount)}$</span>
              </div>
            ))}
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {showOrdersByCity && (
        <DynamicCard isLoading={loading} isError={!ordersByCity.success} isEmpty={!loading && ordersByCity.data?.length === 0} variant="glass" className="mt-6">
          <DynamicCard.Header title="تحليل الطلبات حسب المدينة" description="تجميع عدد الطلبات وإجمالي المبيعات بحسب المدينة" icon={<MapPin size={20} className="text-emerald-500" />} />
          <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ordersByCity.data?.map((item: any) => (
              <div key={item.city} className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 h-24">
                <div className="flex flex-col justify-center">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.city || "غير محدد"}</span>
                  <span className="text-xs text-slate-500">{item._count?.id || 0} طلب</span>
                </div>
                <span className="text-green-600 dark:text-green-400 font-bold text-lg">{formatUSD(item._sum?.finalAmount)}$</span>
              </div>
            ))}
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {showShippingByCompany && (
        <DynamicCard isLoading={loading} isError={!shippingByCompany.success} isEmpty={!loading && shippingByCompany.data?.length === 0} variant="glass" className="mt-6">
          <DynamicCard.Header title="مجموع الشحن لكل شركة" description="إجمالي مبالغ الشحن من الطلبات بحسب شركة الشحن" icon={<Truck size={20} className="text-orange-500" />} />
          <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shippingByCompany.data?.map((item: any) => (
              <div key={item.company} className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 h-24">
                <div className="flex flex-col justify-center">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.company || "غير محدد"}</span>
                  <span className="text-xs text-slate-500">{item._count?.id || 0} طلب</span>
                </div>
                <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">{formatUSD(item._sum?.shippingTotal)}$</span>
              </div>
            ))}
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {showDailyExpenses && (
        <DynamicCard isLoading={loading} isError={!dailyExpenses.success} isEmpty={!loading && dailyExpenses.data?.length === 0} variant="glass" className="mt-6">
          <DynamicCard.Header title="تحليل المصاريف اليومية" description="تجميع المصاريف اليومية حسب التاريخ والعملات" icon={<ReceiptText size={20} className="text-rose-500" />} />
          <DynamicCard.Content className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="text-xs text-slate-500 mb-1">إجمالي USD</div>
                <div className="text-lg font-black text-emerald-600">{formatUSD(dailyExpenses.summary?.USD)} $</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="text-xs text-slate-500 mb-1">إجمالي TRY</div>
                <div className="text-lg font-black text-amber-600">{Number(dailyExpenses.summary?.TRY || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ₺</div>
              </div>
              <div className="p-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="text-xs text-slate-500 mb-1">إجمالي SYP</div>
                <div className="text-lg font-black text-blue-600">{Number(dailyExpenses.summary?.SYP || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ل.س</div>
              </div>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyExpenses.data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number | undefined, name: string) => {
                      if (name === "TRY") return [`${Number(value || 0).toLocaleString("en-US")} ₺`, "TRY"];
                      if (name === "SYP") return [`${Number(value || 0).toLocaleString("en-US")} ل.س`, "SYP"];
                      return [`${formatUSD(value)} $`, "USD"];
                    }}
                  />
                  <Bar dataKey="USD" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="TRY" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="SYP" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {showSalesGeo && (
        <DynamicCard isLoading={loading} isError={!country.success} isEmpty={!loading && cityData.length === 0} variant="glass" className="mt-6">
          <DynamicCard.Header title="توزيع الطلبات حسب بلد المستودع" description="تحليل إجمالي الطلبات حسب مواقع المستودعات" icon={<MapPin size={20} className="text-cyan-500" />} />
          <DynamicCard.Content className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={cityData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                  {cityData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => [`${formatUSD(value)}$`, "إجمالي المبيعات"]} />
              </PieChart>
            </ResponsiveContainer>
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {showEmployeeCustomerReport && (
        <DynamicCard
          isLoading={employeeReportLoading}
          isError={!employeeCustomerReport.success}
          isEmpty={!employeeReportLoading && employeeCustomerReport.data?.length === 0}
          variant="glass"
          className="mt-6"
        >
          <DynamicCard.Header
            title="تقرير العملاء لكل موظف"
            description="عدد العملاء المتواصل معهم والمضافين والمُسلّم طلبهم لكل موظف"
            icon={<Users size={20} className="text-indigo-500" />}
          />
          <DynamicCard.Content>
            <div className="flex justify-end mb-4">
              <div className="flex flex-col gap-1 min-w-[220px]">
                <label className="text-xs font-bold text-slate-500">فلترة التقرير</label>
                <select
                  value={employeeReportPeriod}
                  onChange={(e) => setEmployeeReportPeriod(e.target.value as EmployeeReportPeriod)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="day">اليوم</option>
                  <option value="week">الأسبوع</option>
                  <option value="month">الشهر</option>
                  <option value="custom">مخصص</option>
                </select>
              </div>
            </div>

            {employeeReportPeriod === "custom" && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">من تاريخ</label>
                  <input
                    type="date"
                    value={employeeCustomStartDate}
                    onChange={(e) => setEmployeeCustomStartDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500">إلى تاريخ</label>
                  <input
                    type="date"
                    value={employeeCustomEndDate}
                    onChange={(e) => setEmployeeCustomEndDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <th className="p-3 rounded-r-lg">الموظف</th>
                    <th className="p-3">تم التواصل معهم</th>
                    <th className="p-3">العملاء المضافين</th>
                    <th className="p-3 rounded-l-lg">تم تسليم طلبهم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeeCustomerReport.data?.map((row: any) => (
                    <tr key={row.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">{row.name}</td>
                      <td className="p-3 text-blue-600 font-bold">{Number(row.communicatedCustomers || 0).toLocaleString()}</td>
                      <td className="p-3 text-purple-600 font-bold">{Number(row.addedCustomers || 0).toLocaleString()}</td>
                      <td className="p-3 text-emerald-600 font-bold">{Number(row.deliveredCustomers || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DynamicCard.Content>
        </DynamicCard>
      )}

      {(showTopProducts || showLowStock) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {showTopProducts && (
            <DynamicCard isLoading={loading} isError={!topSale.success} variant="glass">
              <DynamicCard.Header title="المنتجات الأكثر مبيعاً" icon={<TrendingUp className="text-emerald-500" />} />
              <DynamicCard.Content className="space-y-4">
                {topSale.data?.map((product: any, idx: number) => (
                  <div key={product.id || idx} className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <span className="text-sm font-medium">{product.name}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{Number(product.totalSold || 0).toLocaleString()} قطعة</span>
                  </div>
                ))}
              </DynamicCard.Content>
            </DynamicCard>
          )}

          {showLowStock && (
            <DynamicCard isLoading={loading} isError={!lowStock.success} variant="glass">
              <DynamicCard.Header title="تنبيه المخزون" icon={<TrendingDown className="text-red-500" />} />
              <DynamicCard.Content className="space-y-4">
                {lowStock.data?.map((product: any, idx: number) => (
                  <div key={product.id || idx} className="flex justify-between items-center p-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm font-bold text-red-600">{Number(product.stock || 0)} متوفر</span>
                  </div>
                ))}
              </DynamicCard.Content>
            </DynamicCard>
          )}
        </div>
      )}

      {showTopSellingUsers && (
        <DynamicCard isLoading={loading} isError={!topSellingUsers.success} isEmpty={!loading && topSellingUsers.data?.length === 0} variant="glass" className="mt-6">
          <DynamicCard.Header title="المستخدمين الأكثر مبيعاً" description="المستخدمين الذين حققوا أعلى مبيعات" icon={<Trophy size={20} className="text-green-500" />} />
          <DynamicCard.Content className="space-y-3">
            {topSellingUsers.data?.map((userRow: any, index: number) => (
              <button
                type="button"
                key={String(userRow.userId || index)}
                onClick={() => {
                  setSelectedTopUser(userRow);
                  setExpandedOrderId(null);
                }}
                className="w-full text-right p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 hover:ring-2 hover:ring-blue-500/20 transition-all"
              >
                <div className="flex justify-between items-center gap-3 text-right">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 text-red-600 text-xs font-bold">{index + 1}</div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{userRow.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase">موظف مبيعات</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-red-600 dark:text-red-400 font-bold text-lg block">{(userRow.totalOrdersAll || userRow.totalOrders || 0).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 uppercase">الطلبات الكلية</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 dark:border-slate-700 pt-2">
                  <span className="text-xs text-slate-500">إجمالي المبيعات</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatUSD(Number(userRow.totalSalesAmount) || 0)} $</span>
                </div>
              </button>
            ))}
          </DynamicCard.Content>
        </DynamicCard>
      )}
    </div>
  );
};

export default AnalyticPage;
