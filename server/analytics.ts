// src/actions/analytics.ts
"use server"
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdmin } from "@/lib/utils";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";

const DEFAULT_TURKEY_EXCHANGE_RATE = 44;
const normalizeOrderAmountToUSD = (amount: number, warehouseLocation?: string | null, exchangeRate: number = DEFAULT_TURKEY_EXCHANGE_RATE) => {
  const value = Number(amount || 0);
  const safeRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : DEFAULT_TURKEY_EXCHANGE_RATE;
  return String(warehouseLocation || "").trim() === "تركيا" ? value / safeRate : value;
};
const NON_REVENUE_STATUSES = ["تم الغاء الطلب", "فشل التسليم مرتجع"];

const resolveOrderExchangeRate = (
  orderLike: { usdToTryRateAtOrder?: number | null },
  fallbackExchangeRate: number = DEFAULT_TURKEY_EXCHANGE_RATE
) => {
  const snapshotRate = Number(orderLike?.usdToTryRateAtOrder || 0);
  if (snapshotRate > 0) return snapshotRate;
  return DEFAULT_TURKEY_EXCHANGE_RATE;
};

const getTurkeyExchangeRateFromSettings = async () => {
//  اشرح الكود بالتفصيل الممل وان احتوت الشرح على كلمة أجنبية أنزل سطر:
// 1. هذا الكود هو دالة غير متزامنة (async function) تُستخدم لجلب سعر صرف الدولار الأمريكي مقابل الليرة التركية من قاعدة البيانات باستخدام Prisma.
// 2. في البداية، يتم تعريف ثابت DEFAULT_TURKEY_EXCHANGE_RATE بقيمة 44، والذي يُستخدم كقيمة افتراضية في حال عدم وجود سعر صرف صالح في قاعدة البيانات.
// 3. داخل الدالة، يتم استخدام Prisma للوصول إلى جدول generalSetting وجلب أول سجل (findFirst) مع ترتيب تصاعدي حسب id.
// 4. يتم اختيار الحقل usdToTryRate فقط من السجل الذي تم جلبه.
// 5. بعد جلب البيانات، يتم تحويل قيمة usdToTryRate إلى رقم باستخدام Number()، وإذا كانت القيمة غير موجودة أو غير صالحة، يتم تعيينها إلى 0.
// 6. يتم التحقق مما إذا كانت القيمة المحولة أكبر من 0، فإذا كانت كذلك، يتم إرجاعها كسعر الصرف الحالي، وإلا يتم إرجاع القيمة الافتراضية DEFAULT_TURKEY_EXCHANGE_RATE.
// 
  try {
    const settings = await prisma.generalSetting.findFirst({
      orderBy: { id: "asc" },
      select: { usdToTryRate: true },
    });

    const rate = Number(settings?.usdToTryRate || 0);
    return rate > 0 ? rate : DEFAULT_TURKEY_EXCHANGE_RATE;
  } catch (error) {
    return DEFAULT_TURKEY_EXCHANGE_RATE;
  }
};

const getOrderAmountFromItemsInUSD = (order: {
  finalAmount?: number | null;
  discount?: number | null;
  usdToTryRateAtOrder?: number | null;
  warehouse?: { location?: string | null } | null;
  items?: Array<{ quantity?: number | null; price?: number | null; discount?: number | null }>;
}, exchangeRate: number = DEFAULT_TURKEY_EXCHANGE_RATE) => {
  const effectiveRate = resolveOrderExchangeRate(order, exchangeRate);
  const items = Array.isArray(order.items) ? order.items : [];

  if (items.length === 0) {
    return normalizeOrderAmountToUSD(Number(order.finalAmount || 0), order.warehouse?.location, effectiveRate);
  }

  const itemsTotal = items.reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const unitPrice = Number(item.price || 0);
    const unitDiscount = Number(item.discount || 0);
    const netUnitPrice = Math.max(0, unitPrice - unitDiscount);
    const rawLineAmount = netUnitPrice * quantity;
    return sum + rawLineAmount;
  }, 0);

  const globalDiscount = Math.max(0, Number(order.discount || 0));
  const finalOrderAmount = Math.max(0, itemsTotal - globalDiscount);
  return normalizeOrderAmountToUSD(finalOrderAmount, order.warehouse?.location, effectiveRate);
};

type OrderDateFilter = {
  startDate?: string;
  endDate?: string;
  warehouseLocation?: "سوريا" | "تركيا";
};

type EmployeeReportPeriod = "day" | "week" | "month" | "custom";

type EmployeeReportFilter = {
  period?: EmployeeReportPeriod;
  startDate?: string;
  endDate?: string;
};

const buildOrderDateWhere = (dateFilter?: OrderDateFilter) => {
  const startDate = dateFilter?.startDate ? new Date(dateFilter.startDate) : undefined;
  const endDate = dateFilter?.endDate ? new Date(dateFilter.endDate) : undefined;

  if (startDate && Number.isNaN(startDate.getTime())) return undefined;
  if (endDate && Number.isNaN(endDate.getTime())) return undefined;

  if (startDate) {
    startDate.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  if (!startDate && !endDate) return undefined;

  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
};

const buildWarehouseScope = (warehouseLocation?: string) => {
  const normalized = String(warehouseLocation || "").trim();
  if (normalized !== "سوريا" && normalized !== "تركيا") return undefined;
  return { warehouse: { location: normalized } };
};

const buildPeriodRange = (period: EmployeeReportPeriod) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "day") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "week") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const buildEmployeeRange = (filter?: EmployeeReportFilter) => {
  const period = filter?.period || "month";
  if (period !== "custom") {
    return buildPeriodRange(period);
  }

  const start = filter?.startDate ? new Date(filter.startDate) : null;
  const end = filter?.endDate ? new Date(filter.endDate) : null;

  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    return buildPeriodRange("month");
  }

  const normalizedStart = new Date(start);
  const normalizedEnd = new Date(end);
  normalizedStart.setHours(0, 0, 0, 0);
  normalizedEnd.setHours(23, 59, 59, 999);

  if (normalizedStart > normalizedEnd) {
    return buildPeriodRange("month");
  }

  return { start: normalizedStart, end: normalizedEnd };
};

