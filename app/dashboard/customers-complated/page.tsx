"use client";

import * as React from "react";
import * as z from "zod";
import * as XLSX from 'xlsx';
import { DynamicForm } from "@/components/shared/dynamic-form";
import { FormInput } from "@/components/ui/form-input";
import PhoneInput from 'react-phone-number-input'
import { Button } from "@/components/ui/button";
import { AppModal } from "@/components/ui/app-modal";
import { AssignUsers, createCustomerAction, createmessage, deleteCustomer, getCustomer, updateCustomer, UpdateStusa } from "@/server/customer";
import { useAuth } from "@/context/AuthContext";
import { formatPhoneForDisplay, hasPermission, isAdmin } from "@/lib/utils";
import toast from "react-hot-toast";
import { CheckSquare, Download, Eye, LayoutGrid, MapPin, MessageCircle, Pencil, Phone, Plus, Save, Send, ShoppingBag, Table2, Trash2, Upload, UserPlus, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getProduct } from "@/server/product";
import { createOrder } from "@/server/order";
import { Controller, useFieldArray } from "react-hook-form";
import ViewOrderCustomer from "@/components/pages/customers/viewOrder";
import AssignUserModal from "@/components/pages/customers/assignuser";
import GetCustomerSingle from "@/components/pages/customers/gitSingleCustomer";
import OrderCustomer from "@/components/pages/customers/orderCustomer";
import { DataTable, TableAction } from "@/components/shared/DataTable";

/* ===================== Constants ===================== */

const STATUS_OPTIONS = [
  { label: "فرصة جديدة", value: "فرصة جديدة" },
  { label: "جاري المتابعة", value: "جاري المتابعة" },
  { label: "تم البيع", value: "تم البيع" },
  { label: "غير مهتم / ملغي", value: "غير مهتم / ملغي" },
];

const LOCKED_STATUS_VALUES = new Set(["جاري المتابعة", "تم البيع"]);

const FORCE_STATUS = "تم البيع";


/* ===================== Schema (التحقق المرن) ===================== */
// نصيحة خبير: استخدم .or(z.literal("")) لضمان أن الحقول الفارغة لا تكسر شرط الـ min
const customerSchema = z.object({
  name: z.string().min(3, "الاسم يجب أن يكون 3 حروف على الأقل"),
  // هنا نتأكد أننا نستقبل نصاً من الفورم ثم نحوله لمصفوفة
  phone: z.preprocess(
    (val) => (typeof val === "string" && val !== "" ? [val] : val),
    z.array(z.string()).optional().default([])
  )
});

type CustomerFormValues = z.infer<typeof customerSchema>;

