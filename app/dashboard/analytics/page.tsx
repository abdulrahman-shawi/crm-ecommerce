"use client";

import DynamicCard from '@/components/ui/dynamicCard';
import { useAuth } from '@/context/AuthContext';
import {
    GetBestSellingProducts,
    GetCustomerAcquisitionMonth,
    GetEmployeeCustomerReport,
    GetLowStockProducts,
    GetSalesByCity,
    GetSalesByStatusAction,
    GetSalesTimelineAction,
    GetTopSellingUsersByPermission
} from '@/server/analytics';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, TrendingDown, Package, Users, X, MapPin, Award, Trophy } from 'lucide-react';
import * as React from 'react';

type OrderFilterPreset = 'this_month' | 'last_month' | 'custom';
type EmployeeReportPeriod = 'day' | 'week' | 'month';

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

const formatUSD = (value: number | undefined | null) => {
    return Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
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

    const [country, setCountry] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [topSale, setTopSale] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [lowStock, setLowStock] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [topSellingUsers, setTopSellingUsers] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [employeeCustomerReport, setEmployeeCustomerReport] = React.useState<{ success: boolean, data: any[] }>({ success: true, data: [] });
    const [employeeReportPeriod, setEmployeeReportPeriod] = React.useState<EmployeeReportPeriod>('month');
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
                    resCountry,
                    resTopSale,
                    resLowStock,
                    resTopUsers,
                    resTimeline,
                    resMsgTimeline,
                    resEmployeeReport
                ] = await Promise.all([
                    GetSalesByStatusAction(user.id, orderDateFilter),
                    GetSalesByCity(user.id, orderDateFilter),
                    GetBestSellingProducts(user.id, orderDateFilter),
                    GetLowStockProducts(user.id),
                    GetTopSellingUsersByPermission(user.id, orderDateFilter),
                    GetSalesTimelineAction(user.id, orderDateFilter),
                    GetCustomerAcquisitionMonth(user.id, orderDateFilter),
                    GetEmployeeCustomerReport(user.id, employeeReportPeriod)
                ]);

                setResult(resStatus as any);
                setCountry(resCountry as any);
                setTopSale(resTopSale as any);
                setLowStock(resLowStock as any);
                setTopSellingUsers(resTopUsers as any);
                setTimelineData((resTimeline as any)?.data || []);
                setMsgTimeline(resMsgTimeline as any);
                setEmployeeCustomerReport(resEmployeeReport as any);
            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [user?.id, orderDateFilter, employeeReportPeriod, isInvalidCustomRange]);

    const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    const cityData = country.data?.map((item: any) => ({
        name: item.country || "غير محدد",
        value: item._sum.finalAmount || 0,
        count: item._count.id || 0
    })) || [];
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

    const topUsersData = topSellingUsers.data?.map((user: any) => ({
        name: user.name,
        sales: user.totalOrdersAll || user.totalOrders || 0
    })) || [];

    const showSalesTimeline = loading || timelineData.length > 0;
    const showCustomerGrowth = loading || (msgTimeline.data?.length || 0) > 0;
    const showSalesByCountry = loading || (country.data?.length || 0) > 0;
    const showSalesGeo = loading || cityData.length > 0;
    const showTopProducts = loading || (topSale.data?.length || 0) > 0;
    const showLowStock = loading || (lowStock.data?.length || 0) > 0;
    const showTopSellingUsers = loading || (topSellingUsers.data?.length || 0) > 0;
    const showTopUsersChart = loading || topUsersData.length > 0;
    const showEmployeeCustomerReport = loading || (employeeCustomerReport.data?.length || 0) > 0;
    return (
        <div className="p-8 relative">
            <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="flex flex-col gap-1 min-w-[220px]">
                        <label className="text-xs font-bold text-slate-500">عرض التحليلات حسب الفترة</label>
                        <select
                            value={orderFilterPreset}
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
                                                    {msgTimeline.data.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </DynamicCard.Content>
                                </DynamicCard>
                            )}
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
                                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatUSD(details.amount)}$</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-left font-black text-green-600 dark:text-green-400 text-lg">
                                                    {formatUSD(monthTotal)}$
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
                                    tickFormatter={(value) => `$${formatUSD(Number(value || 0))}`}
                                />
                                <Tooltip
                                    formatter={(value: number | undefined) => `${formatUSD(value)}$`}
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
                                    {formatUSD(item._sum?.finalAmount)}$
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
                                        return [`${formatUSD(amount)}$`, "إجمالي المبيعات"];
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

            {showEmployeeCustomerReport && (
                <DynamicCard
                    isLoading={loading}
                    isError={!employeeCustomerReport.success}
                    isEmpty={!loading && employeeCustomerReport.success && employeeCustomerReport.data?.length === 0}
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
                                </select>
                            </div>
                        </div>

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
                                            {formatUSD(Number(userRow.totalSalesAmount) || 0)} $
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
                                                                    <span className="font-bold text-blue-600">{formatUSD(Number(order.finalAmount || 0))} $</span>
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