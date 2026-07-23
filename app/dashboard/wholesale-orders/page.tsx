"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, FileText, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { AppModal } from "@/components/ui/app-modal";
import { useAuth } from "@/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/lib/utils";
import { DataTable, TableAction } from "@/components/shared/DataTable";
import { SearchAndFilter } from "@/orders/SearchAndFilter";
import { StatusCards } from "@/orders/StatusCards";
import {
  getCurrentMonthKey,
  getEffectivePrice,
  getMonthKey,
  getOrderDisplayDate,
  getPreviousMonthKey,
  statusColors,
} from "@/orders/orderHelpers";
import { useSiteCurrency, formatSiteCurrency } from "@/lib/currency";
import { getWholesaleCustomers } from "@/server/wholesale-customer";
import {
  createWholesaleOrder,
  deleteWholesaleOrder,
  getWholesaleOrderById,
  getWholesaleOrders,
  updateWholesaleOrder,
  updateWholesaleOrderStatus,
} from "@/server/wholesale-order";
import { getProductCatalog } from "@/server/product";
import { getWarehouse } from "@/server/warehouse";
import { downloadWholesaleOrderPdf, exportWholesaleOrdersToExcel } from "@/orders/wholesaleOrderExport";

type WholesaleOrderFormItem = {
  productId: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  name: string;
  modelNumber: string;
};

type WholesaleOrderFormState = {
  wholesaleCustomerId: string;
  warehouseId: string;
  receiverName: string;
  receiverPhone: string[];
  country: string;
  city: string;
  municipality: string;
  fullAddress: string;
  paymentMethod: string;
  amount: string;
  amountBank: string;
  status: string;
  overallDiscount: number;
  deliveryNotes: string;
  additionalNotes: string;
  googleMapsLink: string;
  manualCreatedAt: string;
};

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  "طلب جديد",
  "تم استلام الطلب",
  "تم ارسال الطلب",
  "تم تسليم الطلب",
  "فشل التسليم مرتجع",
  "تم الغاء الطلب",
  "معلق / نقص معلومات",
  "المتجر",
  "الكل",
];

const createEmptyItem = (): WholesaleOrderFormItem => ({
  productId: "",
  quantity: 1,
  price: 0,
  discount: 0,
  total: 0,
  name: "",
  modelNumber: "",
});

const createEmptyForm = (): WholesaleOrderFormState => ({
  wholesaleCustomerId: "",
  warehouseId: "",
  receiverName: "",
  receiverPhone: [""],
  country: "",
  city: "",
  municipality: "",
  fullAddress: "",
  paymentMethod: "عند الاستلام",
  amount: "",
  amountBank: "",
  status: "طلب جديد",
  overallDiscount: 0,
  deliveryNotes: "",
  additionalNotes: "",
  googleMapsLink: "",
  manualCreatedAt: "",
});

function normalizePhoneList(values: string[]) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function resolveWholesaleUnitPrice(product: any, quantity: number, warehouseId: string) {
  const normalizedQuantity = Math.max(1, Number(quantity || 1));
  const tiers = Array.isArray(product?.wholesalePricingTiers)
    ? [...product.wholesalePricingTiers]
    : [];

  const appliedTier = tiers
    .filter((tier: any) => {
      const minQuantity = Number(tier?.minQuantity || 0);
      const maxQuantity = tier?.maxQuantity == null ? null : Number(tier.maxQuantity);
      if (normalizedQuantity < minQuantity) return false;
      if (maxQuantity != null && normalizedQuantity > maxQuantity) return false;
      return true;
    })
    .sort((first: any, second: any) => Number(second?.minQuantity || 0) - Number(first?.minQuantity || 0))[0];

  const stock = Array.isArray(product?.stocks)
    ? product.stocks.find((currentStock: any) => String(currentStock?.warehouse?.id || "") === String(warehouseId || ""))
    : null;

  const tierPrice = Number(appliedTier?.price || 0);
  const productWholesalePrice = Number(product?.wholesalePrice || 0);
  const stockWholesalePrice = Number(stock?.wholesalePrice || 0);
  const stockRegularPrice = Number(stock?.price || 0);

  if (tierPrice > 0) return tierPrice;
  if (productWholesalePrice > 0) return productWholesalePrice;
  if (stockWholesalePrice > 0) return stockWholesalePrice;
  return stockRegularPrice;
}

function WholesaleOrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { settings } = useSiteCurrency();
  const [orders, setOrders] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const deferredSearch = React.useDeferredValue(searchQuery);
  const [cityId, setCityId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [warehouseCityId, setWarehouseCityId] = React.useState("");
  const [monthFilterType, setMonthFilterType] = React.useState<"all" | "current" | "previous" | "custom">("current");
  const [customMonth, setCustomMonth] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("طلب جديد");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isViewOpen, setIsViewOpen] = React.useState(false);
  const [editingOrderId, setEditingOrderId] = React.useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [formState, setFormState] = React.useState<WholesaleOrderFormState>(createEmptyForm());
  const [items, setItems] = React.useState<WholesaleOrderFormItem[]>([createEmptyItem()]);
  const pendingCustomerId = searchParams.get("customerId") || "";

  const canAccessWholesaleOrders = React.useMemo(() => {
    if (!user) return false;
    return hasAnyPermission(user, [
      "viewWholesaleOrders",
      "addWholesaleOrders",
      "editWholesaleOrders",
      "deleteWholesaleOrders",
    ]);
  }, [user]);

  const canAddOrder = Boolean(user && hasPermission(user, "addWholesaleOrders"));
  const canEditOrder = Boolean(user && hasPermission(user, "editWholesaleOrders"));
  const canDeleteOrder = Boolean(user && hasPermission(user, "deleteWholesaleOrders"));

  const resetForm = React.useCallback(() => {
    setEditingOrderId(null);
    setFormState(createEmptyForm());
    setItems([createEmptyItem()]);
    setWarehouseCityId("");
  }, []);

  const openCreateModalForCustomer = React.useCallback((customerId: string) => {
    const customer = customers.find((currentCustomer: any) => String(currentCustomer.id) === String(customerId));
    resetForm();
    setFormState({
      wholesaleCustomerId: String(customer?.id || customerId || ""),
      warehouseId: "",
      receiverName: String(customer?.contactName || ""),
      receiverPhone: Array.isArray(customer?.phone) && customer.phone.length > 0 ? customer.phone : [""],
      country: String(customer?.country || ""),
      city: String(customer?.city || ""),
      municipality: String(customer?.area || ""),
      fullAddress: String(customer?.address || ""),
      paymentMethod: "عند الاستلام",
      amount: "",
      amountBank: "",
      status: "طلب جديد",
      overallDiscount: 0,
      deliveryNotes: "",
      additionalNotes: String(customer?.notes || ""),
      googleMapsLink: String(customer?.googleMapsLink || ""),
      manualCreatedAt: "",
    });
    setWarehouseCityId("");
    setIsFormOpen(true);
  }, [customers, resetForm]);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersResponse, customersResponse, productsResponse, warehousesResponse] = await Promise.all([
        getWholesaleOrders(),
        getWholesaleCustomers(),
        getProductCatalog(),
        getWarehouse(),
      ]);

      if (!ordersResponse.success) {
        toast.error(ordersResponse.error || "تعذر تحميل طلبات الجملة");
      } else {
        setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
      }

      if (!customersResponse.success) {
        toast.error(customersResponse.error || "تعذر تحميل عملاء الجملة");
      } else {
        setCustomers(Array.isArray(customersResponse.data) ? customersResponse.data : []);
      }

      setProducts(Array.isArray(productsResponse) ? productsResponse : []);
      setWarehouses(Array.isArray(warehousesResponse) ? warehousesResponse : []);
    } catch (error) {
      toast.error("حدث خطأ أثناء تحميل بيانات طلبات الجملة");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (!canAccessWholesaleOrders) {
      setIsLoading(false);
      return;
    }
    void loadData();
  }, [loading, canAccessWholesaleOrders, loadData]);

  React.useEffect(() => {
    setPage(1);
  }, [deferredSearch, cityId, warehouseId, monthFilterType, customMonth, statusFilter]);

  React.useEffect(() => {
    setWarehouseId("");
  }, [cityId]);

  React.useEffect(() => {
    if (!pendingCustomerId || !canAddOrder || customers.length === 0) return;
    openCreateModalForCustomer(pendingCustomerId);
    router.replace("/dashboard/wholesale-orders");
  }, [canAddOrder, customers, openCreateModalForCustomer, pendingCustomerId, router]);

  const updateItemPrice = React.useCallback((draftItems: WholesaleOrderFormItem[], nextWarehouseId?: string) => {
    const warehouseId = String(nextWarehouseId ?? formState.warehouseId ?? "");
    return draftItems.map((item) => {
      const product = products.find((currentProduct: any) => Number(currentProduct.id) === Number(item.productId));
      const nextPrice = product ? resolveWholesaleUnitPrice(product, item.quantity, warehouseId) : 0;
      return {
        ...item,
        price: nextPrice,
        name: product?.name || item.name,
        modelNumber: product?.modelNumber || item.modelNumber,
        total: getEffectivePrice(nextPrice, item.discount) * item.quantity,
      };
    });
  }, [formState.warehouseId, products]);

  const subtotal = React.useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
  const grandTotal = React.useMemo(
    () => Math.max(0, subtotal - Number(formState.overallDiscount || 0)),
    [subtotal, formState.overallDiscount]
  );

  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      const normalizedQuery = deferredSearch.trim().toLowerCase();
      const matchesText = !normalizedQuery
        || String(order?.orderNumber || "").toLowerCase().includes(normalizedQuery)
        || String(order?.wholesaleCustomer?.name || "").toLowerCase().includes(normalizedQuery)
        || String(order?.user?.username || "").toLowerCase().includes(normalizedQuery)
        || String(order?.city || "").toLowerCase().includes(normalizedQuery);

      if (!matchesText) return false;

      const orderCityId = order?.warehouse?.city?.id ?? order?.warehouse?.cityId;
      if (cityId && String(orderCityId || "") !== String(cityId)) return false;
      if (warehouseId && String(order?.warehouse?.id || order?.warehouseId || "") !== String(warehouseId)) return false;

      if (monthFilterType !== "all") {
        const activeMonth = monthFilterType === "current"
          ? getCurrentMonthKey()
          : monthFilterType === "previous"
            ? getPreviousMonthKey()
            : (customMonth || getCurrentMonthKey());

        const orderMonth = getMonthKey(getOrderDisplayDate(order));
        if (activeMonth && orderMonth !== activeMonth) return false;
      }

      if (statusFilter !== "الكل" && String(order?.status || "") !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [orders, deferredSearch, cityId, warehouseId, monthFilterType, customMonth, statusFilter]);

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { الكل: filteredOrders.length };
    for (const status of STATUS_OPTIONS) {
      if (status === "الكل") continue;
      counts[status] = filteredOrders.filter((order) => String(order?.status || "") === status).length;
    }
    return counts;
  }, [filteredOrders]);

  const warehouseCityOptions = React.useMemo(
    () => Array.from(
      new Map(
        warehouses
          .filter((warehouse) => warehouse?.city)
          .map((warehouse) => [String(warehouse.city.id), { value: String(warehouse.city.id), label: warehouse.city.name }])
      ).values()
    ),
    [warehouses]
  );

  const filteredWarehouseOptions = React.useMemo(
    () => warehouses
      .filter((warehouse) => !cityId || String(warehouse?.cityId) === cityId)
      .map((warehouse) => ({ value: String(warehouse.id), label: `${warehouse.name} - ${warehouse.location}` })),
    [warehouses, cityId]
  );

  const formFilteredWarehouseOptions = React.useMemo(
    () => warehouses
      .filter((warehouse) => !warehouseCityId || String(warehouse?.cityId) === warehouseCityId)
      .map((warehouse) => ({ value: String(warehouse.id), label: `${warehouse.name} - ${warehouse.location}` })),
    [warehouses, warehouseCityId]
  );

  const openViewModal = async (orderId: number) => {
    const loadingToast = toast.loading("جاري تحميل تفاصيل طلب الجملة...");
    try {
      const response = await getWholesaleOrderById(orderId);
      if (!response.success || !response.data) {
        toast.error(response.error || "تعذر تحميل تفاصيل الطلب");
        return;
      }

      setSelectedOrder(response.data);
      setIsViewOpen(true);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const openEditModal = async (orderId: number) => {
    const loadingToast = toast.loading("جاري تحميل بيانات طلب الجملة...");
    try {
      const response = await getWholesaleOrderById(orderId);
      if (!response.success || !response.data) {
        toast.error(response.error || "تعذر تحميل الطلب");
        return;
      }

      const data = response.data;
      setEditingOrderId(Number(data.id));
      setFormState({
        wholesaleCustomerId: String(data.wholesaleCustomerId || ""),
        warehouseId: data?.warehouseId ? String(data.warehouseId) : "",
        receiverName: String(data?.receiverName || ""),
        receiverPhone: Array.isArray(data?.receiverPhone) && data.receiverPhone.length > 0 ? data.receiverPhone : [""],
        country: String(data?.country || ""),
        city: String(data?.city || ""),
        municipality: String(data?.municipality || ""),
        fullAddress: String(data?.fullAddress || ""),
        paymentMethod: String(data?.paymentMethod || "عند الاستلام"),
        amount: String(data?.amount ?? ""),
        amountBank: String(data?.amountBank ?? ""),
        status: String(data?.status || "طلب جديد"),
        overallDiscount: Number(data?.discount || 0),
        deliveryNotes: String(data?.deliveryNotes || ""),
        additionalNotes: String(data?.additionalNotes || ""),
        googleMapsLink: String(data?.googleMapsLink || ""),
        manualCreatedAt: data?.manualCreatedAt ? new Date(data.manualCreatedAt).toISOString().slice(0, 10) : "",
      });

      const nextItems = (Array.isArray(data?.items) ? data.items : []).map((item: any) => ({
        productId: String(item?.productId || item?.product?.id || ""),
        quantity: Number(item?.quantity || 1),
        price: Number(item?.price || 0),
        discount: Number(item?.discount || 0),
        total: getEffectivePrice(Number(item?.price || 0), Number(item?.discount || 0)) * Number(item?.quantity || 1),
        name: String(item?.product?.name || ""),
        modelNumber: String(item?.product?.modelNumber || ""),
      }));

      setItems(nextItems.length > 0 ? nextItems : [createEmptyItem()]);
      setWarehouseCityId(data?.warehouse?.city?.id ? String(data.warehouse.city.id) : "");
      setIsFormOpen(true);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleDelete = React.useCallback(async (orderId: number) => {
    if (!window.confirm("هل أنت متأكد من حذف طلب الجملة هذا؟")) {
      return;
    }

    const loadingToast = toast.loading("جاري حذف طلب الجملة...");
    try {
      const response = await deleteWholesaleOrder(orderId);
      if (!response.success) {
        toast.error(response.error || "تعذر حذف الطلب");
        return;
      }

      toast.success("تم حذف طلب الجملة");
      await loadData();
    } finally {
      toast.dismiss(loadingToast);
    }
  }, [loadData]);

  const handleExportExcel = React.useCallback(async () => {
    setIsExporting(true);
    try {
      await exportWholesaleOrdersToExcel(filteredOrders);
    } finally {
      setIsExporting(false);
    }
  }, [filteredOrders]);

  const handleExportPdf = React.useCallback(async (orderId: number) => {
    const loadingToast = toast.loading("جاري تجهيز ملف PDF...");
    try {
      const response = await getWholesaleOrderById(orderId);
      if (!response.success || !response.data) {
        toast.error(response.error || "تعذر تحميل بيانات الطلب");
        return;
      }

      await downloadWholesaleOrderPdf(response.data);
    } finally {
      toast.dismiss(loadingToast);
    }
  }, []);

  const handleStatusChange = async (nextStatus: string, orderId: number) => {
    const response = await updateWholesaleOrderStatus(nextStatus, orderId);
    if (!response.success) {
      toast.error(response.error || "تعذر تعديل حالة الطلب");
      return;
    }

    setOrders((currentOrders) => currentOrders.map((order) => (
      Number(order.id) === Number(orderId)
        ? { ...order, status: nextStatus, updatedAt: new Date().toISOString() }
        : order
    )));
    toast.success("تم تعديل حالة طلب الجملة");
  };

  const setFormField = (field: keyof WholesaleOrderFormState, value: string | number | string[]) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));

    if (field === "warehouseId") {
      setItems((currentItems) => updateItemPrice(currentItems, String(value || "")));
    }
  };

  const setPhoneValue = (index: number, value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      receiverPhone: currentState.receiverPhone.map((phone, phoneIndex) => phoneIndex === index ? value : phone),
    }));
  };

  const addPhoneField = () => {
    setFormState((currentState) => ({
      ...currentState,
      receiverPhone: [...currentState.receiverPhone, ""],
    }));
  };

  const removePhoneField = (index: number) => {
    setFormState((currentState) => ({
      ...currentState,
      receiverPhone: currentState.receiverPhone.filter((_, phoneIndex) => phoneIndex !== index),
    }));
  };

  const updateItemField = (index: number, field: keyof WholesaleOrderFormItem, value: string | number) => {
    setItems((currentItems) => {
      const nextItems = [...currentItems];
      const currentItem = { ...nextItems[index] };

      if (field === "productId") {
        const duplicateExists = currentItems.some((item, itemIndex) => itemIndex !== index && String(item.productId) === String(value || ""));
        if (duplicateExists) {
          toast.error("هذا المنتج مضاف بالفعل داخل الطلب");
          return currentItems;
        }

        const product = products.find((currentProduct: any) => Number(currentProduct.id) === Number(value || 0));
        currentItem.productId = String(value || "");
        currentItem.name = product?.name || "";
        currentItem.modelNumber = product?.modelNumber || "";
        currentItem.price = product ? resolveWholesaleUnitPrice(product, currentItem.quantity, formState.warehouseId) : 0;
      } else if (field === "quantity") {
        currentItem.quantity = Math.max(1, Number(value || 1));
        const product = products.find((currentProduct: any) => Number(currentProduct.id) === Number(currentItem.productId || 0));
        currentItem.price = product ? resolveWholesaleUnitPrice(product, currentItem.quantity, formState.warehouseId) : currentItem.price;
      } else if (field === "discount") {
        currentItem.discount = Math.max(0, Number(value || 0));
      }

      currentItem.total = getEffectivePrice(currentItem.price, currentItem.discount) * currentItem.quantity;
      nextItems[index] = currentItem;
      return nextItems;
    });
  };

  const addItem = () => {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyItem()];
      }
      return currentItems.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const validateForm = () => {
    if (!formState.wholesaleCustomerId) {
      toast.error("يرجى اختيار عميل الجملة");
      return false;
    }

    if (!formState.warehouseId) {
      toast.error("يرجى اختيار المستودع");
      return false;
    }

    if (items.length === 0 || !items[0]?.productId) {
      toast.error("يرجى إضافة منتج واحد على الأقل");
      return false;
    }

    if (!formState.receiverName.trim()) {
      toast.error("يرجى كتابة اسم المستلم");
      return false;
    }

    if (formState.paymentMethod === "مختلطة") {
      const amountValue = Number(formState.amount || 0);
      if (!formState.amount || amountValue < 0) {
        toast.error("يرجى إدخال قيمة الدفعة المستلمة");
        return false;
      }
      if (amountValue > grandTotal) {
        toast.error("قيمة الدفعة لا يمكن أن تتجاوز الإجمالي");
        return false;
      }
    }

    const phones = normalizePhoneList(formState.receiverPhone);
    if (phones.length === 0) {
      toast.error("يرجى إدخال رقم هاتف واحد على الأقل");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const payload = {
      ...formState,
      receiverPhone: normalizePhoneList(formState.receiverPhone),
      overallDiscount: Number(formState.overallDiscount || 0),
      amount: formState.paymentMethod === "مختلطة" ? formState.amount : "",
      amountBank: formState.paymentMethod === "مختلطة" ? String(grandTotal - Number(formState.amount || 0)) : "",
    };

    const normalizedItems = items
      .filter((item) => String(item.productId || "").trim())
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity || 1),
        discount: Number(item.discount || 0),
      }));

    setIsSubmitting(true);
    const loadingToast = toast.loading(editingOrderId ? "جاري تعديل طلب الجملة..." : "جاري إنشاء طلب الجملة...");
    try {
      const response = editingOrderId
        ? await updateWholesaleOrder(payload, editingOrderId, normalizedItems)
        : await createWholesaleOrder(payload, normalizedItems);

      if (!response.success) {
        toast.error(response.error || "تعذر حفظ طلب الجملة");
        return;
      }

      toast.success(editingOrderId ? "تم تعديل طلب الجملة" : "تم إنشاء طلب الجملة");
      setIsFormOpen(false);
      resetForm();
      await loadData();
    } finally {
      setIsSubmitting(false);
      toast.dismiss(loadingToast);
    }
  };

  const actions = React.useMemo<TableAction<any>[]>(() => {
    const nextActions: TableAction<any>[] = [
      {
        label: "عرض",
        icon: <Eye size={16} />,
        onClick: (item) => void openViewModal(Number(item.id)),
      },
      {
        label: "PDF",
        icon: <FileText size={16} />,
        onClick: (item) => void handleExportPdf(Number(item.id)),
      },
    ];

    if (canEditOrder) {
      nextActions.push({
        label: "تعديل",
        icon: <Pencil size={16} />,
        onClick: (item) => void openEditModal(Number(item.id)),
      });
    }

    if (canDeleteOrder) {
      nextActions.push({
        label: "حذف",
        icon: <Trash2 size={16} />,
        variant: "danger",
        onClick: (item) => void handleDelete(Number(item.id)),
      });
    }

    return nextActions;
  }, [canDeleteOrder, canEditOrder, handleDelete, handleExportPdf, openEditModal, openViewModal]);

  const columns = React.useMemo(() => ([
    {
      header: "رقم الطلب",
      accessor: "orderNumber",
    },
    {
      header: "عميل الجملة",
      accessor: (order: any) => (
        <div className="flex flex-col">
          <span className="font-black text-slate-900 dark:text-white">{order?.wholesaleCustomer?.name || "-"}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{order?.wholesaleCustomer?.assignedUser?.username || order?.user?.username || "غير محدد"}</span>
        </div>
      ),
    },
    {
      header: "المدينة",
      accessor: (order: any) => order?.city || order?.wholesaleCustomer?.city || "-",
    },
    {
      header: "المبلغ النهائي",
      accessor: (order: any) => (
        <span className="font-black text-blue-600">
          {formatSiteCurrency(Number(order?.finalAmount || 0), settings)}
        </span>
      ),
    },
    {
      header: "عدد المنتجات",
      accessor: (order: any) => Array.isArray(order?.items) ? order.items.length : 0,
    },
    {
      header: "الحالة",
      accessor: (order: any) => {
        const currentColor = statusColors[order?.status] || "bg-slate-50 text-slate-500 border-slate-200";
        return (
          <select
            className={`${currentColor} w-full min-w-[150px] rounded-xl border p-2.5 font-bold outline-none transition-all`}
            value={order?.status || "طلب جديد"}
            onChange={(event) => void handleStatusChange(event.target.value, Number(order.id))}
            disabled={!canEditOrder}
          >
            {STATUS_OPTIONS.filter((status) => status !== "الكل").map((status) => (
              <option key={status} value={status} className="bg-white text-black">
                {status}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      header: "تاريخ الإنشاء",
      accessor: (order: any) => new Date(getOrderDisplayDate(order)).toLocaleDateString("ar-EG"),
    },
  ]), [canEditOrder, settings]);

  if (!loading && !canAccessWholesaleOrders) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-black text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
        لا تملك صلاحية الوصول إلى طلبات الجملة
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">طلبات الجملة</h1>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">إدارة طلبات عملاء الجملة مع تسعير تلقائي حسب الكمية.</p>
        </div>
        {canAddOrder && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 dark:shadow-none"
          >
            <Plus size={18} />
            إضافة طلب جملة
          </button>
        )}
      </div>

      <StatusCards
        statusOptions={STATUS_OPTIONS}
        statusCounts={statusCounts}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <SearchAndFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cityId={cityId}
        onCityChange={setCityId}
        warehouseId={warehouseId}
        onWarehouseChange={setWarehouseId}
        cityOptions={warehouseCityOptions}
        warehouseOptions={filteredWarehouseOptions}
        shippingCompany=""
        onShippingCompanyChange={() => undefined}
        monthFilterType={monthFilterType}
        onMonthFilterChange={(value) => setMonthFilterType(value as "all" | "current" | "previous" | "custom")}
        customMonth={customMonth}
        onCustomMonthChange={setCustomMonth}
        onExport={() => void handleExportExcel()}
        isExporting={isExporting}
      />

      <DataTable
        data={filteredOrders}
        columns={columns}
        actions={actions}
        actindir={true}
        isLoading={isLoading}
        totalCount={filteredOrders.length}
        pageSize={PAGE_SIZE}
        currentPage={page}
        onPageChange={setPage}
      />

      <AppModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          resetForm();
        }}
        title={editingOrderId ? "تعديل طلب جملة" : "إضافة طلب جملة"}
        description="سيتم احتساب سعر الوحدة تلقائياً حسب شرائح الكمية وسعر الجملة." 
        size="full"
        footer={(
          <>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={16} />
              {editingOrderId ? "حفظ التعديلات" : "إنشاء الطلب"}
            </button>
          </>
        )}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-4 rounded-[2rem] border border-slate-200 p-5 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">المنتجات</h2>
              <button
                type="button"
                onClick={addItem}
                className="rounded-2xl border border-blue-200 px-3 py-2 text-xs font-black text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                إضافة منتج
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => {
                const product = products.find((currentProduct: any) => Number(currentProduct.id) === Number(item.productId || 0));
                const tiers = Array.isArray(product?.wholesalePricingTiers) ? product.wholesalePricingTiers : [];
                return (
                  <div key={`${item.productId || "item"}-${index}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">المنتج</span>
                        <select
                          value={item.productId}
                          onChange={(event) => updateItemField(index, "productId", event.target.value)}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value="">اختر المنتج</option>
                          {products.map((productOption: any) => (
                            <option key={productOption.id} value={productOption.id}>
                              {productOption.name}
                              {productOption.modelNumber ? ` - ${productOption.modelNumber}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">الكمية</span>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateItemField(index, "quantity", Number(event.target.value || 1))}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">السعر</span>
                        <input
                          type="number"
                          value={item.price}
                          readOnly
                          className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-blue-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">الخصم</span>
                        <input
                          type="number"
                          min={0}
                          value={item.discount}
                          onChange={(event) => updateItemField(index, "discount", Number(event.target.value || 0))}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                        الإجمالي: <span className="font-black text-slate-900 dark:text-white">{formatSiteCurrency(Number(item.total || 0), settings)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="inline-flex items-center gap-2 self-start rounded-2xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                      >
                        <Trash2 size={14} />
                        حذف المنتج
                      </button>
                    </div>

                    {tiers.length > 0 && (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        شرائح الجملة: {tiers.map((tier: any) => {
                          const min = Number(tier?.minQuantity || 0);
                          const max = tier?.maxQuantity == null ? "+" : Number(tier.maxQuantity);
                          return `${min}-${max}: ${formatSiteCurrency(Number(tier?.price || 0), settings)}`;
                        }).join(" | ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-[2rem] border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">بيانات الطلب</h2>

            <div className="grid grid-cols-1 gap-3">
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">عميل الجملة</span>
                <select
                  value={formState.wholesaleCustomerId}
                  onChange={(event) => setFormField("wholesaleCustomerId", event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">اختر عميل الجملة</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">مدينة المستودع</span>
                <select
                  value={warehouseCityId}
                  onChange={(event) => {
                    const nextCityId = event.target.value;
                    setWarehouseCityId(nextCityId);
                    setFormState((currentState) => ({ ...currentState, warehouseId: "" }));
                    setItems((currentItems) =>
                      currentItems.map((item) => {
                        const product = products.find((currentProduct: any) => Number(currentProduct.id) === Number(item.productId || 0));
                        const nextPrice = product ? resolveWholesaleUnitPrice(product, item.quantity, "") : item.price;
                        return {
                          ...item,
                          price: nextPrice,
                          total: getEffectivePrice(nextPrice, item.discount) * item.quantity,
                        };
                      })
                    );
                  }}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">اختر المدينة</option>
                  {warehouseCityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">المستودع</span>
                <select
                  value={formState.warehouseId}
                  onChange={(event) => setFormField("warehouseId", event.target.value)}
                  disabled={!warehouseCityId}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 disabled:opacity-50"
                >
                  <option value="">اختر المستودع</option>
                  {formFilteredWarehouseOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">اسم المستلم</span>
                <input
                  value={formState.receiverName}
                  onChange={(event) => setFormField("receiverName", event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">أرقام الهاتف</span>
                  <button
                    type="button"
                    onClick={addPhoneField}
                    className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-black text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    إضافة رقم
                  </button>
                </div>

                <div className="space-y-2">
                  {formState.receiverPhone.map((phone, index) => (
                    <div key={`phone-${index}`} className="flex gap-2">
                      <input
                        value={phone}
                        onChange={(event) => setPhoneValue(index, event.target.value)}
                        className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      {formState.receiverPhone.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePhoneField(index)}
                          className="rounded-2xl border border-rose-200 px-3 py-3 text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">الدولة</span>
                  <input
                    value={formState.country}
                    onChange={(event) => setFormField("country", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">المدينة</span>
                  <input
                    value={formState.city}
                    onChange={(event) => setFormField("city", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">المنطقة / البلدية</span>
                <input
                  value={formState.municipality}
                  onChange={(event) => setFormField("municipality", event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">العنوان الكامل</span>
                <textarea
                  value={formState.fullAddress}
                  onChange={(event) => setFormField("fullAddress", event.target.value)}
                  className="min-h-[90px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">طريقة الدفع</span>
                  <select
                    value={formState.paymentMethod}
                    onChange={(event) => setFormField("paymentMethod", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="عند الاستلام">عند الاستلام</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="مختلطة">مختلطة</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">حالة الطلب</span>
                  <select
                    value={formState.status}
                    onChange={(event) => setFormField("status", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {STATUS_OPTIONS.filter((status) => status !== "الكل").map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>

              {formState.paymentMethod === "مختلطة" && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300">المبلغ المستلم</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.amount}
                      onChange={(event) => setFormField("amount", event.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 text-left"
                      dir="ltr"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300">المبلغ المتبقي</span>
                    <input
                      type="number"
                      value={Math.max(0, grandTotal - Number(formState.amount || 0))}
                      readOnly
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 text-left"
                      dir="ltr"
                    />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">الخصم العام</span>
                  <input
                    type="number"
                    min={0}
                    value={formState.overallDiscount}
                    onChange={(event) => setFormField("overallDiscount", Number(event.target.value || 0))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">تاريخ الطلب اليدوي</span>
                  <input
                    type="date"
                    value={formState.manualCreatedAt}
                    onChange={(event) => setFormField("manualCreatedAt", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">رابط الخريطة</span>
                <input
                  value={formState.googleMapsLink}
                  onChange={(event) => setFormField("googleMapsLink", event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">ملاحظات التوصيل</span>
                <textarea
                  value={formState.deliveryNotes}
                  onChange={(event) => setFormField("deliveryNotes", event.target.value)}
                  className="min-h-[80px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">ملاحظات إضافية</span>
                <textarea
                  value={formState.additionalNotes}
                  onChange={(event) => setFormField("additionalNotes", event.target.value)}
                  className="min-h-[80px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <div className="rounded-[1.5rem] bg-slate-50 p-4 dark:bg-slate-900/40">
                <div className="flex items-center justify-between text-sm font-bold text-slate-600 dark:text-slate-300">
                  <span>المجموع الفرعي</span>
                  <span>{formatSiteCurrency(subtotal, settings)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm font-bold text-rose-600">
                  <span>الخصم العام</span>
                  <span>-{formatSiteCurrency(Number(formState.overallDiscount || 0), settings)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-lg font-black text-slate-900 dark:text-white">
                  <span>الإجمالي النهائي</span>
                  <span>{formatSiteCurrency(grandTotal, settings)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppModal>

      <AppModal
        isOpen={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedOrder(null);
        }}
        title={`تفاصيل طلب الجملة${selectedOrder?.orderNumber ? ` #${selectedOrder.orderNumber}` : ""}`}
        size="xl"
      >
        {selectedOrder ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400">عميل الجملة</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{selectedOrder?.wholesaleCustomer?.name || "-"}</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400">الموظف</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{selectedOrder?.user?.username || "-"}</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400">الإجمالي النهائي</p>
                <p className="mt-2 text-lg font-black text-blue-600">{formatSiteCurrency(Number(selectedOrder?.finalAmount || 0), settings)}</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-3 text-sm font-black">المنتج</th>
                    <th className="px-4 py-3 text-sm font-black">الكمية</th>
                    <th className="px-4 py-3 text-sm font-black">السعر</th>
                    <th className="px-4 py-3 text-sm font-black">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(selectedOrder?.items) ? selectedOrder.items : []).map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{item?.product?.name || "-"}</td>
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{Number(item?.quantity || 0)}</td>
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{formatSiteCurrency(Number(item?.price || 0), settings)}</td>
                      <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{formatSiteCurrency(getEffectivePrice(Number(item?.price || 0), Number(item?.discount || 0)) * Number(item?.quantity || 0), settings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400">العنوان</p>
                <div className="mt-3 space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <p>الدولة: {selectedOrder?.country || "-"}</p>
                  <p>المدينة: {selectedOrder?.city || "-"}</p>
                  <p>المنطقة: {selectedOrder?.municipality || "-"}</p>
                  <p>العنوان: {selectedOrder?.fullAddress || "-"}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400">بيانات إضافية</p>
                <div className="mt-3 space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <p>المستلم: {selectedOrder?.receiverName || "-"}</p>
                  <p>الهاتف: {Array.isArray(selectedOrder?.receiverPhone) ? selectedOrder.receiverPhone.join(" - ") : "-"}</p>
                  <p>طريقة الدفع: {selectedOrder?.paymentMethod || "-"}</p>
                  {selectedOrder?.paymentMethod === "مختلطة" && (
                    <>
                      <p>المبلغ المستلم: {formatSiteCurrency(Number(selectedOrder?.amount || 0), settings)}</p>
                      <p>المبلغ المتبقي: {formatSiteCurrency(Number(selectedOrder?.amountBank || 0), settings)}</p>
                    </>
                  )}
                  <p>الحالة: {selectedOrder?.status || "-"}</p>
                  <p>تاريخ الطلب: {new Date(getOrderDisplayDate(selectedOrder)).toLocaleDateString("ar-EG")}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </AppModal>
    </div>
  );
}

export default function WholesaleOrdersPage() {
  return (
    <React.Suspense
      fallback={(
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-black text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          جاري تحميل طلبات الجملة...
        </div>
      )}
    >
      <WholesaleOrdersPageContent />
    </React.Suspense>
  );
}