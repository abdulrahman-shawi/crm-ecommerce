// src/actions/analytics.ts
"use server"
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdmin } from "@/lib/utils";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";

// src/actions/analytics.ts
export async function GetSalesByStatusAction(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewAll = isAdmin(user) || Boolean(user.permission?.viewOrders);
    const whereClause = canViewAll ? {} : { userId: userId };

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        customer: true, // جلب بيانات العميل
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
      if (!statusGroups[order.status]) {
        statusGroups[order.status] = {
          status: order.status,
          count: 0,
          amount: 0,
          ordersDetails: [] // لتخزين قائمة الطلبات بدل المنتجات
        };
      }

      statusGroups[order.status].count += 1;
      statusGroups[order.status].amount += order.finalAmount;
      
      // إضافة بيانات الطلب بدلاً من تجميع المنتجات
      statusGroups[order.status].ordersDetails.push({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        amount: order.finalAmount,
      });

      // منطق الحساب والعدادات
      if (order.status === "تم الغاء الطلب") {
        cancelledCount++;
        lostRevenue += order.finalAmount;
      } else if (order.status === "معلق / نقص معلومات") {
        missingInfoCount++;
        lostRevenue += order.finalAmount;
      } else if (order.status === "فشل التسليم مرتجع") {
        failedReturnCount++;
        lostRevenue += order.finalAmount;
      } else {
        totalRevenue += order.finalAmount;
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

export async function GetSalesTimelineAction(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewAll = isAdmin(user) || Boolean(user.permission?.viewOrders);
    const whereClause = canViewAll ? {} : { userId: userId };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        finalAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' } // من الأقدم للأحدث لرسم الخط الزمني
    });

    // كائن لتخزين البيانات: "الشهر-السنة": { الحالات }
    const timeline: Record<string, any> = {};

    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`; // مثال: 2-2024

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
      timeline[monthYear].statuses[order.status].amount += order.finalAmount;
    });

    return { 
      success: true, 
      data: Object.values(timeline) // تحويلها لمصفوفة لسهولة العرض
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

export async function GetCustomerAcquisitionMonth(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewCustomers = isAdmin(user) || Boolean(user.permission?.viewCustomers);
    const customerWhere = canViewCustomers ? {} : { users: { some: { id: userId } } };

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

export async function GetTopCustomers(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewCustomers = isAdmin(user) || Boolean(user.permission?.viewCustomers);
    const customerWhere = canViewCustomers ? {} : { users: { some: { id: userId } } };

    const topCustomers = await prisma.customer.findMany({
      take: 10, // أعلى 5 عملاء
      where: customerWhere,
      include: {
        _count: { select: { orders: true } }, // عدد الطلبات
      },
      orderBy: {
        orders: { _count: 'desc' }
      }
    });
    return { success: true, data: topCustomers };
  } catch (error) {
    console.error("Error in GetTopCustomers:", error);
    return { success: false, data: [] };
  }
}

export async function GetSalesByCity(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });
    
    const canViewAll = isAdmin(user) || Boolean(user?.permission?.viewOrders);
    const whereClause = canViewAll ? {} : { userId: userId };

    const citySales = await prisma.order.groupBy({
      by: ['country'],
      where: whereClause,
      _count: { id: true },
      _sum: { finalAmount: true },
      orderBy: {
        _sum: { finalAmount: 'desc' }
      }
    });
    return { success: true, data: citySales };
  } catch (error) {
    return { success: false, data: [] };
  }
}

// src/actions/analytics.ts

export async function GetCustomerInteractions(userId: string) {
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
    const messageFilter = canViewCustomers ? {} : { userId: userId };

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
      orderBy: {
        message: { _count: 'desc' }
      },
      take: 10
    });

    return { success: true, data: interactions };
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}

export async function GetBestSellingProducts() {
  const bestSellers = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: {
      quantity: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: 5, // جلب أفضل 5 منتجات فقط
  });

  // جلب تفاصيل أسماء المنتجات بعد الحصول على الـ IDs
  const productsWithDetails = await Promise.all(
    bestSellers.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true, price: true }
      });
      return {
        ...product,
        totalSold: item._sum.quantity,
      };
    })
  );

  return { success: true, data: productsWithDetails };
}

export async function GetLowStockProducts() {
  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      quantity: true,
    }
  });

  // تصفية المنتجات التي كميتها أقل من 5
  // نقوم بتحويل النص إلى رقم للمقارنة
  const lowStock = allProducts
    .filter(p => p.quantity !== null && parseInt(p.quantity) <= 5)
    .map(p => ({
      name: p.name,
      stock: parseInt(p.quantity || "0"),
    }));

  return { success: true, data: lowStock };
}

// المستخدمين الأكثر مبيعا

export async function GetTopSellingUsers() {
  return { success: true, data: [] };
}

export async function GetTopSellingUsersByPermission(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permission: true }
    });

    if (!user) return { success: false, error: "User not found" };

    const canViewEmployees = isAdmin(user) || Boolean(user.permission?.viewEmployees);
    if (!canViewEmployees) return { success: true, data: [] };

  // 1. جلب أعلى المستخدمين مبيعاً (كأرقام معرفات فقط)
  const topUsersGrouped = await prisma.order.groupBy({
    by: ['userId'],
    _count: { id: true },
    orderBy: {
      _count: { id: 'desc' }
    },
    take: 5
  });

  // 2. جلب تفاصيل المستخدمين (الأسماء) بناءً على المعرفات
  const userDetails = await prisma.user.findMany({
    where: {
      id: { in: topUsersGrouped.map(u => u.userId).filter(Boolean) as string[] }
    },
    select: {
      id: true,
      username: true
    }
  });

  // 3. دمج البيانات (الاسم مع عدد المبيعات)
  const finalData = topUsersGrouped.map(group => {
    const user = userDetails.find(u => u.id === group.userId);
    return {
      name: user?.username || "مستخدم غير معروف",
      totalSold: group._count.id
    };
  });

  return { success: true, data: finalData };
  } catch (error) {
    console.error("Error in GetTopSellingUsersByPermission:", error);
    return { success: false, data: [] };
  }
}

export async function GetUserTargetProgress(userId: string, monthKey?: string) {
  try {
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

    const statusWhitelist = ["تم تسليم الطلب", "مدفوعة", "تم التسليم", "تم البيع"];

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

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          ...(canViewAllTargets ? {} : { userId: scopedUserId }),
          status: { in: statusWhitelist },
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
        productId: true,
        quantity: true,
        price: true,
        discount: true,
        order: { select: { userId: true, createdAt: true } }
      }
    });

    const soldMap = new Map<string, Array<{ createdAt: Date; quantity: number; amount: number }>>();
    const totalSoldByUser = new Map<string, number>();
    for (const item of orderItems) {
      const key = `${item.order.userId}:${item.productId}`;
      const netPrice = Math.max(0, Number(item.price || 0) - Number(item.discount || 0));
      const lineAmount = netPrice * item.quantity;
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
        const windowStart = target.createdAt;
        const windowEnd = target.endedAt || new Date();
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

    const totalSalesAmount = totalSoldByUser.get(scopedUserId) || 0;
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