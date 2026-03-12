import React from 'react';
import { getCurrentMonthKey, getMonthKey, getOrderDisplayDate, getPreviousMonthKey } from '@/orders/orderHelpers';

interface User {
  id: string;
  username?: string;
  accountType?: string;
  permission?: {
    viewOrders?: boolean;
    roleName?: string;
    accessSyria?: boolean;
    accessTurkey?: boolean;
  };
}

export const useOrderFilters = (orders: any[], user?: User) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [warehouseLocation, setWarehouseLocation] = React.useState("");
  const [monthFilterType, setMonthFilterType] = React.useState<"all" | "current" | "previous" | "custom">("current");
  const [customMonth, setCustomMonth] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("طلب جديد");
  const [page, setPage] = React.useState(1);

  const PAGE_SIZE = 10;

  const filterOrder = React.useMemo(() => {
    if (!user) return [];

    const isAdminUser = user.accountType === "ADMIN";
    const canViewOrders = isAdminUser || user?.permission?.viewOrders === true;
    const isWarehouseUser = String(user?.permission?.roleName || "").trim().includes("مستودع");

    const allowedWarehouseLocations = [
      user?.permission?.accessSyria === true ? "سوريا" : null,
      user?.permission?.accessTurkey === true ? "تركيا" : null,
    ].filter(Boolean) as string[];

    const canAccessWarehouseOrders = isWarehouseUser && allowedWarehouseLocations.length > 0;

    const normalizeWarehouseLocation = (location?: string | null) => {
      const normalized = String(location || "").trim().toLowerCase();
      if (normalized === "syria" || normalized === "سوريا") return "سوريا";
      if (normalized === "turkey" || normalized === "تركيا") return "تركيا";
      return String(location || "").trim();
    };

    return orders.filter((order: any) => {
      if (!canViewOrders) return false;

      if (!isAdminUser) {
        if (isWarehouseUser) {
          if (!canAccessWarehouseOrders) return false;
          const orderLocation = normalizeWarehouseLocation(order?.warehouse?.location);
          if (!allowedWarehouseLocations.includes(orderLocation)) return false;
        } else {
          const isOwner = order.userId === user?.id;
          if (!isOwner) return false;
        }
      }

      // فلتر البحث النصي
      const query = searchQuery.trim().toLowerCase();
      const matchesText = !query ||
        (order.customer?.name && order.customer.name.toLowerCase().includes(query)) ||
        (order.user?.username && order.user.username.toLowerCase().includes(query)) ||
        (order.orderNumber && String(order.orderNumber).includes(query)) ||
        (order.city && order.city.toLowerCase().includes(query));

      if (!matchesText) return false;

      // فلتر المستودع
      const matchesLocation = !warehouseLocation || order.warehouse?.location === warehouseLocation;
      if (!matchesLocation) return false;

      // فلتر الشهر
      if (monthFilterType !== "all") {
        const activeMonth = monthFilterType === "current"
          ? getCurrentMonthKey()
          : monthFilterType === "previous"
            ? getPreviousMonthKey()
            : (customMonth || getCurrentMonthKey());

        const orderMonth = getMonthKey(getOrderDisplayDate(order));
        if (!activeMonth || !orderMonth || orderMonth !== activeMonth) return false;
      }

      return true;
    });
  }, [orders, user, searchQuery, warehouseLocation, monthFilterType, customMonth]);

  const statusOptions = [
    "طلب جديد",
    "تم استلام الطلب",
    "تم ارسال الطلب",
    "تم تسليم الطلب",
    "فشل التسليم مرتجع",
    "تم الغاء الطلب",
    "معلق / نقص معلومات",
    "الكل",
  ];

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { الكل: filterOrder.length };
    for (const status of statusOptions) {
      if (status === "الكل") continue;
      counts[status] = filterOrder.filter((order: any) => order.status === status).length;
    }
    return counts;
  }, [filterOrder]);

  const visibleOrders = React.useMemo(() => {
    if (statusFilter === "الكل") return filterOrder;
    return filterOrder.filter((order: any) => order.status === statusFilter);
  }, [filterOrder, statusFilter]);

  const paginatedOrders = React.useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return visibleOrders.slice(startIndex, startIndex + PAGE_SIZE);
  }, [visibleOrders, page]);

  const totalPages = Math.ceil(visibleOrders.length / PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  return {
    // الحالات
    searchQuery,
    setSearchQuery,
    warehouseLocation,
    setWarehouseLocation,
    monthFilterType,
    setMonthFilterType,
    customMonth,
    setCustomMonth,
    statusFilter,
    setStatusFilter,
    page,
    setPage,

    // البيانات المصفاة
    filterOrder,
    visibleOrders,
    paginatedOrders,
    statusCounts,
    statusOptions,

    // معلومات الترقيم
    PAGE_SIZE,
    totalPages,
  };
};