// src/actions/analytics.ts
export async function GetSalesByStatusAction(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewAll = isAdmin(user) || Boolean(user.permission?.viewOrders);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);
    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(warehouseScope ? warehouseScope : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        customer: true,
        warehouse: {
          select: {
            location: true,
          }
        },
        items: {
          select: {
            quantity: true,
            price: true,
            discount: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const statusGroups: Record<string, any> = {};
    let totalRevenue = 0;
    let lostRevenue = 0;
    
    // عدادات الحالات المطلوبة
    let cancelledCount = 0;
    let missingInfoCount = 0;
    let failedReturnCount = 0;

    orders.forEach(order => {
      const orderAmountUSD = getOrderAmountFromItemsInUSD(order, turkeyExchangeRate);

      if (!statusGroups[order.status]) {
        statusGroups[order.status] = {
          status: order.status,
          count: 0,
          amount: 0,
          ordersDetails: []
        };
      }

      statusGroups[order.status].count += 1;
      statusGroups[order.status].amount += orderAmountUSD;
      
      statusGroups[order.status].ordersDetails.push({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        amount: orderAmountUSD,
      });

      if (order.status === "تم الغاء الطلب") {
        cancelledCount++;
        lostRevenue += orderAmountUSD;
      } else if (order.status === "معلق / نقص معلومات") {
        missingInfoCount++;
      } else if (order.status === "فشل التسليم مرتجع") {
        failedReturnCount++;
        lostRevenue += orderAmountUSD;
      } else {
        totalRevenue += orderAmountUSD;
      }
    });

    return { 
      success: true, 
      data: Object.values(statusGroups),
      summary: {
        totalRevenue,
        lostRevenue,
        grossTotal: totalRevenue + lostRevenue,
        cancelledCount,      // عدد الملغاة
        missingInfoCount,    // عدد نقص المعلومات
        failedReturnCount    // عدد المرتجع
      }
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Internal Server Error" };
  }
}

export async function GetSalesTimelineAction(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewAll = isAdmin(user) || Boolean(user.permission?.viewOrders);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);
    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(warehouseScope ? warehouseScope : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        status: true,
        createdAt: true,
        finalAmount: true,
        discount: true,
        usdToTryRateAtOrder: true,
        warehouse: {
          select: {
            location: true,
          }
        },
        items: {
          select: {
            quantity: true,
            price: true,
            discount: true,
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const timeline: Record<string, any> = {};

    orders.forEach(order => {
      const orderAmountUSD = getOrderAmountFromItemsInUSD(order, turkeyExchangeRate);
      const date = new Date(order.createdAt);
      const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;

      if (!timeline[monthYear]) {
        timeline[monthYear] = {
          label: new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(date),
          statuses: {}
        };
      }

      if (!timeline[monthYear].statuses[order.status]) {
        timeline[monthYear].statuses[order.status] = {
          count: 0,
          amount: 0
        };
      }

      timeline[monthYear].statuses[order.status].count += 1;
      timeline[monthYear].statuses[order.status].amount += orderAmountUSD;
    });

    return { 
      success: true, 
      data: Object.values(timeline)
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Internal Server Error" };
  }
}

// server/analytics.ts
export async function GetCustomerAcquisition(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewCustomers = isAdmin(user) || Boolean(user.permission?.viewCustomers);
    const customerWhere = canViewCustomers ? {} : { users: { some: { id: userId } } };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newCustomers = await prisma.customer.groupBy({
      by: ['createdAt'],
      _count: { id: true },
      where: {
        createdAt: { gte: thirtyDaysAgo },
        ...customerWhere
      },
      orderBy: { createdAt: 'asc' }
    });
    
    return { success: true, data: newCustomers };
  } catch (error) {
    console.error("Error in GetCustomerAcquisition:", error);
    return { success: false, data: [] };
  }
}

export async function GetCustomerAcquisitionMonth(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewCustomers = isAdmin(user) || Boolean(user.permission?.viewCustomers);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const customerWhere = {
      ...(canViewCustomers ? {} : { users: { some: { id: userId } } }),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    // جلب جميع العملاء (أو يمكنك تحديد فترة زمنية أطول مثل آخر سنة)
    const customers = await prisma.customer.findMany({
      where: customerWhere,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    // تجميع العملاء حسب الشهر (YYYY-MM)
    const monthlyGroups: Record<string, number> = {};
    
    customers.forEach(c => {
      const date = new Date(c.createdAt);
      // إنشاء مفتاح فريد للشهر والسنة للترتيب
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      monthlyGroups[key] = (monthlyGroups[key] || 0) + 1;
    });

    // تحويل الكائن إلى مصفوفة مرتبة للرسم البياني
    const chartData = Object.entries(monthlyGroups)
      .sort(([a], [b]) => a.localeCompare(b)) // التأكد من ترتيب الشهور زمنياً
      .map(([key, count]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          date: new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(date),
          "العملاء الجدد": count
        };
      });

    return { success: true, data: chartData };
  } catch (error) {
    console.error("Error in GetCustomerAcquisitionMonth:", error);
    return { success: false, data: [] };
  }
}

export async function GetTopCustomers(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewCustomers = isAdmin(user) || Boolean(user.permission?.viewCustomers);
    const createdAtFilter = buildOrderDateWhere(dateFilter);

    const groupedOrders = await prisma.order.groupBy({
      by: ['customerId'],
      where: {
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        ...(canViewCustomers ? {} : { customer: { users: { some: { id: userId } } } }),
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const customerIds = groupedOrders.map((row) => row.customerId);
    if (customerIds.length === 0) {
      return { success: true, data: [] };
    }

    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });

    const customerMap = new Map(customers.map((row) => [row.id, row.name]));

    const topCustomers = groupedOrders.map((row) => ({
      id: row.customerId,
      name: customerMap.get(row.customerId) || 'عميل غير معروف',
      _count: { orders: row._count.id || 0 },
    }));

    return { success: true, data: topCustomers };
  } catch (error) {
    console.error("Error in GetTopCustomers:", error);
    return { success: false, data: [] };
  }
}

// export async function GetSalesByCity(userId: string, dateFilter?: OrderDateFilter) {
//   try {
//     const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       include: { permission: true }
//     });
    
//     const canViewAll = isAdmin(user) || Boolean(user?.permission?.viewOrders);
//     const createdAtFilter = buildOrderDateWhere(dateFilter);
//     const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);
//     const whereClause = {
//       ...(canViewAll ? {} : { userId: userId }),
//       ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
//       ...(warehouseScope ? warehouseScope : {}),
//     };

//     const orders = await prisma.order.findMany({
//       where: whereClause,
//       select: {
//         finalAmount: true,
//         usdToTryRateAtOrder: true,
//         warehouse: {
//           select: {
//             location: true,
//           }
//         }
//       }
//     });

//     const groupedByWarehouseCountry = orders.reduce((acc, order) => {
//       const warehouseCountry = String(order.warehouse?.location || "غير محدد").trim() || "غير محدد";

//       if (!acc[warehouseCountry]) {
//         acc[warehouseCountry] = {
//           location: warehouseCountry,
//           _count: { id: 0 },
//           _sum: { finalAmount: 0 },
//         };
//       }

//       acc[warehouseCountry]._count.id += 1;
//       const effectiveRate = resolveOrderExchangeRate(order, turkeyExchangeRate);
//       acc[warehouseCountry]._sum.finalAmount += normalizeOrderAmountToUSD(
//         Number(order.finalAmount || 0),
//         order.warehouse?.location,
//         effectiveRate
//       );
//       return acc;
//     }, {} as Record<string, { location: string; _count: { id: number }; _sum: { finalAmount: number } }>);

//     const citySales = Object.values(groupedByWarehouseCountry).sort(
//       (a, b) => (b._sum.finalAmount || 0) - (a._sum.finalAmount || 0)
//     );

//     return { success: true, data: citySales };
//   } catch (error) {
//     return { success: false, data: [] };
//   }
// }

export async function GetSalesByCity(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });
    
    const canViewAll = isAdmin(user) || Boolean(user?.permission?.viewOrders);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);

    // تحديث شروط البحث لتعمل مع التاريخ اليدوي
    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(warehouseScope ? warehouseScope : {}),
      ...(createdAtFilter ? {
        OR: [
          { manualCreatedAt: createdAtFilter },
          { AND: [
              { manualCreatedAt: null }, 
              { createdAt: createdAtFilter }
            ] 
          }
        ]
      } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        finalAmount: true,
        usdToTryRateAtOrder: true,
        manualCreatedAt: true, // جلب التاريخ اليدوي
        createdAt: true,       // جلب التاريخ الأصلي
        warehouse: {
          select: {
            location: true,
          }
        }
      }
    });

    const groupedByWarehouseCountry = orders.reduce((acc, order) => {
      const warehouseCountry = String(order.warehouse?.location || "غير محدد").trim() || "غير محدد";

      if (!acc[warehouseCountry]) {
        acc[warehouseCountry] = {
          location: warehouseCountry,
          _count: { id: 0 },
          _sum: { finalAmount: 0 },
        };
      }

      acc[warehouseCountry]._count.id += 1;
      const effectiveRate = resolveOrderExchangeRate(order, turkeyExchangeRate);
      
      acc[warehouseCountry]._sum.finalAmount += normalizeOrderAmountToUSD(
        Number(order.finalAmount || 0),
        order.warehouse?.location,
        effectiveRate
      );
      return acc;
    }, {} as Record<string, { location: string; _count: { id: number }; _sum: { finalAmount: number } }>);

    const citySales = Object.values(groupedByWarehouseCountry).sort(
      (a, b) => (b._sum.finalAmount || 0) - (a._sum.finalAmount || 0)
    );

    return { success: true, data: citySales };
  } catch (error) {
    console.error("Error in GetSalesByCity:", error);
    return { success: false, data: [] };
  }
}