/* ===================== Component ===================== */
const CustomrLayout: React.FC = () => {
  const [activeTabs, setActiveTabs] = React.useState<Array<"skin" | "laser" | "slimming">>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isOpencustomer, setIsOpencustomer] = React.useState(false);
  const [isOpencustomerchat, setIsOpencustomerchat] = React.useState(false);
  const [isOpenOrder, setisOpenOrder] = React.useState(false);
  const [customers, setCustomers] = React.useState<any[]>([])
  const [formdata, setFormdata] = React.useState<any>(null)
  const [editId, setEditId] = React.useState<string | null>(null);
  const [customer, setCustomer] = React.useState<any>({})
  const [customerorder, setCustomerorder] = React.useState<any[]>([])
  const [items, setItems] = React.useState([
    { productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }
  ]);
  const [searchQueries, setSearchQueries] = React.useState<Record<number, string>>({});
  const [showDropdown, setShowDropdown] = React.useState<Record<number, boolean>>({});
  const [overallDiscount, setOverallDiscount] = React.useState(0);

  // بيانات العميل والمبالغ
  const [customerId, setCustomerId] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("عند الاستلام");

  // بيانات المستلم والعنوان
  const [receiverName, setReceiverName] = React.useState("");
  const [receiverPhone, setReceiverPhone] = React.useState<(string | undefined)[]>([""]);
  const [country, setCountry] = React.useState("ليبيا"); // افتراضي حسب الصورة
  const [city, setCity] = React.useState("");
  const [municipality, setMunicipality] = React.useState("");
  const [fullAddress, setFullAddress] = React.useState("");
  const [status, setStatus] = React.useState("طلب جديد");
  // تفاصيل الشحن
  const [deliveryMethod, setDeliveryMethod] = React.useState("توصيل الى المنزل");
  const [amount, setamount] = React.useState("");
  const [amountBank, setamountBank] = React.useState("");
  const [googleMapsLink, setGoogleMapsLink] = React.useState("");

  const [customerSearchQuery, setCustomerSearchQuery] = React.useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
  const [deliveryNotes, setDeliveryNotes] = React.useState("");
  const [additionalNotes, setAdditionalNotes] = React.useState("");
  const subTotal = items.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = subTotal - overallDiscount;
  const [search, setSearch] = React.useState("")
  const [isOpenordercustomer, setisOpenordercustomer] = React.useState(false)
  const [OpenAssignModal, setOpenAssignModal] = React.useState(false)
  const [isBulkAssignOpen, setIsBulkAssignOpen] = React.useState(false)
  const { user } = useAuth()
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("table");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;
  const [sortState, setSortState] = React.useState<{
    field: "country" | "createdAt" | "ordersCount" | null;
    direction: "asc" | "desc";
  }>({ field: null, direction: "asc" });

  const [dateFilter, setDateFilter] = React.useState(FORCE_STATUS);
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [alluser, setUsers] = React.useState<any[]>([])
  const [selectedCustomers, setSelectedCustomers] = React.useState<any[]>([]);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  // دالة للتعامل مع الاختيار

  const filterCustomer = customers.filter((e: any) => {
    const normalizedSearch = search.toLowerCase().trim();
    const fromKey = createdFrom || "";
    const toKey = createdTo || "";
    const rangeStart = fromKey && toKey ? (fromKey <= toKey ? fromKey : toKey) : fromKey || toKey;
    const rangeEnd = fromKey && toKey ? (fromKey <= toKey ? toKey : fromKey) : fromKey || toKey;

    const hasAssignedUserMatch = Array.isArray(e.users)
      ? e.users.some((assignedUser: any) => {
          const username = String(assignedUser?.username ?? "").toLowerCase();
          const name = String(assignedUser?.name ?? "").toLowerCase();
          const email = String(assignedUser?.email ?? "").toLowerCase();
          return (
            username.includes(normalizedSearch) ||
            name.includes(normalizedSearch) ||
            email.includes(normalizedSearch)
          );
        })
      : false;

    // 1. منطق البحث النصي الحالي
    const matchesSearch =
      e.name?.toLowerCase().includes(normalizedSearch) ||
      e.countryCode?.toLowerCase().includes(normalizedSearch) ||
      e.phone?.some((p:any )=> String(p ?? "").toLowerCase().includes(normalizedSearch)) ||
      e.city?.toLowerCase().includes(normalizedSearch) || // أضفت المدينة كما طلبت
      e.country?.toLowerCase().includes(normalizedSearch) ||
      hasAssignedUserMatch;


    // إذا كان المستخدم اختار حالة معينة، نقوم بالمطابقة، وإذا لم يختار (All) نعرض الكل
    const matchesStatus = e.status === FORCE_STATUS;
    const customerCreatedAt = e?.createdAt ? new Date(e.createdAt) : null;
    const hasValidCreatedAt = Boolean(customerCreatedAt && !Number.isNaN(customerCreatedAt.getTime()));
    const customerCreatedKey = hasValidCreatedAt
      ? `${customerCreatedAt!.getFullYear()}-${String(customerCreatedAt!.getMonth() + 1).padStart(2, "0")}-${String(customerCreatedAt!.getDate()).padStart(2, "0")}`
      : "";
    const matchesCreatedAt =
      (!rangeStart || customerCreatedKey >= rangeStart) &&
      (!rangeEnd || customerCreatedKey <= rangeEnd);

    return matchesSearch && matchesStatus && matchesCreatedAt;
  });

  React.useEffect(() => {
    setPage(1);
  }, [search, dateFilter, createdFrom, createdTo, viewMode]);

  const visibleCustomers = React.useMemo(() => {
    return filterCustomer.filter((customer) => {
      if (isAdmin(user)) return true;
      return customer.users.some((u: any) => u.id === user?.id);
    });
  }, [filterCustomer, user]);

  const sortedVisibleCustomers = React.useMemo(() => {
    const list = [...visibleCustomers];
    if (!sortState.field) return list;

    list.sort((left: any, right: any) => {
      let comparison = 0;

      if (sortState.field === "country") {
        const leftValue = String(left?.country || "").trim();
        const rightValue = String(right?.country || "").trim();
        comparison = leftValue.localeCompare(rightValue, "ar");
      } else if (sortState.field === "createdAt") {
        const leftValue = new Date(left?.createdAt || 0).getTime();
        const rightValue = new Date(right?.createdAt || 0).getTime();
        comparison = leftValue - rightValue;
      } else if (sortState.field === "ordersCount") {
        const leftValue = Array.isArray(left?.orders) ? left.orders.length : 0;
        const rightValue = Array.isArray(right?.orders) ? right.orders.length : 0;
        comparison = leftValue - rightValue;
      }

      return sortState.direction === "asc" ? comparison : -comparison;
    });

    return list;
  }, [visibleCustomers, sortState]);

  const toggleSort = (field: "country" | "createdAt" | "ordersCount") => {
    setPage(1);
    setSortState((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  };

  const renderSortHeader = (
    label: string,
    field: "country" | "createdAt" | "ordersCount"
  ) => {
    const isActive = sortState.field === field;
    const indicator = !isActive ? "↕" : sortState.direction === "asc" ? "↑" : "↓";

    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1 font-bold hover:text-blue-600 transition-colors"
      >
        <span>{label}</span>
        <span className="text-[11px] opacity-70">{indicator}</span>
      </button>
    );
  };

  const allFilteredIds = React.useMemo(
    () => filterCustomer.map((customer) => customer.id),
    [filterCustomer]
  );

  const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedCustomers.includes(id));

  const toggleSelectAll = () => {
    setSelectedCustomers(areAllSelected ? [] : allFilteredIds);
  };

  const handleBulkAssignUsers = async (_: string, userIds: string[]) => {
    if (selectedCustomers.length === 0) {
      toast.error("لا يوجد عملاء محددين");
      return;
    }

    const loading = toast.loading("جار ربط الموظفين بالعملاء المحددين");
    try {
      const results = await Promise.all(
        selectedCustomers.map((customerId) =>
          AssignUsers(customerId, userIds)
            .then(() => ({ success: true }))
            .catch(() => ({ success: false }))
        )
      );

      const failedCount = results.filter((r) => !r.success).length;
      if (failedCount > 0) {
        toast.error(`تعذر ربط ${failedCount} عميل`);
      } else {
        toast.success("تم ربط الموظفين بنجاح");
      }

      getData();
      setSelectedCustomers([]);
      setIsBulkAssignOpen(false);
    } finally {
      toast.dismiss(loading);
    }
  };

  const handleBulkDelete = async () => {
    if (!user || !hasPermission(user, "deleteCustomers")) {
      toast.error("ليس لديك صلاحية حذف العملاء");
      return;
    }
    if (selectedCustomers.length === 0) {
      toast.error("لا يوجد عملاء محددين");
      return;
    }

    const confirmDelete = window.confirm("هل أنت متأكد من حذف العملاء المحددين؟");
    if (!confirmDelete) {
      return;
    }

    const loading = toast.loading("جار حذف العملاء");
    try {
      const results = await Promise.all(
        selectedCustomers.map((customerId) =>
          deleteCustomer({ id: customerId })
            .then((res) => ({ success: res.success }))
            .catch(() => ({ success: false }))
        )
      );

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        toast.success(`تم حذف ${successCount} عميل`);
      }
      if (failedCount > 0) {
        toast.error(`تعذر حذف ${failedCount} عميل`);
      }

      getData();
      setSelectedCustomers([]);
    } finally {
      toast.dismiss(loading);
    }
  };

  const toggleSelect = (id: any) => {
    setSelectedCustomers((prev: any) =>
      prev.includes(id) ? prev.filter((itemId: any) => itemId !== id) : [...prev, id]
    );
  };
  const updateItem = (index: number, field: string, value: any, products: any[]) => {
    const newItems = [...items];
    const item = newItems[index];

    const isDuplicate = items.some((item, i) => item.productId === value && i !== index);

    if (isDuplicate) {
      toast.error("هذا المنتج مضاف بالفعل! يرجى اختيار منتج آخر أو تعديل الكمية.");
      return; // توقف عن التنفيذ ولا تقم بتحديث الحالة
    }

    if (field === "productId") {
      const product = products.find(p => p.id === Number(value));
      const firstStock = Array.isArray(product?.stocks) ? product.stocks[0] : null;
      item.productId = value;
      item.name = product?.name || "";
      item.modelNumber = product?.modelNumber || "";
      item.price = Number(firstStock?.price || 0);
      item.discount = Number(firstStock?.discount || 0);
      setSearchQueries({ ...searchQueries, [index]: item.name });
      setShowDropdown({ ...showDropdown, [index]: false });
    } else {
      (item as any)[field] = value;
    }

    item.total = item.price * item.quantity - item.discount;
    setItems(newItems);
  };

  const deleteCus = async (data: any) => {
    const confirm = window.confirm("هل انت متأكد من الحذف")
    if (confirm) {
      try {
        const res = await deleteCustomer(data)
        if (res.success) {
          toast.success("تم الحذف بنجاح")
          getData()
        } else {
          toast.error("حدث خطأ")
        }
      } catch (error) {
        toast.error("حدث خطأ")
      } finally {
      }
    }
  }


  const addNewItem = () => {
    setItems([...items, { productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }]);
  };


  const getData = async () => {
    const res = await getCustomer();
    if (res.success) {
      const allCustomers = res.data;
      console.log(allCustomers)
      // 1. تحديث القائمة العامة (كما كنت تفعل)
      if (isAdmin(user)) {
        setCustomers(allCustomers);
      } else {
        const filtered = allCustomers.filter((c) => c.users?.some((u) => u.id === user?.id));
        setCustomers(filtered);
      }

      // 2. السطر السحري: تحديث العميل المختار حالياً ببياناته الجديدة
      // نبحث عن العميل الحالي داخل البيانات الجديدة التي وصلت من السيرفر
      if (customer?.id) {
        const updatedCustomer = allCustomers.find(c => c.id === customer.id);
        if (updatedCustomer) {
          setCustomer(updatedCustomer); // هذا سيجعل الرسائل تظهر فوراً
        }
      }
    }
  };

  const getAlluser = async () => {
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      setUsers(data.data);
      console.log("Users:", res);
    } catch (error) {

    }
  }
  const [products, setProduct] = React.useState<any[]>([])
  React.useEffect(() => {
    getData();
    getAlluser();
    getProduct().then((products) => {
      setProduct(products);
    }).catch(console.error);
  }, [user])
  const [isPending, setIsPending] = React.useState(false);

  // const resetForm = () => {
  //   // إغلاق المودال أولاً
  //   setisOpenOrder(false);

  //   // إعادة بيانات الطلب والمنتجات
  //   setStatus("طلب جديد");
  //   setEditId(null);
  //   setItems([{ productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }]);
  //   setSearchQueries({});
  //   setShowDropdown({});
  //   setOverallDiscount(0);

  //   // إعادة بيانات العميل
  //   setCustomerId("");
  //   setCustomerSearchQuery("");
  //   setShowCustomerDropdown(false);
  //   setPaymentMethod("عند الاستلام");

  //   // إعادة بيانات المستلم والعنوان
  //   setReceiverName("");
  //   setReceiverPhone([""]);
  //   setCountry("ليبيا");
  //   setCity("");
  //   setMunicipality("");
  //   setFullAddress("");

  //   // إعادة تفاصيل الشحن والملاحظات
  //   setDeliveryMethod("توصيل الى المنزل");
  //   setamount("");
  //   setamountBank("");
  //   setGoogleMapsLink("");
  //   setDeliveryNotes("");
  //   setAdditionalNotes("");
  // };

  const handleStatus = async (customerId: any, status: any) => {
    console.log(customerId, status)
    const loading = toast.loading("جار التحديث")
    try {
      const res = await UpdateStusa(customerId, status)
      if (res.success) {
        toast.success("تم التحديث")
        getData()
      } else { toast.error("حدثث خطأ") }
    } catch (error) {

    } finally {
      toast.dismiss(loading)
    }
  }

  const normalizePhoneValue = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const startsWithPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return "";
    return startsWithPlus ? `+${digits}` : digits;
  };

  const normalizePhoneList = (input: unknown) => {
    const rawValues = Array.isArray(input)
      ? input
      : String(input || "")
          .split(/[،,;\n]+/)
          .map((value) => value.trim())
          .filter((value) => value.length > 0);

    return rawValues
      .map((value) => normalizePhoneValue(String(value)))
      .filter((value) => value.length > 0);
  };

  const onSubmit = async (data: CustomerFormValues) => {
    const loading = toast.loading(editId ? "جاري تحديث العميل" : "جاري إضافة العميل")
    if (editId) {

      try {
        const formattedData = {
          ...data,
          phone: normalizePhoneList(data.phone),
        };

        const res = await updateCustomer(formattedData, editId)
        if (res.success) {
          toast.success("تم التحديث بنجاح")
          setIsOpen(false);
          getData()
        } else {
          toast.error(` خطأ ${res.error}`)
        }
      } catch (error) {
        toast.error(` خطأ ${error}`)
      } finally {
        toast.dismiss(loading)
      }
    } else {
      try {
        const phoneArray = normalizePhoneList(data.phone);

        const formattedData = {
          ...data,
          phone: phoneArray, // هنا سيتم إرسال ["098786", "099876"]
        };

        const res = await createCustomerAction(formattedData, user?.id as string);

        if (res.success) {
          toast.success("✅ تم الإضافة بنجاح");
          setIsOpen(false);
          getData();
        } else {
          toast.error("خطأ");
        }
      } catch (err) {
        toast.error("حدث خطأ غير متوقع");
      } finally {
        toast.dismiss(loading)
      }
    }
  };

  const getSingleCustomer = async (data: any) => {
    setCustomer(data)
    console.log(data)
    setIsOpencustomer(true)
  }

  const handleExportAction = () => {
    // 1. تحديد أي بيانات سنصدرها
    // إذا كانت مصفوفة selectedCustomers تحتوي على عناصر، نفلتر filterCustomer بناءً عليها
    // وإلا، نأخذ كل filterCustomer
    const dataToExport = selectedCustomers.length > 0
      ? filterCustomer.filter(customer => selectedCustomers.includes(customer.id))
      : filterCustomer;

    // 2. استدعاء دالة التصدير الأصلية وتمرير البيانات المحددة لها
    exportCustomersToExcel(dataToExport);
  };

  const exportCustomersToExcel = (customers: any[]) => {
    const phoneLists = customers.map((customer) => {
      if (Array.isArray(customer.phone)) {
        return customer.phone
          .map((phone: string) => String(phone || "").trim())
          .filter((phone: string) => phone.length > 0);
      }

      const singlePhone = String(customer.phone || "").trim();
      return singlePhone ? [singlePhone] : [];
    });

    const maxPhoneCount = phoneLists.reduce((maxCount, phones) => Math.max(maxCount, phones.length), 0);

    const worksheetData = customers.map((customer) => {
      // تجميع الرسائل الأخيرة أو الطلبات إذا أردت
      const lastMessage = customer.message && customer.message.length > 0
        ? customer.message[customer.message.length - 1].message
        : "لا توجد رسائل";

      const phones = Array.isArray(customer.phone)
        ? customer.phone
        : [customer.phone].filter(Boolean);

      const phoneColumns: Record<string, string> = {};
      for (let index = 0; index < maxPhoneCount; index += 1) {
        const value = phones[index];
        phoneColumns[`رقم الهاتف ${index + 1}`] = value ? formatPhoneForDisplay(String(value)) : "";
      }

      return {
        "اسم العميل": customer.name,
        ...phoneColumns,
        "الدولة": customer.country,
        "الحالة": customer.status,
        "تاريخ التسجيل": new Date(customer.createdAt).toLocaleDateString('ar-EG'),
        "عدد الطلبات": customer.orders?.length || 0,
        "آخر رسالة": lastMessage,
        "الموظفين المسؤولين": customer.users?.map((u: any) => u.username).join(', ') || "غير معين",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "بيانات العملاء");

    worksheet['!dir'] = "rtl";

    XLSX.writeFile(workbook, `Customers_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const canImport = user && hasPermission(user, "addCustomers");

  const handleImportClick = () => {
    if (!canImport) {
      toast.error("ليس لديك صلاحية الاستيراد");
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canImport) {
      toast.error("ليس لديك صلاحية الاستيراد");
      return;
    }

    if (!user?.id) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = "";

    const loading = toast.loading("جار استيراد البيانات");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

      let successCount = 0;
      let failedCount = 0;

      for (const row of rows) {
        const name = String(row["اسم العميل"] || "").trim();
        const phoneRaw = String(row["رقم الهاتف"] || "").trim();
        const country = String(row["الدولة"] || "").trim();

        if (!name || !phoneRaw) {
          failedCount += 1;
          continue;
        }

        const phoneArray = normalizePhoneList(phoneRaw);

        if (phoneArray.length === 0) {
          failedCount += 1;
          continue;
        }

        const payload = {
          name,
          phone: phoneArray,
          country,
          countryCode: "",
          city: "",
        };

        const res = await createCustomerAction(payload, user.id as string);
        if (res.success) {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      }

      if (successCount > 0) {
        toast.success(`تم استيراد ${successCount} عميل`);
      }
      if (failedCount > 0) {
        toast.error(`تعذر استيراد ${failedCount} عميل`);
      }

      await getData();
    } catch (error) {
      toast.error("فشل استيراد الملف");
    } finally {
      toast.dismiss(loading);
    }
  };

  const handleAssignUsers = async (customerId: string, userIds: string[]) => {
    const loading = toast.loading("جار ربط الموظفين بالعميل")
    try {
      const res = await AssignUsers(customerId, userIds)

      if (res.success) {
        // تحديث البيانات محلياً أو إعادة جلبها
        toast.success("تم ربط الموظفين بنجاح");
        getData();
        setOpenAssignModal(false);
      } else {
        toast.error("خطأ")
      }
    } catch (error) {
      toast.error("خطأ في الربط");
    } finally {
      toast.dismiss(loading)
    }

    console.log(customerId, userIds)
  };

  const tableColumns = [
      {
        header: "تحديد",
        accessor: (customer: any) => (
          <input
            type="checkbox"
            checked={selectedCustomers.includes(customer.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelect(customer.id)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        ),
        className: "w-16",
      },
      {
        header: "العميل",
        accessor: (customer: any) => (
          <button
            type="button"
            onClick={() => getSingleCustomer(customer)}
            className="font-black text-slate-800 dark:text-slate-100 hover:text-blue-600"
          >
            {customer.name}
          </button>
        ),
      },
      {
        header: "الهاتف",
        accessor: (customer: any) =>
          customer.phone?.length
            ? (() => {
                const rawPhone = customer.phone?.[0] || "";
                const phoneNumber = String(rawPhone).replace(/\D/g, "");
                const countryCode = String(customer.countryCode || "").replace(/\D/g, "");
                const whatsappNumber = `${countryCode}${phoneNumber}`;
                const phoneText = customer.phone
                  .map((phone: string) => formatPhoneForDisplay(phone))
                  .join(" - ");
  
                if (!phoneNumber) {
                  return (
                    <span dir="ltr" className="inline-block text-left">
                      {phoneText}
                    </span>
                  );
                }
  
                return (
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="inline-block text-left hover:text-green-600"
                  >
                    {phoneText}
                  </a>
                );
              })()
            : "غير متوفر",
        className: "text-xs font-bold text-slate-600 dark:text-slate-300",
      },
      {
        header: renderSortHeader("الدولة", "country"),
        accessor: (customer: any) => customer.country || "-",
        className: "text-xs font-bold text-slate-600 dark:text-slate-300",
      },
      {
        header: "المسؤول",
        accessor: (customer: any) => {
          const assignedUsers = Array.isArray(customer.users) ? customer.users : [];
          const firstResponsible = assignedUsers[0]?.username || assignedUsers[0]?.name || "غير معين";
          const firstAvatar = assignedUsers[0]?.avatar || "";
          const remainingCount = Math.max(0, assignedUsers.length - 1);
          const hasMultiple = remainingCount > 0;
  
          if (!(user && isAdmin(user))) {
            return (
              <div className="inline-flex items-center gap-2">
                {firstAvatar ? (
                  <img
                    src={firstAvatar}
                    alt={firstResponsible}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-slate-700 dark:text-slate-300">{firstResponsible}</span>
                )}
                {hasMultiple && (
                  <span className="min-w-6 h-6 px-2 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black flex items-center justify-center">
                    {remainingCount}
                  </span>
                )}
              </div>
            );
          }
  
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCustomer(customer);
                setOpenAssignModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
            >
              {firstAvatar ? (
                <img
                  src={firstAvatar}
                  alt={firstResponsible}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <span className="font-bold text-slate-700 dark:text-slate-300">{firstResponsible}</span>
              )}
              {hasMultiple && (
                <span className="min-w-6 h-6 px-2 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black flex items-center justify-center">
                  {remainingCount}
                </span>
              )}
            </button>
          );
        },
        className: "text-xs",
      },
      {
        header: "الحالة",
        accessor: (customer: any) => (
          <select
            value={customer.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              if (LOCKED_STATUS_VALUES.has(e.target.value)) return;
              handleStatus(customer.id, e.target.value);
            }}
            className={`
              appearance-none outline-none cursor-pointer
              px-3 py-1.5 rounded-full text-[10px] font-black text-center transition-all border
              ${customer.status === "فرصة جديدة"
                ? "bg-blue-100 text-blue-600 border-rose-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                : customer.status === "جاري المتابعة"
                  ? "bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                  : customer.status === "تم البيع"
                    ? "bg-yellow-100 text-yellow-600 border-green-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800"
                    : customer.status === "غير مهتم / ملغي"
                      ? "bg-red-100 text-red-500 border-slate-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                      : "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
              }
            `}
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={LOCKED_STATUS_VALUES.has(option.value)}
                className="bg-white text-slate-900"
              >
                {option.label}
              </option>
            ))}
          </select>
        ),
      },
      {
        header: renderSortHeader("تاريخ التسجيل", "createdAt"),
        accessor: (customer: any) => new Date(customer.createdAt).toLocaleDateString("ar-EG", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        className: "text-xs font-bold text-slate-600 dark:text-slate-300",
      },
      {
        header: renderSortHeader("عدد الطلبات", "ordersCount"),
        accessor: (customer: any) => 
        (
          <button
            type="button"
            onClick={() => {
              setisOpenordercustomer(true);
            setCustomerorder(customer.orders);
            }}
            className="font-black text-slate-800 dark:text-slate-100 hover:text-blue-600"
          >
            {customer.orders?.length || 0}
          </button>
        ),
          
        className: "text-xs font-bold text-slate-600 dark:text-slate-300",
      },
      {
        header: "آخر رسالة",
        accessor: (customer: any) => {
          const lastMessage = customer.message && customer.message.length > 0
            ? customer.message[customer.message.length - 1].message
            : "لا توجد رسائل...";
          return <span className="max-w-[220px] truncate block text-slate-500 dark:text-slate-400">{lastMessage}</span>;
        },
      },
    ];
  
    const tableActions: TableAction<any>[] = (() => {
      const actions: TableAction<any>[] = [];
  
      if (user && hasPermission(user, "editCustomers")) {
        actions.push({
          label: "تعديل",
          icon: <Pencil size={16} />,
          onClick: (customer: any) => {
            setEditId(customer.id);
            const normalizedPhones = Array.isArray(customer.phone)
              ? customer.phone.filter((num: any) => String(num || "").trim().length > 0)
              : String(customer.phone || "")
                  .split(/[\s,\-\n]+/)
                  .map((num: string) => num.trim())
                  .filter((num: string) => num.length > 0);
            setFormdata({
              name: customer.name,
              phone: normalizedPhones.length > 0 ? normalizedPhones : [""]
            });
            setIsOpen(true);
          }
        });
      }
  
      if (user && hasPermission(user, "deleteCustomers")) {
        actions.push({
          label: "حذف",
          icon: <Trash2 size={16} />,
          variant: "danger",
          onClick: (customer: any) => deleteCus(customer),
        });
      }
  
      if (user && hasPermission(user, "addOrders")) {
        actions.push({
          label: "الطلبات",
          icon: <ShoppingBag size={16} />,
          onClick: (customer: any) => {
            setCustomerId(customer.id);
            setisOpenOrder(true);
          }
        });
      }
  
      return actions;
    })();

  return (
    <div className="p-6">
      <div className="flex justify-between flex-wrap items-center mb-8 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">نظام إدارة العملاء</h1>
        <div className="flex items-center flex-wrap gap-3">
          {user && hasPermission(user, "addCustomers") && (
            <Button onClick={() => { setFormdata({ name: "", phone: [""] }); setEditId(null); setIsOpen(true); }}><Plus size={20} /></Button>
          )}
        <div className="flex justify-between items-center">

          <div className="flex gap-2">
             {user && isAdmin(user) && (
            <Button onClick={toggleSelectAll} variant="outline">
              <CheckSquare size={20} />
            </Button>
          )}
            {selectedCustomers.length > 0 && user && isAdmin(user) && (
              <>
                <Button onClick={() => setIsBulkAssignOpen(true)} variant="outline">
                  <UserPlus size={20} />
                </Button>
                {hasPermission(user, "deleteCustomers") && (
                  <Button onClick={handleBulkDelete} variant="secondary">
                    <Trash2 size={20} />
                  </Button>
                )}
              </>
            )}
            {user && isAdmin(user) && (
            <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <Button onClick={handleImportClick} variant="outline">
                  <Upload size={20} />
                </Button>
              </>
          )}
            {/* زر التصدير الذكي */}
            {user && isAdmin(user) && (
            <Button onClick={handleExportAction}><Download size={20} /></Button>
          )}
            {/* <button
              
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-white font-bold transition-all ${selectedCustomers.length > 0
                ? 'bg-blue-600 hover:bg-blue-700 shadow-lg scale-105'
                : 'bg-slate-600 hover:bg-slate-700'
                }`}
            >
              <Download size={18} />
            </button> */}

            {/* زر مسح التحديد - يظهر فقط عند وجود تحديد */}
            {selectedCustomers.length > 0 && (
              <button
                onClick={() => setSelectedCustomers([])}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                title="إلغاء التحديد"
              >
                <XCircle size={24} />
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 items-center">
          {/* حقل البحث الحالي */}
          <div className="col-span-2">
            <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالرقم أو الاسم أو الدولة أو المدينة أو اسم الموظف"
            className="flex-1 h-11 w-full rounded-lg border border-slate-800/50 dark:border-slate-100/50 text-slate-800 dark:text-slate-100 bg-transparent p-5 my-3"
          />
          </div>

          {/* خيارات التاريخ */}
          <div className="flex bg-slate-100 w-[100px] justify-center dark:bg-slate-800 p-1 rounded-xl gap-1 h-11 items-center">
            {[
              
              { id: 'تم البيع', label: 'تم البيع' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id !== FORCE_STATUS) return;
                  setDateFilter(tab.id);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dateFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                  } ${tab.id !== FORCE_STATUS ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {tab.label}
              </button>
            ))}

          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setViewMode("table")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === "table"
            ? "bg-blue-600 text-white"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}
          `}
        >
          <Table2 size={16} />
          جدول
        </button>
        <button
          type="button"
          onClick={() => setViewMode("cards")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === "cards"
            ? "bg-blue-600 text-white"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}
          `}
        >
          <LayoutGrid size={16} />
          كرت
        </button>
      </div>
      <div className="  dir-rtl" dir="rtl">
        <div className=" mx-auto">
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCustomers.map((customer) => (
                <div
                  onClick={() => getSingleCustomer(customer)}
                  key={customer.id}
                  className={`group border ${customer.orders.length === 1 ? `border-pink-500` : customer.orders.length >= 2 ? 'border-purple-500' : 'border-transparent'} relative bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer`}
                >
                  <div className="absolute top-4 right-6 z-10">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(customer.id)}
                      // 1. منع الانتشار عند النقر (هذا ما يمنع البطاقة من التفاعل)
                      onClick={(e) => e.stopPropagation()}
                      // 2. معالجة تغيير الحالة
                      onChange={(e) => {
                        toggleSelect(customer.id);
                      }}
                      className="w-5 h-5 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  {/* أزرار الحذف والتعديل - تظهر عند الحوام (Hover) */}
                  <div className="absolute top-4 left-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {user && hasPermission(user, "editCustomers") && (
                      <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditId(customer.id)
                        const normalizedPhones = Array.isArray(customer.phone)
                          ? customer.phone.filter((num: any) => String(num || "").trim().length > 0)
                          : String(customer.phone || "")
                              .split(/[\s,\-\n]+/)
                              .map((num: string) => num.trim())
                              .filter((num: string) => num.length > 0)
                        setFormdata({
                          name: customer.name,
                          phone: normalizedPhones.length > 0 ? normalizedPhones : [""]
                        })
                        setIsOpen(true)
                      }}
                      className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-400 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    )  }
                      {user && hasPermission(user, "deleteCustomers") && (
                        <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCus(customer)
                      }}
                      className="p-2 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100 dark:bg-slate-800 dark:text-rose-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                      )}   
                    
                  </div>

                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-3 mt-4">
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                          {customer.name}
                        </h3>
                        {/* عرض آخر رسالة إذا وجدت */}
                        <p className="text-xs text-slate-500 line-clamp-1 italic font-medium">
                          {customer.message && customer.message.length > 0
                            ? customer.message[customer.message.length - 1].message
                            : "لا توجد رسائل..."}
                        </p>

                      </div>

                      <div className="flex flex-wrap gap-3 items-center mt-2">
                        {/* حالة العميل */}
                        <select
                          value={customer.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (LOCKED_STATUS_VALUES.has(e.target.value)) return;
                            handleStatus(customer.id, e.target.value);
                          }}
                          className={`
      appearance-none outline-none cursor-pointer
      px-4 py-1.5 rounded-full text-[10px] font-black text-center transition-all border
      ${customer.status === "فرصة جديدة" ? 'bg-blue-100 text-blue-600 border-rose-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                              customer.status === "جاري المتابعة" ? 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                                customer.status === "تم البيع" ? 'bg-yellow-100 text-yellow-600 border-green-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' :
                                  customer.status === "غير مهتم / ملغي" ? 'bg-red-100 text-red-500 border-slate-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
                                    'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                            }
    `}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={LOCKED_STATUS_VALUES.has(option.value)}
                              className="bg-white text-slate-900"
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!(user && isAdmin(user))) return;
                            setCustomer(customer);
                            setOpenAssignModal(true);
                          }}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${user && isAdmin(user)
                            ? "bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            : "bg-slate-100/60 dark:bg-slate-800/60 cursor-default"}`}
                          title="ربط الموظفين"
                        >
                          {customer.users?.[0]?.avatar ? (
                            <img
                              src={customer.users[0].avatar}
                              alt={customer.users?.[0]?.username || customer.users?.[0]?.name || "avatar"}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                              {customer.users?.[0]?.username || customer.users?.[0]?.name || "غير معين"}
                            </span>
                          )}
                          {(customer.users?.length || 0) > 1 && (
                            <span className="min-w-6 h-6 px-2 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black flex items-center justify-center">
                              {(customer.users?.length || 0) - 1}
                            </span>
                          )}
                        </button>

                        {/* التاريخ المنسق */}
                        <div className="flex flex-col border-r border-slate-200 dark:border-slate-700 pr-3">
                          <span className="text-[9px] text-slate-400 font-bold leading-none mb-1">تاريخ التسجيل</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black leading-none">
                            {new Date(customer.createdAt).toLocaleDateString('ar-EG', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* الصورة الرمزية */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl font-black text-white border-4 border-white dark:border-slate-800 shadow-lg">
                      {customer.name[0].toUpperCase()}
                    </div>
                  </div>

                  {/* الإحصائيات والأزرار السفلية */}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      {/* أيقونة الطلبات */}
                      {user && hasPermission(user, "addOrders") && (
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomerId(customer.id);
                          setisOpenOrder(true);
                        }}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                        title="الطلبات"
                      >
                        <ShoppingBag size={20} />
                      </button>
                      )}

                      {/* أيقونة تعيين موظف (للأدمن فقط) */}

                      {user && hasPermission(user, "viewOrders") && (
                        <button
                        className="p-2 text-slate-400 hover:text-green-500 hover:bg-blue-50 rounded-xl transition-all"
                        title="اظهار الفواتير"
                        onClick={(e) => {
                          e.stopPropagation()
                          setisOpenordercustomer(true)
                          setCustomerorder(customer.orders)
                        }}><Eye size={20} />
                        </button>
                      )}
                    </div>

                    {/* زر واتساب */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rawPhone = customer.phone?.[0] || '';
                        const phoneNumber = rawPhone.replace(/\D/g, '');
                        const countryCode = (customer.countryCode || '').replace(/\D/g, '');
                        if (phoneNumber) {
                          window.open(`https://wa.me/${countryCode}${phoneNumber}`, '_blank');
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-md shadow-green-200 dark:shadow-none"
                    >
                      <MessageCircle size={16} />
                      واتس
                    </button>

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DataTable
              data={sortedVisibleCustomers}
              columns={tableColumns}
              actions={tableActions}
              actindir
              totalCount={sortedVisibleCustomers.length}
              pageSize={PAGE_SIZE}
              currentPage={page}
              onPageChange={setPage}
            />
          )}

        </div>
      </div>

      <AppModal size="lg" isOpen={isOpen} onClose={() => setIsOpen(false)} title="إضافة ملف عميل شامل">
        <DynamicForm schema={customerSchema} onSubmit={onSubmit} defaultValues={formdata ?? { name: "", phone: [""] }}>
          {({ register, control, formState: { errors } }) => {
            // إعداد المصفوفة الديناميكية للحقول
            const { fields, append, remove } = useFieldArray({
              control,
              name: "phone", // يجب أن يطابق الاسم في الـ Schema
            });

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* اسم العميل */}
                  <FormInput
                  className="col-span-2"
                    label="اسم العميل *"
                    {...register("name")}
                    error={errors.name?.message?.toString()}
                  />

                  {/* قسم أرقام الهواتف الديناميكي */}
                  <div className="col-span-1 md:col-span-2 space-y-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                      أرقام الهاتف *
                    </label>

                    {fields.map((field, index) => (
                      <div key={field.id} className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 dir-ltr">
                            <Controller
                              name={`phone.${index}`} // لاحظ الربط مع الـ index
                              control={control}
                              render={({ field: { onChange, value } }) => (
                                <PhoneInput
                                  international
                                  withCountryCallingCode
                                  defaultCountry="SY"
                                  value={value}
                                  onChange={onChange}
                                  onCountryChange={(country) => {
            if (country) { 
              
              // خيار ب: حفظ مفتاح الاتصال (مثلاً: 963)
              // const code = getCountryCallingCode(country);
              // setValue("countryCode", code);
            }
          }}
                                  className="PhoneInputCustom"
                                  numberInputProps={{
                                    className: "w-full bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                  }}
                                />
                              )}
                            />
                          </div>

                          {/* زر حذف الرقم (يظهر فقط إذا كان هناك أكثر من رقم) */}
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="p-3 text-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-xl hover:bg-rose-100 transition-colors border border-rose-100 dark:border-rose-900/50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            </button>
                          )}
                        </div>

                        {/* عرض خطأ التحقق لكل حقل مستقل */}

                      </div>
                    ))}

                    {/* زر إضافة رقم جديد */}
                    <button
                      type="button"
                      onClick={() => append("")}
                      className="flex items-center gap-2 text-sm text-blue-600 font-bold hover:text-blue-700 transition-all mt-2"
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        +
                      </div>
                      إضافة رقم هاتف آخر
                    </button>
                  </div>

                </div>
              </div>
            );
          }}
        </DynamicForm>
      </AppModal>
      <AppModal size="lg" isOpen={isOpencustomer} onClose={() => setIsOpencustomer(false)} title="بيانات العميل">
        <GetCustomerSingle data={customer} getdatas={getData} />
      </AppModal>

      <OrderCustomer customerId={customerId} customers={customers}
       editId={editId} getData={getData}
        isOpenOrder={isOpenOrder} products={products}
      setEditId={setEditId} setCustomerId={setCustomerId} setisOpenOrder={setisOpenOrder} />


      <AppModal isOpen={OpenAssignModal} onClose={() => setOpenAssignModal(false)} title="ربط المستخدمين بالعميل" >
        <AssignUserModal customer={customer} allUsers={alluser} onSave={handleAssignUsers} />
      </AppModal>
      <AppModal isOpen={isBulkAssignOpen} onClose={() => setIsBulkAssignOpen(false)} title="ربط المستخدمين بالعملاء المحددين" >
        <AssignUserModal
          customer={{ id: "bulk", name: `مجموعة (${selectedCustomers.length})`, users: [] }}
          allUsers={alluser}
          onSave={handleBulkAssignUsers}
        />
      </AppModal>
      <AppModal size='lg' isOpen={isOpenordercustomer} onClose={() => setisOpenordercustomer(false)} title='طلبات العميل'>
        <ViewOrderCustomer orders={customerorder} />
      </AppModal>
    </div>
  );
};

export default CustomrLayout;