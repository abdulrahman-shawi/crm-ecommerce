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

const getTurkeyExchangeRateFromSettings = async () => {
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
  warehouse?: { location?: string | null } | null;
  items?: Array<{ quantity?: number | null; price?: number | null; discount?: number | null }>;
}, exchangeRate: number = DEFAULT_TURKEY_EXCHANGE_RATE) => {
  const items = Array.isArray(order.items) ? order.items : [];

  if (items.length === 0) {
    return normalizeOrderAmountToUSD(Number(order.finalAmount || 0), order.warehouse?.location, exchangeRate);
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
  return normalizeOrderAmountToUSD(finalOrderAmount, order.warehouse?.location, exchangeRate);
};

type OrderDateFilter = {
  startDate?: string;
  endDate?: string;
};

type EmployeeReportPeriod = "day" | "week" | "month";

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
    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
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
    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        status: true,
        createdAt: true,
        finalAmount: true,
        discount: true,
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

export async function GetSalesByCity(userId: string, dateFilter?: OrderDateFilter) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });
    
    const canViewAll = isAdmin(user) || Boolean(user?.permission?.viewOrders);
    const createdAtFilter = buildOrderDateWhere(dateFilter);
    const whereClause = {
      ...(canViewAll ? {} : { userId: userId }),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        finalAmount: true,
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
          country: warehouseCountry,
          _count: { id: 0 },
          _sum: { finalAmount: 0 },
        };
      }

      acc[warehouseCountry]._count.id += 1;
      acc[warehouseCountry]._sum.finalAmount += Number(order.finalAmount || 0);
      return acc;
    }, {} as Record<string, { country: string; _count: { id: number }; _sum: { finalAmount: number } }>);

    const citySales = Object.values(groupedByWarehouseCountry).sort(
      (a, b) => (b._sum.finalAmount || 0) - (a._sum.finalAmount || 0)
    );

    return { success: true, data: citySales };
  } catch (error) {
    return { success: false, data: [] };
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

    const bestSellers = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          ...(canViewAllOrders ? {} : { userId: userId }),
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
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

export async function GetEmployeeCustomerReport(userId: string, period: EmployeeReportPeriod = "month") {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!currentUser) return { success: false, error: "User not found", data: [] };

    const canViewEmployees = isAdmin(currentUser) || Boolean(currentUser.permission?.viewEmployees);
    if (!canViewEmployees) return { success: true, data: [] };

    const periodRange = buildPeriodRange(period);
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
      by: ["userId", "customerId"],
      where: {
        userId: { in: employeeIds },
        createdAt: {
          gte: periodRange.start,
          lte: periodRange.end,
        },
      },
    });

    const communicatedCustomersByUser = new Map<string, number>();
    communicationGroups.forEach((item) => {
      const previous = communicatedCustomersByUser.get(item.userId) || 0;
      communicatedCustomersByUser.set(item.userId, previous + 1);
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

    const data = employees
      .map((employee) => ({
        userId: employee.id,
        name: employee.username || "مستخدم غير معروف",
        communicatedCustomers: communicatedCustomersByUser.get(employee.id) || 0,
        addedCustomers: addedCustomersByUser.get(employee.id) || 0,
        deliveredCustomers: deliveredCustomersByUser.get(employee.id) || 0,
      }))
      .sort((a, b) => b.deliveredCustomers - a.deliveredCustomers);

    return {
      success: true,
      data,
      range: {
        startDate: periodRange.start,
        endDate: periodRange.end,
        period,
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

    const revenueOrders = await prisma.order.findMany({
      where: {
        userId: { not: null },
        status: { notIn: statusBlacklist },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        finalAmount: true,
        discount: true,
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
    const scopedUserId = decoded?.userId || userId;

    const currentUser = await prisma.user.findUnique({
      where: { id: scopedUserId },
      include: { permission: true }
    });

    if (!currentUser) return { success: false, data: [], error: "User not found" };

    const canViewAllTargets = isAdmin(currentUser);
    const targets = canViewAllTargets
      ? await prisma.userTarget.findMany({
          include: {
            user: { select: { id: true, username: true } },
            products: {
              include: { product: { select: { id: true, name: true } } }
            }
          }
        })
      : await prisma.userTarget.findMany({
          where: { userId: scopedUserId },
          include: {
            products: {
              include: { product: { select: { id: true, name: true } } }
            }
          }
        });

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

    const revenueOrders = await prisma.order.findMany({
      where: {
        userId: scopedUserId,
        status: { notIn: statusBlacklist },
        ...(monthRange
          ? {
              createdAt: {
                gte: monthRange.start,
                lte: monthRange.end,
              },
            }
          : {}),
      },
      select: {
        userId: true,
        finalAmount: true,
        discount: true,
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
          ...(canViewAllTargets ? {} : { userId: scopedUserId }),
          status: { notIn: statusBlacklist },
          ...(monthRange
            ? {
                createdAt: {
                  gte: monthRange.start,
                  lte: monthRange.end,
                },
              }
            : {}),
        }
      },
      select: {
        orderId: true,
        productId: true,
        quantity: true,
        price: true,
        discount: true,
        order: {
          select: {
            userId: true,
            discount: true,
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

    const deliveredOrdersCount = await prisma.order.count({
      where: {
        userId: scopedUserId,
        status: { notIn: statusBlacklist },
        ...(monthRange
          ? {
              createdAt: {
                gte: monthRange.start,
                lte: monthRange.end,
              },
            }
          : {}),
      }
    });

    const totalOrdersCount = await prisma.order.count({
      where: {
        userId: scopedUserId,
        ...(monthRange
          ? {
              createdAt: {
                gte: monthRange.start,
                lte: monthRange.end,
              },
            }
          : {}),
      }
    });

    const soldMap = new Map<string, Array<{ createdAt: Date; quantity: number; amount: number }>>();
    const totalSoldByUser = new Map<string, number>();

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
      const lineAmount = normalizeOrderAmountToUSD(adjustedLineAmount, item.order?.warehouse?.location, turkeyExchangeRate);
      const list = soldMap.get(key) || [];
      list.push({ createdAt: item.order.createdAt, quantity: item.quantity, amount: lineAmount });
      soldMap.set(key, list);

      if (item.order.userId) {
        const total = totalSoldByUser.get(item.order.userId) || 0;
        totalSoldByUser.set(item.order.userId, total + lineAmount);
      }
    }

    const data = targets.flatMap((target: any) => {
      const targetUserId = canViewAllTargets ? target.user?.id : currentUser.id;
      const monthSalesForUser = totalSoldByUser.get(String(targetUserId)) || 0;
      const userName = canViewAllTargets ? target.user?.username || "" : currentUser.username || "";

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
        const windowEnd = target.endedAt || new Date();
        const soldItems = soldMap.get(key) || [];
        const requiredQty = Array.isArray(item.requiredQty) ? item.requiredQty[0] ?? 0 : item.requiredQty ?? 0;
        const rewardValue = Array.isArray(item.rewardValue) ? item.rewardValue[0] ?? 0 : item.rewardValue ?? 0;
        const soldQty = soldItems
          .filter((sold) => sold.createdAt <= windowEnd)
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
    const assignedCommissionPercent = Number(currentUser.salesCommissionPercent || 0);
    const totalCommissionAmount = (totalSalesAmount * assignedCommissionPercent) / 100;
    const commissionPercent = totalSalesAmount > 0
      ? Number(((totalCommissionAmount / totalSalesAmount) * 100).toFixed(2))
      : 0;

    return {
      success: true,
      data,
      summary: {
        totalSalesAmount,
        totalOrdersCount,
        deliveredOrdersCount,
        totalCommissionAmount,
        commissionPercent,
        assignedCommissionPercent
      }
    };
  } catch (error) {
    console.error("Error in GetUserTargetProgress:", error);
    return { success: false, data: [], error: "Internal Server Error" };
  }
}