export async function GetOrdersByCity(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found", data: [] };

    const canViewAll = isAdmin(user) || Boolean(user?.permission?.viewOrders);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);

    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(warehouseScope ? warehouseScope : {}),
      ...(createdAtFilter ? {
        OR: [
          { manualCreatedAt: createdAtFilter },
          {
            AND: [
              { manualCreatedAt: null },
              { createdAt: createdAtFilter }
            ]
          }
        ]
      } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        city: true,
        finalAmount: true,
        usdToTryRateAtOrder: true,
        warehouse: {
          select: {
            location: true,
          }
        }
      }
    });

    const groupedByCity = orders.reduce((acc, order) => {
      const cityName = String(order.city || "غير محدد").trim() || "غير محدد";

      if (!acc[cityName]) {
        acc[cityName] = {
          city: cityName,
          _count: { id: 0 },
          _sum: { finalAmount: 0 },
        };
      }

      acc[cityName]._count.id += 1;
      const effectiveRate = resolveOrderExchangeRate(order, turkeyExchangeRate);
      acc[cityName]._sum.finalAmount += normalizeOrderAmountToUSD(
        Number(order.finalAmount || 0),
        order.warehouse?.location,
        effectiveRate
      );

      return acc;
    }, {} as Record<string, { city: string; _count: { id: number }; _sum: { finalAmount: number } }>);

    const cityOrderAnalytics = Object.values(groupedByCity).sort(
      (a, b) => (b._sum.finalAmount || 0) - (a._sum.finalAmount || 0)
    );

    return { success: true, data: cityOrderAnalytics };
  } catch (error) {
    console.error("Error in GetOrdersByCity:", error);
    return { success: false, data: [] };
  }
}

