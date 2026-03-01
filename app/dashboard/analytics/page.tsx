"use client";

import DynamicCard from '@/components/ui/dynamicCard';
import { useAuth } from '@/context/AuthContext';
import {
    // GetBestSellingProducts,
    GetCustomerAcquisitionMonth,
    GetCustomerInteractions,
    // GetLowStockProducts,
    GetSalesByCity,
    GetSalesByStatusAction,
    GetSalesTimelineAction,
    GetTopCustomers,
    GetTopSellingUsersByPermission
} from '@/server/analytics';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { u } from 'framer-motion/client';
import { TrendingUp, TrendingDown, Package, Users, X, MapPin, Award, Trophy } from 'lucide-react';
import * as React from 'react';
import { set } from 'zod';

type OrderFilterPreset = 'this_month' | 'last_month' | 'custom';

const toInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getPresetDateRange = (preset: OrderFilterPreset) => {
    const now = new Date();

    if (preset === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { startDate: toInputDate(start), endDate: toInputDate(end) };
    }

    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: toInputDate(start), endDate: toInputDate(end) };
};

const AnalyticPage: React.FC = () => {
    // تحديد الحالة المختارة لفتح المودال
    const [selectedStatus, setSelectedStatus] = React.useState<any>(null);

    // تعريف حالة البيانات مع الأنواع الجديدة (summary)
    const [result, setResult] = React.useState<{
        success: boolean;
        data: any[];
        summary?: {
            totalRevenue: number;
            lostRevenue: number;
            grossTotal: number;
            cancelledCount: number;
            missingInfoCount: number;
            failedReturnCount: number;
        };
    }>({ success: true, data: [] });

    const [msg, setMsg] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [country, setCountry] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [topCustomer, setTopCustomer] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [topSale, setTopSale] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [lowStock, setLowStock] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [topSellingUsers, setTopSellingUsers] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [expandedUserId, setExpandedUserId] = React.useState<string | null>(null);
    const [expandedOrderByUser, setExpandedOrderByUser] = React.useState<Record<string, string | null>>({});
    const [timelineData, setTimelineData] = React.useState<any[]>([]); // 
    const [loading, setLoading] = React.useState(true);
    const [msgTimeline, setMsgTimeline] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [orderFilterPreset, setOrderFilterPreset] = React.useState<OrderFilterPreset>('this_month');
    const [customStartDate, setCustomStartDate] = React.useState('');
    const [customEndDate, setCustomEndDate] = React.useState('');
    const { user } = useAuth();

    const isInvalidCustomRange = orderFilterPreset === 'custom'
        && Boolean(customStartDate)
        && Boolean(customEndDate)
        && new Date(customStartDate) > new Date(customEndDate);

    const orderDateFilter = React.useMemo(() => {
        if (orderFilterPreset === 'custom') {
            return {
                startDate: customStartDate || undefined,
                endDate: customEndDate || undefined,
            };
        }
        return getPresetDateRange(orderFilterPreset);
    }, [orderFilterPreset, customStartDate, customEndDate]);

    React.useEffect(() => {
        const fetchAllData = async () => {
            if (!user?.id) return;
            if (isInvalidCustomRange) return;
            setLoading(true);
            try {
                // تنفيذ جميع الطلبات بالتوازي لتحسين الأداء
                const [
                    resStatus,
                    resMsg,
                    resCountry,
                    resTopCust,
                    resTopUsers,
                    resTimeline,
                    resMsgTimeline
                ] = await Promise.all([
                    GetSalesByStatusAction(user.id, orderDateFilter),
                    GetCustomerInteractions(user.id),
                    GetSalesByCity(user.id, orderDateFilter),
                    GetTopCustomers(user.id),
                    GetTopSellingUsersByPermission(user.id),
                    GetSalesTimelineAction(user.id, orderDateFilter),
                    GetCustomerAcquisitionMonth(user.id)
                ]);

                setResult(resStatus as any);
                setMsg(resMsg as any);
                setCountry(resCountry as any);
                setTopCustomer(resTopCust as any);
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
    }, [user?.id, orderDateFilter, isInvalidCustomRange]);

    const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    const cityData = country.data?.map((item: any) => ({
        name: item.country || "غير محدد",
        value: item._sum.finalAmount || 0,
        count: item._count.id || 0
    })) || [];
    const interactionData = React.useMemo(() => {
        return msg.data?.map((item: any) => ({
            name: item.name,
            // الوصول الصحيح للعدد من بنية Prisma
            count: item._count?.message || 0
        })) || [];
    }, [msg.data]);

    const allStatuses = React.useMemo(() => {
        // جمع كل الحالات الفريدة الموجودة في جميع الأشهر
        const statuses = new Set<string>();
        timelineData.forEach(month => {
            Object.keys(month.statuses).forEach(status => statuses.add(status));
        });
        return Array.from(statuses);
    }, [timelineData]);

    const chartData = React.useMemo(() => {
        return timelineData.map(month => {
            const monthData: { name: string;[key: string]: number | string } = {
                name: month.label,
            };
            allStatuses.forEach(status => {
                // نضع مبلغ كل حالة، وإذا لم توجد، نضع 0
                monthData[status] = month.statuses[status]?.amount || 0;
            });
            return monthData;
        });
    }, [timelineData, allStatuses]);

    const statusColors = [
        '#8884d8', // أرجواني (مثل PENDING)
        '#82ca9d', // أخضر (مثل SHIPPED)
        '#ffc658', // أصفر (مثل CANCELED)
        '#ff7300', // برتقالي
        '#0088fe', // أزرق
        '#00c49f', // تركواز
        '#ffbb28', // ذهبي
        '#a15cff', // بنفسجي فاتح
        '#ff4d4d', // أحمر فاتح
        '#4d4dff', // أزرق غامق
    ];

    const topCustData = topCustomer.data?.map((item: any) => ({
        name: item.name,
        "عدد الطلبات": item._count?.orders || 0
    })) || [];

    const topUsersData = topSellingUsers.data?.map((user: any) => ({
        name: user.name,
        sales: user.totalOrdersAll || user.totalOrders || 0
    })) || [];

    const showSalesTimeline = loading || timelineData.length > 0;
    const showStatusChart = loading || chartData.length > 0;
    const showCustomerInteractions = loading || (msg.data?.length || 0) > 0;
    const showInteractionChart = loading || interactionData.length > 0;
    const showCustomerGrowth = loading || (msgTimeline.data?.length || 0) > 0;
    const showSalesByCountry = loading || (country.data?.length || 0) > 0;
    const showSalesGeo = loading || cityData.length > 0;
    const showTopCustomersCards = loading || (topCustomer.data?.length || 0) > 0;
    const showTopCustomersChart = loading || topCustData.length > 0;
    const showTopProducts = loading || (topSale.data?.length || 0) > 0;
    const showLowStock = loading || (lowStock.data?.length || 0) > 0;
    const showTopSellingUsers = loading || (topSellingUsers.data?.length || 0) > 0;
    const showTopUsersChart = loading || topUsersData.length > 0;
    return (
        <div className="p-8 relative">
            <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="flex flex-col gap-1 min-w-[220px]">
                        <label className="text-xs font-bold text-slate-500">عرض الطلبات حسب الفترة</label>
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

                    {orderFilterPreset === 'custom' && (
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
                </div>

                {isInvalidCustomRange && (
                    <p className="mt-2 text-xs text-red-500 font-bold">تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.</p>
                )}
            </div>

            {/* الشباك المنبثق (Modal) لتفاصيل الطلبات */}
            {selectedStatus && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
                    onClick={() => setSelectedStatus(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* رأس المودال */}
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                                    طلبات حالة: {selectedStatus.status}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    الإجمالي: {selectedStatus.amount?.toLocaleString()}$ ({selectedStatus.count} طلب)
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedStatus(null)}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* جدول الطلبات داخل المودال */}
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
                                        <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="py-3 px-2 text-sm text-blue-600 font-medium font-mono">
                                                #{order.orderNumber}
                                            </td>
                                            <td className="py-3 px-2 text-sm text-slate-600 dark:text-slate-300">
                                                {order.customerName}
                                            </td>
                                            <td className="py-3 px-2 text-sm font-bold text-slate-900 dark:text-white">
                                                {order.amount?.toLocaleString()}$
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. كرت إحصائيات المبيعات حسب الحالة */}
            <DynamicCard
                isLoading={loading}
                isError={!result.success}
                isEmpty={!loading && result.success && result.data?.length === 0}
                variant="glass"
            >
                <DynamicCard.Header
                    title="حالات الطلبات"
                    description="انقر على أي حالة لعرض تفاصيل الطلبات الخاصة بها"
                    icon={<Package size={20} />}
                />

                <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {result.data?.map((item: any) => (
                        <div
                            key={item.status}
                            onClick={() => setSelectedStatus(item)}
                            className="flex flex-col p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer hover:ring-2 hover:ring-blue-500/20 hover:border-blue-300 transition-all group"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                                        {item.status}
                                    </span>
                                    <span className="text-xs text-slate-500">{item.count} طلب</span>
                                </div>
                                <span className="text-blue-600 font-bold">{item.amount?.toLocaleString()}$</span>
                            </div>

                            {/* عرض أرقام الطلبات كـ Badges */}
                            <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tight">آخر الطلبات:</p>
                                <div className="flex flex-wrap gap-1">
                                    {item.ordersDetails?.slice(0, 3).map((order: any) => (
                                        <span key={order.id} className="text-[9px] bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                                            #{order.orderNumber}
                                        </span>
                                    ))}
                                    {item.count > 3 && (
                                        <span className="text-[9px] text-slate-400 self-center">
                                            +{item.count - 3} أخرى
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </DynamicCard.Content>

                <DynamicCard.Footer>
                    <div className="flex flex-col w-full gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">إجمالي المبيعات (الصافي):</span>
                            <span className="text-lg font-bold text-green-600">{result.summary?.totalRevenue.toLocaleString()} $</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 items-center">
                            <div className="flex flex-col">
                                <span className="text-sm text-red-500">مبالغ ملغاة/فاشلة:</span>
                                <span className="text-[10px] text-slate-400 italic">
                                    ({result.summary?.cancelledCount || 0} ملغى | {result.summary?.missingInfoCount || 0} نقص معلومات)
                                </span>
                            </div>
                            <span className="text-sm font-semibold text-red-500">-{result.summary?.lostRevenue.toLocaleString()} $</span>
                        </div>
                        <div className="flex justify-between pt-1 items-center">
                            <span className="text-xs text-slate-400 uppercase tracking-wider">الإجمالي الكلي المخطط:</span>
                            <span className="text-xs text-slate-400 font-medium">{result.summary?.grossTotal.toLocaleString()} $</span>
                        </div>
                    </div>
                </DynamicCard.Footer>
            </DynamicCard>


            {/* جدول السجل الزمني الشهري */}
            {showSalesTimeline && (
                <DynamicCard
                    isLoading={loading}
                    variant="glass"
                    className="mt-6"
                >
                    <DynamicCard.Header
                        title="السجل الزمني للمبيعات"
                        description="تحليل أداء الحالات شهرياً"
                        icon={<Package size={20} />}
                    />
                    <DynamicCard.Content>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="bg-slate-100/50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-400">
                                        <th className="p-4 rounded-r-lg">الشهر</th>
                                        <th className="p-4">تفاصيل الحالات (عدد الطلبات | المبالغ)</th>
                                        <th className="p-4 rounded-l-lg text-left">إجمالي الشهر</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {/* ملاحظة: افترضنا أننا خزنّا نتيجة الـ Action الجديد في متغير اسمه timelineData */}
                                    {timelineData?.map((month: any, idx: number) => {
                                        const monthTotal = (Object.values(month.statuses || {}) as any[]).reduce((sum: number, status: any) => {
                                            return sum + (Number(status.amount) || 0);
                                        }, 0);

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                                <td className="p-4 font-bold text-sm text-slate-700 dark:text-slate-200 w-32">
                                                    {month.label}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(month.statuses || {}).map(([status, details]: any) => (
                                                            <div key={status} className="flex flex-col border border-slate-200 dark:border-slate-700 p-2 rounded bg-white dark:bg-slate-900 min-w-[120px]">
                                                                <span className="text-[10px] text-slate-500 font-bold">{status}</span>
                                                                <div className="flex justify-between items-center mt-1">
                                                                    <span className="text-xs text-blue-600">{details.count} طلب</span>
                                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{details.amount.toLocaleString()}$</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-left font-black text-green-600 dark:text-green-400 text-lg">
                                                    {monthTotal.toLocaleString()}$
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </DynamicCard.Content>
                </DynamicCard>
            )}
            {/* باقي الكروت (تفاعلات العملاء، الدول، إلخ) تظل كما هي مع تحسينات بسيطة */}

            {showStatusChart && (
                <DynamicCard isLoading={loading} variant="glass" className="mt-6">
                    <DynamicCard.Header title="المنحنى البياني لحالات الطلبات" icon={<Package size={20} />} />
                    <DynamicCard.Content className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={chartData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    stroke="#94a3b8"
                                    tickFormatter={(value) => `$${value.toLocaleString()}`} // تنسيق العملة
                                />
                                <Tooltip
                                    formatter={(value: number | undefined) => `${value?.toLocaleString() || 0}$`} // تنسيق القيم في الـ Tooltip
                                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ color: '#333' }}
                                />
                                <Legend
                                    verticalAlign="top"
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: '10px' }}
                                />

                                {/* توليد خطوط لكل حالة بشكل ديناميكي */}
                                {allStatuses.map((status, index) => (
                                    <Line
                                        key={status}
                                        type="monotone"
                                        dataKey={status} // هنا اسم الحالة هو الـ key
                                        stroke={statusColors[index % statusColors.length]} // لتغيير الألوان
                                        strokeWidth={2}
                                        dot={false} // لا تظهر النقاط لتسهيل القراءة
                                        activeDot={{ r: 6 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </DynamicCard.Content>
                </DynamicCard>
            )}

            {showCustomerInteractions && (
                <DynamicCard
                    isLoading={loading}
                    isError={!msg.success}
                    isEmpty={!loading && msg.success && msg.data?.length === 0}
                    variant="glass"
                    className='mt-6'
                >
                    <DynamicCard.Header
                        title="تفاعلات العملاء"
                        description="أكثر العملاء تواصلاً بناءً على عدد الرسائل المسجلة"
                        icon={<TrendingUp size={20} />}
                    />
                    <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {msg.data?.map((item: any) => (
                            <div key={item.name} className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 h-24">
                                <div className="flex flex-col justify-center overflow-hidden">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                                    <span className="text-xs text-slate-500 uppercase tracking-tighter">عميل نشط</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-purple-600 dark:text-purple-400 font-bold text-xl block">
                                        {item._count.message || 0}
                                    </span>
                                    <span className="text-[9px] text-slate-400 uppercase">رسالة</span>
                                </div>
                            </div>
                        ))}
                    </DynamicCard.Content>
                </DynamicCard>
            )}

            {(showInteractionChart || showCustomerGrowth) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {showInteractionChart && (
                        <DynamicCard
                            isLoading={loading}
                            isError={!msg.success}
                            isEmpty={!loading && interactionData.length === 0}
                            variant="glass"
                            className="mt-6"
                        >
                            <DynamicCard.Header
                                title="أكثر العملاء تفاعلاً"
                                description="ترتيب العملاء بناءً على حجم المراسلات والتفاعلات"
                                icon={<TrendingUp size={20} className="text-purple-500" />}
                            />
                            <DynamicCard.Content className="h-[450px] w-full pt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={interactionData} // استخدام البيانات المعالجة
                                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            // التعديل هنا: استخدمنا مصفوفة ألوان متدرجة أو لوناً يناسب الخلفية الداكنة
                                            tick={{
                                                fontSize: 12,
                                                fill: '#94a3b8', // لون رمادي مزرق هادئ يناسب الـ Dark Mode
                                                fontWeight: 500
                                            }}
                                            width={120} // زيادة العرض قليلاً لضمان عدم قطع الأسماء الطويلة
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: 'none',
                                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                direction: 'rtl'
                                            }}
                                            // تصحيح التنسيق هنا أيضاً
                                            formatter={(value: number | undefined) => [`${value} رسالة`, "التفاعلات"]}
                                        />
                                        <Bar
                                            dataKey="count" // تغيير المفتاح ليتطابق مع المعالجة
                                            radius={[0, 4, 4, 0]}
                                            barSize={25}
                                        >
                                            {interactionData.map((entry: any, index: number) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={index === 0 ? '#7c3aed' : '#a78bfa'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </DynamicCard.Content>
                        </DynamicCard>
                    )}
                    {showCustomerGrowth && (
                        <DynamicCard isLoading={loading} variant="glass" className="mt-6">
                            <DynamicCard.Header
                                title="نمو قاعدة العملاء"
                                description="عدد العملاء الجدد المسجلين خلال آخر 30 يوم"
                                icon={<Users size={20} className="text-blue-500" />}
                            />
                            <DynamicCard.Content className="h-[350px] w-full pt-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={msgTimeline.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: '#64748b' }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: '#64748b' }}
                                            axisLine={false}
                                            tickLine={false}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: 'none',
                                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                                direction: 'rtl'
                                            }}
                                            formatter={(value: number | undefined) => {
                                                return [`${value} عميل جديد`, "العدد"];
                                            }}
                                        />
                                        <Bar
                                            dataKey="العملاء الجدد"
                                            fill="#3b82f6"
                                            radius={[6, 6, 0, 0]}
                                            barSize={40}
                                        >
                                            {/* إضافة تأثير لوني بسيط عند التمرير */}
                                            {msgTimeline.data.map((entry, index) => (
                                                <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </DynamicCard.Content>
                        </DynamicCard>
                    )}
                </div>
            )}


            {showSalesByCountry && (
                <DynamicCard
                    isLoading={loading}
                    isError={!country.success}
                    isEmpty={!loading && country.success && country.data?.length === 0}
                    variant="glass"
                    className='mt-6'
                >
                    <DynamicCard.Header
                        title="الطلبات حسب بلد المستودع"
                        description="تجميع الطلبات والمبالغ بحسب بلد المستودع"
                        icon={<TrendingUp size={20} />}
                    />
                    <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {country.data?.map((item: any) => (
                            <div key={item.country} className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 h-24">
                                <div className="flex flex-col justify-center">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{item.country || "غير محدد"}</span>
                                    <span className="text-xs text-slate-500">{item._count?.id || 0} طلب</span>
                                </div>
                                <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                                    {item._sum?.finalAmount?.toLocaleString() || 0}$
                                </span>
                            </div>
                        ))}
                    </DynamicCard.Content>
                </DynamicCard>
            )}

            {showSalesGeo && (
                <DynamicCard
                    isLoading={loading}
                    isError={!country.success}
                    isEmpty={!loading && cityData.length === 0}
                    variant="glass"
                    className="mt-6"
                >
                    <DynamicCard.Header
                        title="توزيع الطلبات حسب بلد المستودع"
                        description="تحليل إجمالي الطلبات حسب مواقع المستودعات"
                        icon={<MapPin size={20} className="text-cyan-500" />}
                    />
                    <DynamicCard.Content className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={cityData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70} // جعلها بشكل Donut
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {cityData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderRadius: '12px',
                                        border: '1px solid #1e293b',
                                        direction: 'rtl',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: number | undefined) => {
                                        const amount = value ?? 0; // إذا كانت القيمة غير معرفة نعتبرها 0
                                        return [`${amount.toLocaleString()}$`, "إجمالي المبيعات"];
                                    }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </DynamicCard.Content>
                    <DynamicCard.Footer>
                        <div className="flex justify-around text-center py-2">
                            {cityData.slice(0, 3).map((item: any, idx: number) => (
                                <div key={idx}>
                                    <p className="text-[10px] text-slate-400">{item.name}</p>
                                    <p className="text-xs font-bold text-slate-200">{item.count} طلب</p>
                                </div>
                            ))}
                        </div>
                    </DynamicCard.Footer>
                </DynamicCard>
            )}

            {showTopCustomersCards && (
                <DynamicCard
                    isLoading={loading}
                    isError={!topCustomer.success}
                    isEmpty={!loading && topCustomer.success && topCustomer.data?.length === 0}
                    variant="glass"
                    className='mt-3'
                >
                    <DynamicCard.Header
                        title="أفضل العملاء"
                        description="أكثر 10 عملاء شراءً بناءً على عدد الطلبات الإجمالي"
                        icon={<Users size={20} />} // تغيير الأيقونة لتناسب العملاء
                    />

                    <DynamicCard.Content className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {topCustomer.data?.map((item: any) => (
                            <div
                                key={item.id}
                                className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800 h-24"
                            >
                                <div className="flex flex-col justify-center overflow-hidden">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate" title={item.name}>
                                        {item.name}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {item._count?.orders || 0} طلبات منفذة
                                    </span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="flex flex-col items-end">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                                            {/* يمكنك إضافة إجمالي مبالغ العميل هنا إذا قمت بتعديل الـ Action */}
                                            VIP
                                        </span>
                                        <span className="text-[10px] text-slate-400 uppercase">تصنيف العميل</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </DynamicCard.Content>

                    <DynamicCard.Footer>
                        <div className="flex flex-col justify-start w-full">
                            <div className="flex justify-between w-full items-center">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    إجمالي طلبات كبار العملاء:
                                </span>
                                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {topCustomer.data?.reduce((sum: number, item: any) => sum + (item._count?.orders || 0), 0)} طلب
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                                * يتم تحديث هذه القائمة بناءً على نشاط الطلبات الأخير
                            </p>
                        </div>
                    </DynamicCard.Footer>
                </DynamicCard>
            )}

            {/* باقي الكروت (أفضل العملاء، المنتجات، المخزون) تستمر بنفس النمط... */}

            {showTopCustomersChart && (
                <DynamicCard
                    isLoading={loading}
                    isError={!topCustomer.success}
                    isEmpty={!loading && topCustData.length === 0}
                    variant="glass"
                    className="mt-6"
                >
                    <DynamicCard.Header
                        title="أفضل 10 عملاء"
                        description="ترتيب العملاء الأكثر طلباً للمنتجات"
                        icon={<Award size={20} className="text-yellow-500" />}
                    />
                    <DynamicCard.Content className="h-[350px] w-full pt-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topCustData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                {/* شبكة خلفية ناعمة تناسب الثيم الداكن */}
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0} // لضمان ظهور جميع أسماء العملاء
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderRadius: '12px',
                                        border: '1px solid #1e293b',
                                        direction: 'rtl'
                                    }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    formatter={(value: number | undefined) => {
                                        const amount = value ?? 0; // إذا كانت القيمة غير معرفة نعتبرها 0
                                        return [`${amount.toLocaleString()}$`, "إجمالي المبيعات"];
                                    }}
                                />
                                <Bar
                                    dataKey="عدد الطلبات"
                                    radius={[6, 6, 0, 0]}
                                    barSize={35}
                                >
                                    {topCustData.map((entry: any, index: number) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            // تدرج لوني: الذهبي للمركز الأول، والبرتقالي للبقية
                                            fill={index === 0 ? '#f59e0b' : '#fb923c'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </DynamicCard.Content>
                </DynamicCard>
            )}
            {(showTopProducts || showLowStock) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    {/* المنتجات الأكثر مبيعاً */}
                    {showTopProducts && (
                        <DynamicCard isLoading={loading} isError={!topSale.success} variant="glass">
                            <DynamicCard.Header title="المنتجات الأكثر مبيعاً" icon={<TrendingUp className="text-emerald-500" />} />
                            <DynamicCard.Content className="space-y-4">
                                {topSale.data?.map((product: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                                            <span className="text-sm font-medium">{product.name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-600">{product.totalSold} قطعة</span>
                                    </div>
                                ))}
                            </DynamicCard.Content>
                        </DynamicCard>
                    )}

                    {/* مخزون منخفض */}
                    {showLowStock && (
                        <DynamicCard isLoading={loading} isError={!lowStock.success} variant="glass">
                            <DynamicCard.Header title="تنبيه المخزون" icon={<TrendingDown className="text-red-500" />} />
                            <DynamicCard.Content className="space-y-4">
                                {lowStock.data?.map((product: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                                        <span className="text-sm font-medium">{product.name}</span>
                                        <span className="text-sm font-bold text-red-600">{product.stock} متوفر</span>
                                    </div>
                                ))}
                            </DynamicCard.Content>
                        </DynamicCard>
                    )}
                </div>
            )}
            {showTopSellingUsers && (
                <DynamicCard
                    isLoading={loading}
                    isError={!topSellingUsers.success}
                    isEmpty={!loading && topSellingUsers.success && topSellingUsers.data?.length === 0}
                    variant="glass"
                    className="mt-3"
                >
                    <DynamicCard.Header
                        title="المستخدمين الأكثر مبيعاً"
                        description="المستخدمين الذين حققوا أعلى مبيعات"
                        icon={<Award size={20} className="text-green-500" />}
                    />

                    <DynamicCard.Content className="space-y-3">
                        {topSellingUsers.data?.map((userRow: any, index: number) => {
                            const userId = String(userRow.userId || index);
                            const isUserExpanded = expandedUserId === userId;
                            const expandedOrderId = expandedOrderByUser[userId];

                            return (
                                <div
                                    key={userId}
                                    className="p-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpandedUserId((prev) => (prev === userId ? null : userId))}
                                        className="w-full flex justify-between items-center gap-3 text-right"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 text-red-600 text-xs font-bold">
                                                {index + 1}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate" title={userRow.name}>
                                                    {userRow.name}
                                                </span>
                                                <span className="text-[10px] text-slate-400 uppercase">موظف مبيعات</span>
                                            </div>
                                        </div>

                                        <div className="text-right flex-shrink-0">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-red-600 dark:text-red-400 font-bold text-lg">
                                                    {(userRow.totalOrdersAll || userRow.totalOrders || 0).toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">الطلبات الكلية</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                                                    {(userRow.deliveredOrders || 0).toLocaleString()} تم التسليم
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 dark:border-slate-700 pt-2">
                                        <span className="text-xs text-slate-500">إجمالي المبيعات</span>
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            {(Number(userRow.totalSalesAmount) || 0).toLocaleString()} $
                                        </span>
                                    </div>

                                    {isUserExpanded && (
                                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-2">
                                            <div className="mb-2 text-xs font-bold text-slate-500">طلبات المستخدم</div>
                                            <div className="space-y-2 max-h-56 overflow-y-auto">
                                                {(userRow.orders || []).map((order: any) => {
                                                    const orderId = String(order.id);
                                                    const isOrderExpanded = expandedOrderId === orderId;
                                                    return (
                                                        <div key={orderId} className="rounded-md border border-slate-200 dark:border-slate-700">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setExpandedOrderByUser((prev) => ({
                                                                        ...prev,
                                                                        [userId]: prev[userId] === orderId ? null : orderId,
                                                                    }));
                                                                }}
                                                                className="w-full p-2 text-right hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">#{order.orderNumber}</span>
                                                                    <span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                                                                </div>
                                                                <div className="mt-1 flex items-center justify-between text-xs">
                                                                    <span className="text-slate-500">{order.customer?.name || 'بدون عميل'}</span>
                                                                    <span className="font-bold text-blue-600">{Number(order.finalAmount || 0).toLocaleString()} $</span>
                                                                </div>
                                                            </button>

                                                            {isOrderExpanded && (
                                                                <div className="border-t border-slate-200 dark:border-slate-700 p-2 bg-slate-50/60 dark:bg-slate-900/40">
                                                                    <div className="text-[11px] font-bold text-slate-500 mb-2">المواد المباعة</div>
                                                                    <div className="space-y-1">
                                                                        {(order.items || []).map((item: any) => (
                                                                            <div key={item.id} className="flex items-center justify-between text-xs rounded border border-slate-200 dark:border-slate-700 px-2 py-1">
                                                                                <span className="text-slate-700 dark:text-slate-200">{item.product?.name || 'منتج'}</span>
                                                                                <span className="text-slate-500">x{item.quantity}</span>
                                                                            </div>
                                                                        ))}
                                                                        {(!order.items || order.items.length === 0) && (
                                                                            <div className="text-xs text-slate-400">لا توجد مواد في هذا الطلب</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {(!userRow.orders || userRow.orders.length === 0) && (
                                                    <div className="text-xs text-slate-400">لا توجد طلبات لهذا المستخدم</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </DynamicCard.Content>

                    <DynamicCard.Footer>
                        <div className="flex justify-between items-center w-full">
                            <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                                * يتم تحديث هذه القائمة بناءً على أداء المبيعات الأخير لكل مستخدم
                            </span>
                            <div className="flex items-center gap-3 text-emerald-500 font-semibold text-sm">
                                <span>
                                    الكلي: {topSellingUsers.data?.reduce((acc: number, curr: any) => acc + (curr.totalOrdersAll || curr.totalOrders || 0), 0)}
                                </span>
                                <span>
                                    تم التسليم: {topSellingUsers.data?.reduce((acc: number, curr: any) => acc + (curr.deliveredOrders || 0), 0)}
                                </span>
                            </div>
                        </div>
                    </DynamicCard.Footer>
                </DynamicCard>
            )}
            {showTopUsersChart && (
                <DynamicCard
                    isLoading={loading}
                    isError={!topSellingUsers.success}
                    isEmpty={!loading && topUsersData.length === 0}
                    variant="glass"
                    className="mt-6"
                >
                    <DynamicCard.Header
                        title="نجوم المبيعات"
                        description="أكثر 5 موظفين إتماماً للطلبات"
                        icon={<Trophy size={20} className="text-amber-400" />}
                    />
                    <DynamicCard.Content className="h-[300px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={topUsersData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 12, fill: '#cbd5e1' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderRadius: '12px',
                                        border: '1px solid #1e293b',
                                        direction: 'rtl'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: number | undefined) => {
                                        const amount = value ?? 0; // إذا كانت القيمة غير معرفة نعتبرها 0
                                        return [`${amount.toLocaleString()} طلب مكتمل`, "الإنجاز"];
                                    }}
                                />
                                <Bar 
                                    dataKey="sales" 
                                    radius={[10, 10, 0, 0]} 
                                    barSize={45}
                                >
                                    {topUsersData.map((entry: any, index: number) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            // تدرج لوني يعبر عن التميز
                                            fill={index === 0 ? '#10b981' : index === 1 ? '#3b82f6' : '#6366f1'} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </DynamicCard.Content>
                    <DynamicCard.Footer>
                        <div className="flex justify-center gap-4 text-[11px] text-slate-400 font-medium">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-[#10b981]" /> الأول
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> الثاني
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-[#6366f1]" /> البقية
                            </div>
                        </div>
                    </DynamicCard.Footer>
                </DynamicCard>
            )}
        </div>
    );
};

export default AnalyticPage;