export async function GetShippingTotalsByCompany(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found", data: [] };

    const canViewAll = isAdmin(user) || Boolean(user?.permission?.viewOrders);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);

    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(warehouseScope ? warehouseScope : {}),
      ...(createdAtFilter ? {
        OR: [
          { manualCreatedAt: createdAtFilter },
          {
            AND: [
              { manualCreatedAt: null },
              { createdAt: createdAtFilter }
            ]
          }
        ]
      } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        shippingPrice: true,
        usdToTryRateAtOrder: true,
        shipping: {
          select: {
            name: true,
          }
        },
        warehouse: {
          select: {
            location: true,
          }
        }
      }
    });

    const groupedByCompany = orders.reduce((acc, order) => {
      const companyName = String(order.shipping?.name || "غير محدد").trim() || "غير محدد";
      const effectiveRate = resolveOrderExchangeRate(order, turkeyExchangeRate);
      const shippingValue = normalizeOrderAmountToUSD(
        Number(order.shippingPrice || 0),
        order.warehouse?.location,
        effectiveRate
      );

      if (!acc[companyName]) {
        acc[companyName] = {
          company: companyName,
          _count: { id: 0 },
          _sum: { shippingTotal: 0 },
        };
      }

      acc[companyName]._count.id += 1;
      acc[companyName]._sum.shippingTotal += shippingValue;
      return acc;
    }, {} as Record<string, { company: string; _count: { id: number }; _sum: { shippingTotal: number } }>);

    const shippingTotals = Object.values(groupedByCompany).sort(
      (a, b) => (b._sum.shippingTotal || 0) - (a._sum.shippingTotal || 0)
    );

    return { success: true, data: shippingTotals };
  } catch (error) {
    console.error("Error in GetShippingTotalsByCompany:", error);
    return { success: false, data: [] };
  }
}

export async function GetDailyExpensesAnalytics(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found", data: [] };

    const isAdminUser = isAdmin(user);
    const canViewExpenses = isAdminUser || Boolean(user?.permission?.viewExpenses);
    if (!canViewExpenses) return { success: true, data: [], summary: { USD: 0, TRY: 0, SYP: 0 } };

    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const allowedPaidOffices: Array<"SYRIA" | "TURKEY"> = [];
    if (user?.permission?.accessSyria === true) allowedPaidOffices.push("SYRIA");
    if (user?.permission?.accessTurkey === true) allowedPaidOffices.push("TURKEY");

    const whereClause: any = {
      type: "DAILY",
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    if (!isAdminUser) {
      if (allowedPaidOffices.length === 0) {
        return { success: true, data: [], summary: { USD: 0, TRY: 0, SYP: 0 } };
      }
      whereClause.paidFromOffice = { in: allowedPaidOffices };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      select: {
        amount: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const groupedByDay = expenses.reduce((acc, expense) => {
      const dateKey = new Date(expense.createdAt).toISOString().split("T")[0];
      const currencyKey = String(expense.currency || "USD").toUpperCase();
      const safeAmount = Number(expense.amount || 0);

      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          count: 0,
          USD: 0,
          TRY: 0,
          SYP: 0,
        };
      }

      acc[dateKey].count += 1;
      if (currencyKey === "TRY") {
        acc[dateKey].TRY += safeAmount;
      } else if (currencyKey === "SYP") {
        acc[dateKey].SYP += safeAmount;
      } else {
        acc[dateKey].USD += safeAmount;
      }

      return acc;
    }, {} as Record<string, { date: string; count: number; USD: number; TRY: number; SYP: number }>);

    const dailyData = Object.values(groupedByDay).sort((a, b) => a.date.localeCompare(b.date));

    const summary = dailyData.reduce(
      (acc, day) => {
        acc.USD += Number(day.USD || 0);
        acc.TRY += Number(day.TRY || 0);
        acc.SYP += Number(day.SYP || 0);
        return acc;
      },
      { USD: 0, TRY: 0, SYP: 0 }
    );

    return { success: true, data: dailyData, summary };
  } catch (error) {
    console.error("Error in GetDailyExpensesAnalytics:", error);
    return { success: false, data: [], summary: { USD: 0, TRY: 0, SYP: 0 } };
  }
}
// src/actions/analytics.ts

export async function GetCustomerInteractions(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewCustomers = isAdmin(user) || Boolean(user.permission?.viewCustomers);

    // 1. فلترة العملاء
    const whereClause = canViewCustomers
      ? {}
      : { users: { some: { id: userId } } };

    // 2. فلترة الرسائل داخل العد (للإحصاء الدقيق)
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const messageFilter = {
      ...(canViewCustomers ? {} : { userId: userId }),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const interactions = await prisma.customer.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        _count: {
          select: { 
            message: { where: messageFilter } // الفلترة هنا مهمة جداً
          }
        }
      },
      take: 100
    });

    const topInteractions = interactions
      .sort((a, b) => (b._count?.message || 0) - (a._count?.message || 0))
      .slice(0, 10);

    return { success: true, data: topInteractions };
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}

export async function GetBestSellingProducts(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found", data: [] };

    const canViewAllOrders = isAdmin(user) || Boolean(user.permission?.viewOrders);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);

    const bestSellers = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          ...(canViewAllOrders ? {} : { userId: userId }),
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
          ...(warehouseScope ? warehouseScope : {}),
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 10,
    });

    const productIds = bestSellers.map((item) => item.productId);
    if (productIds.length === 0) return { success: true, data: [] };

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    });

    const productNameMap = new Map(products.map((row) => [row.id, row.name]));

    const productsWithDetails = bestSellers.map((item) => ({
      id: item.productId,
      name: productNameMap.get(item.productId) || "منتج غير معروف",
      totalSold: Number(item._sum.quantity || 0),
    }));

    return { success: true, data: productsWithDetails };
  } catch (error) {
    console.error("Error in GetBestSellingProducts:", error);
    return { success: false, data: [] };
  }
}

export async function GetLowStockProducts(userId: string, threshold = 5) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found", data: [] };

    const canViewProducts = isAdmin(user) || Boolean(user.permission?.viewProducts);
    if (!canViewProducts) return { success: true, data: [] };

    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        stocks: {
          select: {
            quantity: true,
            warehouse: {
              select: {
                location: true,
              }
            }
          }
        }
      }
    });

    const lowStock = allProducts
      .map((product) => {
        const stock = (product.stocks || []).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
        return {
          id: product.id,
          name: product.name,
          stock,
        };
      })
      .filter((product) => product.stock <= threshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    return { success: true, data: lowStock };
  } catch (error) {
    console.error("Error in GetLowStockProducts:", error);
    return { success: false, data: [] };
  }
}

// المستخدمين الأكثر مبيعا

export async function GetTopSellingUsers() {
  return { success: true, data: [] };
}

export async function GetEmployeeCustomerReport(userId: string, periodOrFilter: EmployeeReportPeriod | EmployeeReportFilter = "month") {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!currentUser) return { success: false, error: "User not found", data: [] };

    const canViewEmployees = isAdmin(currentUser) || Boolean(currentUser.permission?.viewEmployees);
    if (!canViewEmployees) return { success: true, data: [] };

    const normalizedFilter: EmployeeReportFilter =
      typeof periodOrFilter === "string"
        ? { period: periodOrFilter }
        : (periodOrFilter || { period: "month" });

    const periodRange = buildEmployeeRange(normalizedFilter);
    const deliveredStatuses = ["تم تسليم الطلب", "مدفوعة", "تم التسليم", "تم البيع"];

    const employees = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
      },
      orderBy: {
        username: "asc",
      }
    });

    if (employees.length === 0) {
      return { success: true, data: [] };
    }

    const employeeIds = employees.map((employee) => employee.id);

    const communicationGroups = await prisma.message.groupBy({
      by: ["userId"],
      where: {
        userId: { in: employeeIds },
        createdAt: {
          gte: periodRange.start,
          lte: periodRange.end,
        },
      },
      _count: {
        _all: true,
      },
    });

    const communicatedCustomersByUser = new Map<string, number>();
    communicationGroups.forEach((item) => {
      communicatedCustomersByUser.set(item.userId, item._count._all || 0);
    });

    const newCustomers = await prisma.customer.findMany({
      where: {
        createdAt: {
          gte: periodRange.start,
          lte: periodRange.end,
        },
      },
      select: {
        users: {
          select: {
            id: true,
          }
        }
      }
    });

    const addedCustomersByUser = new Map<string, number>();
    newCustomers.forEach((customer) => {
      const distinctIds = new Set((customer.users || []).map((user) => user.id));
      distinctIds.forEach((id) => {
        const previous = addedCustomersByUser.get(id) || 0;
        addedCustomersByUser.set(id, previous + 1);
      });
    });

    const deliveredGroups = await prisma.order.groupBy({
      by: ["userId", "customerId"],
      where: {
        userId: { in: employeeIds },
        status: { in: deliveredStatuses },
        createdAt: {
          gte: periodRange.start,
          lte: periodRange.end,
        },
      },
    });

    const deliveredCustomersByUser = new Map<string, number>();
    deliveredGroups.forEach((item) => {
      if (!item.userId) return;
      const previous = deliveredCustomersByUser.get(item.userId) || 0;
      deliveredCustomersByUser.set(item.userId, previous + 1);
    });

    const createdOrdersByUserRows = await prisma.order.groupBy({
      by: ["userId"],
      where: {
        userId: { in: employeeIds },
        createdAt: {
          gte: periodRange.start,
          lte: periodRange.end,
        },
      },
      _count: {
        id: true,
      },
    });

    const createdOrdersByUser = new Map<string, number>();
    createdOrdersByUserRows.forEach((row) => {
      if (!row.userId) return;
      createdOrdersByUser.set(row.userId, row._count.id || 0);
    });

    const data = employees
      .map((employee) => ({
        userId: employee.id,
        name: employee.username || "مستخدم غير معروف",
        communicatedCustomers: communicatedCustomersByUser.get(employee.id) || 0,
        addedCustomers: addedCustomersByUser.get(employee.id) || 0,
        deliveredCustomers: deliveredCustomersByUser.get(employee.id) || 0,
        createdOrders: createdOrdersByUser.get(employee.id) || 0,
      }))
      .sort((a, b) => b.deliveredCustomers - a.deliveredCustomers);

    return {
      success: true,
      data,
      range: {
        startDate: periodRange.start,
        endDate: periodRange.end,
        period: normalizedFilter.period || "month",
      }
    };
  } catch (error) {
    console.error("Error in GetEmployeeCustomerReport:", error);
    return { success: false, data: [], error: "Internal Server Error" };
  }
}

export async function GetTopSellingUsersByPermission(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewEmployees = isAdmin(user) || Boolean(user.permission?.viewEmployees);
    if (!canViewEmployees) return { success: true, data: [] };

    const statusBlacklist = ["تم الغاء الطلب", "فشل التسليم مرتجع"];
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const warehouseScope = buildWarehouseScope(dateFilter?.warehouseLocation);

    const revenueOrders = await prisma.order.findMany({
      where: {
        userId: { not: null },
        status: { notIn: statusBlacklist },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        ...(warehouseScope ? warehouseScope : {}),
      },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        finalAmount: true,
        discount: true,
        usdToTryRateAtOrder: true,
        status: true,
        createdAt: true,
        warehouse: {
          select: {
            location: true,
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
          }
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            discount: true,
            product: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const salesByUser = new Map<string, number>();
    const deliveredOrdersByUser = new Map<string, number>();

    for (const order of revenueOrders) {
      if (!order.userId) continue;
      const amountUSD = getOrderAmountFromItemsInUSD(order, turkeyExchangeRate);
      const currentSales = salesByUser.get(order.userId) || 0;
      salesByUser.set(order.userId, currentSales + amountUSD);

      const currentDelivered = deliveredOrdersByUser.get(order.userId) || 0;
      deliveredOrdersByUser.set(order.userId, currentDelivered + 1);
    }

    const userIds = Array.from(salesByUser.keys());
    if (userIds.length === 0) {
      return { success: true, data: [] };
    }

    const allOrdersCounts = await Promise.all(
      userIds.map(async (id) => ({
        userId: id,
        count: await prisma.order.count({
          where: {
            userId: id,
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
            ...(warehouseScope ? warehouseScope : {}),
          },
        }),
      }))
    );

    const allOrdersCountByUser = new Map(
      allOrdersCounts.map(item => [item.userId, item.count || 0])
    );

    const userDetails = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        username: true
      }
    });

    const finalData = userIds
      .map((id) => {
        const userInfo = userDetails.find((u) => u.id === id);
        const userOrders = revenueOrders
          .filter((order) => order.userId === id)
          .map((order) => ({
            ...order,
            orderAmountUSD: getOrderAmountFromItemsInUSD(order, turkeyExchangeRate),
          }));
        const totalOrdersAll = allOrdersCountByUser.get(id) || 0;
        const deliveredOrders = deliveredOrdersByUser.get(id) || 0;

        return {
          userId: id,
          name: userInfo?.username || "مستخدم غير معروف",
          totalOrders: totalOrdersAll,
          totalOrdersAll,
          deliveredOrders,
          totalSalesAmount: salesByUser.get(id) || 0,
          orders: userOrders
        };
      })
      .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount)
      .slice(0, 10);

    return { success: true, data: finalData };
  } catch (error) {
    console.error("Error in GetTopSellingUsersByPermission:", error);
    return { success: false, data: [] };
  }
}

export async function GetUserTargetProgress(userId: string, monthKey?: string) {
  try {
    const turkeyExchangeRate = await getTurkeyExchangeRateFromSettings();
    const session = cookies().get("skynova")?.value;
    const decoded = session ? await decrypt(session) : null;
    const sessionUserId = String(decoded?.userId || "").trim();
    const requestedUserId = String(userId || "").trim();

    const currentUser = await prisma.user.findUnique({
      where: { id: sessionUserId || requestedUserId },
      include: { permission: true }
    });

    if (!currentUser) return { success: false, data: [], error: "User not found" };

    const isAdminUser = isAdmin(currentUser);
    const isImpersonating = isAdminUser && requestedUserId && requestedUserId !== sessionUserId;
    const effectiveUserId = isImpersonating ? requestedUserId : (sessionUserId || requestedUserId);

    const canViewAllTargets = isAdminUser && !isImpersonating;

    const statusBlacklist = ["تم الغاء الطلب", "فشل التسليم مرتجع"];

    const monthRange = (() => {
      if (!monthKey) return null;
      const match = monthKey.match(/^(\d{4})-(\d{2})$/);
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (!year || !month) return null;
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      return { start, end };
    })();

    const rawTargets = canViewAllTargets
      ? await prisma.userTarget.findMany({
          include: {
            user: { select: { id: true, username: true } },
            products: {
              include: { product: { select: { id: true, name: true } } }
            }
          }
        })
      : await prisma.userTarget.findMany({
          where: { userId: effectiveUserId },
          include: {
            user: { select: { id: true, username: true } },
            products: {
              include: { product: { select: { id: true, name: true } } }
            }
          }
        });

    const now = new Date();
    const targets = rawTargets.filter((target: any) => {
      if (target?.isActive === false) return false;

      const startAt = target?.createdAt ? new Date(target.createdAt) : null;
      const endAt = target?.endedAt ? new Date(target.endedAt) : null;
      if (startAt && Number.isNaN(startAt.getTime())) return false;
      if (endAt && Number.isNaN(endAt.getTime())) return false;

      if (monthRange) {
        if (startAt && startAt > monthRange.end) return false;
        if (endAt && endAt < monthRange.start) return false;
        return true;
      }

      if (startAt && startAt > now) return false;
      if (endAt && endAt < now) return false;
      return true;
    });

    const dateWhereClause = monthRange ? {
      OR: [
        {
          manualCreatedAt: {
            gte: monthRange.start,
            lte: monthRange.end,
          }
        },
        {
          AND: [
            { manualCreatedAt: null },
            { createdAt: { gte: monthRange.start, lte: monthRange.end } }
          ]
        }
      ]
    } : {};
    const orderScope = { userId: effectiveUserId };

    
    const revenueOrders = await prisma.order.findMany({
      where: {
        ...orderScope,
        status: { notIn: statusBlacklist },
        ...dateWhereClause,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        userId: true,
        finalAmount: true,
        discount: true,
        usdToTryRateAtOrder: true,
        shippingPrice: true,
        items: {
          select: {
            quantity: true,
            price: true,
            discount: true,
          }
        },
        warehouse: {
          select: {
            location: true,
          }
        }
      }
    });

    const scopedOrders = await prisma.order.findMany({
      where: {
        ...orderScope,
        ...dateWhereClause,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        finalAmount: true,
        discount: true,
        usdToTryRateAtOrder: true,
        items: {
          select: {
            quantity: true,
            price: true,
            discount: true,
          }
        },
        warehouse: {
          select: {
            location: true,
          }
        }
      }
    });

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          ...(canViewAllTargets ? {} : { userId: effectiveUserId }),
          status: { notIn: statusBlacklist },
          ...dateWhereClause,
        }
      },
      select: {
        orderId: true,
        productId: true,
        quantity: true,
        price: true,
        discount: true,
        product: {
          select: {
            name: true,
          }
        },
        order: {
          select: {
            userId: true,
            orderNumber: true,
            discount: true,
            usdToTryRateAtOrder: true,
            createdAt: true,
            warehouse: {
              select: {
                location: true,
              }
            }
          }
        }
      }
    });

    const countScope = canViewAllTargets ? {} : { userId: effectiveUserId };

    const deliveredOrdersCount = await prisma.order.count({
      where: {
        ...countScope,
        status: { notIn: statusBlacklist },
        ...dateWhereClause,
      }
    });

    const totalOrdersCount = await prisma.order.count({
      where: {
        ...countScope,
        ...dateWhereClause,
      }
    });

    const soldMap = new Map<string, Array<{ createdAt: Date; quantity: number; amount: number }>>();
    const totalSoldByUser = new Map<string, number>();
    const exchangeRateMap = new Map<string, {
      label: string;
      exchangeRate: number | null;
      sourceType: "TRY_CONVERTED" | "USD_DIRECT";
      revenue: number;
      shipping: number;
      orderIds: Set<number>;
    }>();
    const productBreakdownMap = new Map<string, { productId: number; productName: string; quantity: number; revenue: number; orderIds: Set<number> }>();
    const dailySalesMap = new Map<string, { date: string; revenue: number; quantity: number; orderIds: Set<number> }>();

    const orderItemsRawTotals = new Map<number, number>();
    for (const item of orderItems) {
      const netPrice = Math.max(0, Number(item.price || 0) - Number(item.discount || 0));
      const rawLineAmount = netPrice * Math.max(0, Number(item.quantity || 0));
      const current = orderItemsRawTotals.get(item.orderId) || 0;
      orderItemsRawTotals.set(item.orderId, current + rawLineAmount);
    }

    for (const item of orderItems) {
      const key = `${item.order.userId}:${item.productId}`;
      const netPrice = Math.max(0, Number(item.price || 0) - Number(item.discount || 0));
      const rawLineAmount = netPrice * Math.max(0, Number(item.quantity || 0));
      const orderRawTotal = orderItemsRawTotals.get(item.orderId) || 0;
      const orderGlobalDiscount = Math.max(0, Number(item.order?.discount || 0));
      const discountShare = orderRawTotal > 0 ? (rawLineAmount / orderRawTotal) * orderGlobalDiscount : 0;
      const adjustedLineAmount = Math.max(0, rawLineAmount - discountShare);
      const effectiveRate = resolveOrderExchangeRate(item.order, turkeyExchangeRate);
      const lineAmount = normalizeOrderAmountToUSD(adjustedLineAmount, item.order?.warehouse?.location, effectiveRate);
      const quantity = Math.max(0, Number(item.quantity || 0));
      const list = soldMap.get(key) || [];
      list.push({ createdAt: item.order.createdAt, quantity: item.quantity, amount: lineAmount });
      soldMap.set(key, list);

      const productKey = String(item.productId);
      const currentProduct = productBreakdownMap.get(productKey) || {
        productId: Number(item.productId),
        productName: item.product?.name || `#${item.productId}`,
        quantity: 0,
        revenue: 0,
        orderIds: new Set<number>(),
      };
      currentProduct.quantity += quantity;
      currentProduct.revenue += lineAmount;
      currentProduct.orderIds.add(item.orderId);
      productBreakdownMap.set(productKey, currentProduct);

      const dayKey = new Date(item.order.createdAt).toISOString().slice(0, 10);
      const currentDay = dailySalesMap.get(dayKey) || {
        date: dayKey,
        revenue: 0,
        quantity: 0,
        orderIds: new Set<number>(),
      };
      currentDay.revenue += lineAmount;
      currentDay.quantity += quantity;
      currentDay.orderIds.add(item.orderId);
      dailySalesMap.set(dayKey, currentDay);

      if (item.order.userId) {
        const total = totalSoldByUser.get(item.order.userId) || 0;
        totalSoldByUser.set(item.order.userId, total + lineAmount);
      }
    }

    const data = targets.flatMap((target: any) => {
      const targetUserId = target.user?.id || effectiveUserId;
      const targetStart = target?.createdAt ? new Date(target.createdAt) : new Date(0);
      const targetEnd = target?.endedAt ? new Date(target.endedAt) : new Date();
      const monthSalesForUser = revenueOrders
        .filter((order) => {
          if (String(order?.userId || "") !== String(targetUserId)) return false;
          const orderDate = new Date(order.createdAt);
          return orderDate >= targetStart && orderDate <= targetEnd;
        })
        .reduce((sum, order) => sum + getOrderAmountFromItemsInUSD(order, turkeyExchangeRate), 0);
      const userName = target.user?.username || "";

      if (!target.products || target.products.length === 0) {
        return [
          {
            targetId: target.id,
            targetCreatedAt: target.createdAt,
            salesTargetValue: target.salesTargetValue ?? [],
            salesRewardValue: target.salesRewardValue ?? [],
            userId: targetUserId,
            userName,
            productId: 0,
            productName: "",
            requiredQty: 0,
            rewardValue: 0,
            soldQty: 0,
            soldAmount: monthSalesForUser,
            remaining: 0,
            reached: false,
            isValueOnly: true,
          },
        ];
      }

      return target.products.map((item: any) => {
        const key = `${targetUserId}:${item.productId}`;
        const windowStart = targetStart;
        const windowEnd = targetEnd;
        const soldItems = soldMap.get(key) || [];
        const requiredQty = Array.isArray(item.requiredQty) ? item.requiredQty[0] ?? 0 : item.requiredQty ?? 0;
        const rewardValue = Array.isArray(item.rewardValue) ? item.rewardValue[0] ?? 0 : item.rewardValue ?? 0;
        const soldQty = soldItems
          .filter((sold) => sold.createdAt >= windowStart && sold.createdAt <= windowEnd)
          .reduce((sum, sold) => sum + sold.quantity, 0);
        const soldAmount = monthSalesForUser;
        const remaining = Math.max(requiredQty - soldQty, 0);
        return {
          targetId: target.id,
          targetCreatedAt: target.createdAt,
          targetEndedAt: target.endedAt,
          salesTargetValue: target.salesTargetValue ?? [],
          salesRewardValue: target.salesRewardValue ?? [],
          userId: targetUserId,
          userName,
          productId: item.productId,
          productName: item.product?.name || "",
          requiredQty,
          rewardValue,
          soldQty,
          soldAmount,
          remaining,
          reached: soldQty >= requiredQty,
          isValueOnly: false,
        };
      });
    });

    const totalSalesAmount = revenueOrders.reduce((sum, order) => {
      const converted = getOrderAmountFromItemsInUSD(order, turkeyExchangeRate);
      return sum + converted;
    }, 0);
    const totalShippingAmount = revenueOrders.reduce((sum, order) => {
      const effectiveRate = resolveOrderExchangeRate(order, turkeyExchangeRate);
      const shipping = normalizeOrderAmountToUSD(Number(order.shippingPrice || 0), order.warehouse?.location, effectiveRate);
      return sum + shipping;
    }, 0);
    const netSalesForCommission = Math.max(0, totalSalesAmount - totalShippingAmount);

    for (const order of revenueOrders) {
      const warehouseLocation = String(order.warehouse?.location || "").trim();
      const revenue = getOrderAmountFromItemsInUSD(order, turkeyExchangeRate);
      const effectiveRate = resolveOrderExchangeRate(order, turkeyExchangeRate);
      const shipping = normalizeOrderAmountToUSD(Number(order.shippingPrice || 0), order.warehouse?.location, effectiveRate);
      const isTurkeyOrder = warehouseLocation === "تركيا";
      const key = isTurkeyOrder ? `TRY:${effectiveRate.toFixed(4)}` : "USD_DIRECT";

      const currentRate = exchangeRateMap.get(key) || {
        label: isTurkeyOrder ? `${Number(effectiveRate).toLocaleString("en-US", { maximumFractionDigits: 4 })} TRY` : "USD مباشر",
        exchangeRate: isTurkeyOrder ? Number(effectiveRate) : null,
        sourceType: isTurkeyOrder ? "TRY_CONVERTED" : "USD_DIRECT",
        revenue: 0,
        shipping: 0,
        orderIds: new Set<number>(),
      };

      currentRate.revenue += revenue;
      currentRate.shipping += shipping;
      currentRate.orderIds.add(order.id);
      exchangeRateMap.set(key, currentRate);
    }

    const statusMap = new Map<string, { status: string; count: number; amount: number }>();
    for (const order of scopedOrders) {
      const amount = getOrderAmountFromItemsInUSD(order, turkeyExchangeRate);
      const currentStatus = statusMap.get(order.status) || {
        status: order.status,
        count: 0,
        amount: 0,
      };
      currentStatus.count += 1;
      currentStatus.amount += amount;
      statusMap.set(order.status, currentStatus);
    }

    const exchangeRateBreakdown = Array.from(exchangeRateMap.values())
      .map((row) => ({
        label: row.label,
        exchangeRate: row.exchangeRate,
        sourceType: row.sourceType,
        revenue: Number(row.revenue.toFixed(2)),
        shipping: Number(row.shipping.toFixed(2)),
        netRevenue: Number(Math.max(0, row.revenue - row.shipping).toFixed(2)),
        ordersCount: row.orderIds.size,
      }))
      .sort((a, b) => {
        if (a.sourceType === b.sourceType) {
          return b.revenue - a.revenue;
        }
        return a.sourceType === "TRY_CONVERTED" ? -1 : 1;
      });

    const productBreakdown = Array.from(productBreakdownMap.values())
      .map((row) => ({
        productId: row.productId,
        productName: row.productName,
        quantity: row.quantity,
        revenue: Number(row.revenue.toFixed(2)),
        ordersCount: row.orderIds.size,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const dailySalesBreakdown = Array.from(dailySalesMap.values())
      .map((row) => ({
        date: row.date,
        quantity: row.quantity,
        revenue: Number(row.revenue.toFixed(2)),
        ordersCount: row.orderIds.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const statusBreakdown = Array.from(statusMap.values())
      .map((row) => ({
        status: row.status,
        count: row.count,
        amount: Number(row.amount.toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count);

    const targetUser = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { salesCommissionPercent: true }
    });

    const assignedCommissionPercent = Number(targetUser?.salesCommissionPercent || 0);
    const totalCommissionAmount = (netSalesForCommission * assignedCommissionPercent) / 100;
    const commissionPercent = netSalesForCommission > 0
      ? Number(((totalCommissionAmount / netSalesForCommission) * 100).toFixed(2))
      : 0;

    return {
      success: true,
      data,
      summary: {
        totalSalesAmount,
        totalShippingAmount,
        netSalesForCommission,
        totalOrdersCount,
        deliveredOrdersCount,
        totalCommissionAmount,
        commissionPercent,
        assignedCommissionPercent,
        exchangeRateBreakdown,
        productBreakdown,
        dailySalesBreakdown,
        statusBreakdown
      }
    };
  } catch (error) {
    console.error("Error in GetUserTargetProgress:", error);
    return { success: false, data: [], error: "Internal Server Error" };
  }
}

export async function GetEmployeeActivitySummary(userId: string, filter: EmployeeReportFilter = { period: "month" }) {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!currentUser) {
      return { success: false, error: "User not found", data: null };
    }

    const periodRange = buildEmployeeRange(filter);

    const [messagesCount, ordersCount, addedCustomersCount] = await Promise.all([
      prisma.message.count({
        where: {
          userId,
          createdAt: { gte: periodRange.start, lte: periodRange.end },
        },
      }),
      prisma.order.count({
        where: {
          userId,
          createdAt: { gte: periodRange.start, lte: periodRange.end },
        },
      }),
      prisma.customer.count({
        where: {
          createdAt: { gte: periodRange.start, lte: periodRange.end },
          users: { some: { id: userId } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        userId,
        userName: currentUser.username,
        communicatedMessages: messagesCount,
        createdOrders: ordersCount,
        addedCustomers: addedCustomersCount,
      },
      range: {
        startDate: periodRange.start,
        endDate: periodRange.end,
        period: filter.period || "month",
      },
    };
  } catch (error) {
    console.error("Error in GetEmployeeActivitySummary:", error);
    return { success: false, data: null, error: "Internal Server Error" };
  }
}