"use client";

import * as React from "react";
import * as z from "zod";
import * as XLSX from 'xlsx';
import { DynamicForm } from "@/components/shared/dynamic-form";
import { FormInput } from "@/components/ui/form-input";
import PhoneInput from 'react-phone-number-input'
import { AppModal } from "@/components/ui/app-modal";
import { AssignUsers, createCustomerAction, deleteCustomer, getCustomer, updateCustomer, UpdateStusa } from "@/server/customer";
import { useAuth } from "@/context/AuthContext";
import { formatPhoneForDisplay, hasPermission, isAdmin } from "@/lib/utils";
import toast from "react-hot-toast";
import { getProduct } from "@/server/product";
import { Controller, useFieldArray } from "react-hook-form";
import ViewOrderCustomer from "@/components/pages/customers/viewOrder";
import AssignUserModal from "@/components/pages/customers/assignuser";
import GetCustomerSingle from "@/components/pages/customers/gitSingleCustomer";
import OrderCustomer from "@/components/pages/customers/orderCustomer";
import { useCustomerFilters } from "./hooks/useCustomerFilters";
import { useCustomerSelection } from "./hooks/useCustomerSelection";
import { useCustomerBulkActions } from "./hooks/useCustomerBulkActions";
import { CustomersHeader } from "./components/CustomersHeader";
import { CustomersFilters } from "./components/CustomersFilters";
import { CustomerCard } from "./components/CustomerCard";
import { Eye, MessageCircle, Pencil, ShoppingBag, Table2, Trash2, UserPlus, LayoutGrid } from "lucide-react";
import { DataTable, TableAction } from "@/components/shared/DataTable";
import { a, button } from "framer-motion/client";

/* ===================== Constants ===================== */

const STATUS_OPTIONS = [
  { label: "فرصة جديدة", value: "فرصة جديدة" },
  { label: "مهتم", value: "مهتم" },
  { label: "جاري المتابعة", value: "جاري المتابعة" },
  { label: "تم البيع", value: "تم البيع" },
  { label: "غير مهتم / ملغي", value: "غير مهتم / ملغي" },
];

const LOCKED_STATUS_VALUES = new Set(["جاري المتابعة", "تم البيع"]);


/* ===================== Schema (التحقق المرن) ===================== */
// نصيحة خبير: استخدم .or(z.literal("")) لضمان أن الحقول الفارغة لا تكسر شرط الـ min
const customerSchema = z.object({
  name: z.string().min(3, "الاسم يجب أن يكون 3 حروف على الأقل"),
  // هنا نتأكد أننا نستقبل نصاً من الفورم ثم نحوله لمصفوفة
  phone: z.preprocess(
    (val) => {
      if (Array.isArray(val)) {
        return val.filter((item) => String(item || "").trim().length > 0);
      }
      if (typeof val === "string") {
        const trimmed = val.trim();
        return trimmed.length > 0 ? [trimmed] : [];
      }
      return [];
    },
    z
      .array(
        z.string().refine(
          (value) => value.replace(/\D/g, "").length >= 10,
          "رقم الهاتف يجب أن يكون 10 أرقام أو أكثر"
        )
      )
      .min(1, "يجب إدخال رقم هاتف واحد على الأقل")
  )
});

type CustomerFormValues = z.infer<typeof customerSchema>;

/* ===================== Component ===================== */
const CustomrLayout: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isOpencustomer, setIsOpencustomer] = React.useState(false);
  const [isOpenOrder, setisOpenOrder] = React.useState(false);
  const [customers, setCustomers] = React.useState<any[]>([])
  const [formdata, setFormdata] = React.useState<any>(null)
  const [editId, setEditId] = React.useState<string | null>(null);
  const [customer, setCustomer] = React.useState<any>({})
  const [customerorder, setCustomerorder] = React.useState<any[]>([])
  const [customerId, setCustomerId] = React.useState("");
  const [search, setSearch] = React.useState("")
  const [isOpenordercustomer, setisOpenordercustomer] = React.useState(false)
  const [OpenAssignModal, setOpenAssignModal] = React.useState(false)
  const [isBulkAssignOpen, setIsBulkAssignOpen] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("table");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;
  const [sortState, setSortState] = React.useState<{
    field: "country" | "createdAt" | "ordersCount" | null;
    direction: "asc" | "desc";
  }>({ field: null, direction: "asc" });

  const [dateFilter, setDateFilter] = React.useState('فرصة جديدة');
  const [genderFilter, setGenderFilter] = React.useState('الكل');
  const [createdPreset, setCreatedPreset] = React.useState('month');
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [alluser, setUsers] = React.useState<any[]>([])
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const { user } = useAuth()

  const filterCustomer = useCustomerFilters(customers, search, dateFilter, genderFilter, createdPreset, createdFrom, createdTo);
  const {
    selectedCustomers,
    setSelectedCustomers,
    areAllSelected,
    toggleSelectAll,
    toggleSelect,
  } = useCustomerSelection(filterCustomer);

  // دالة للتعامل مع الاختيار
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

  const { handleBulkAssignUsers, handleBulkDelete } = useCustomerBulkActions({
    selectedCustomers,
    user,
    getData,
    setSelectedCustomers,
    setIsBulkAssignOpen,
  });

  const [products, setProduct] = React.useState<any[]>([])
  React.useEffect(() => {
    getData();
    getAlluser();
    getProduct().then((products) => {
      setProduct(products);
    }).catch(console.error);
  }, [user])
  

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

  const normalizePhoneForInput = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return "";
    return `+${digits}`;
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

  const getCellValueByAliases = (row: Record<string, unknown>, aliases: string[]) => {
    const normalizedRowEntries = Object.entries(row).map(([key, value]) => [String(key || "").trim().toLowerCase(), value] as const);

    for (const alias of aliases) {
      const normalizedAlias = String(alias || "").trim().toLowerCase();
      const hit = normalizedRowEntries.find(([key]) => key === normalizedAlias);
      if (hit && String(hit[1] ?? "").trim() !== "") {
        return hit[1];
      }
    }

    return "";
  };

  const parseImportedDateValue = (value: unknown): string | null => {
    if (value === undefined || value === null || value === "") return null;

    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0));
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
    }

    const normalizeArabicDigits = (input: string) => {
      const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
      const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
      return input
        .split("")
        .map((ch) => {
          const index1 = arabicIndic.indexOf(ch);
          if (index1 >= 0) return String(index1);
          const index2 = easternArabicIndic.indexOf(ch);
          if (index2 >= 0) return String(index2);
          return ch;
        })
        .join("");
    };

    const rawText = String(value)
      .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
      .trim();
    const normalizedText = normalizeArabicDigits(rawText)
      .replace(/\s+/g, " ")
      .trim();

    const arabicDateMatch = normalizedText.match(
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*([AaPp]|AM|PM|ص|م)?)?$/i
    );

    if (arabicDateMatch) {
      const day = Number(arabicDateMatch[1]);
      const month = Number(arabicDateMatch[2]);
      let year = Number(arabicDateMatch[3]);
      let hour = Number(arabicDateMatch[4] || 0);
      const minute = Number(arabicDateMatch[5] || 0);
      const second = Number(arabicDateMatch[6] || 0);
      const ampmToken = String(arabicDateMatch[7] || "").toLowerCase();

      if (year < 100) year += 2000;

      const isPm = ampmToken === "p" || ampmToken === "pm" || ampmToken === "م";
      const isAm = ampmToken === "a" || ampmToken === "am" || ampmToken === "ص";

      if (isPm && hour < 12) hour += 12;
      if (isAm && hour === 12) hour = 0;

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day, hour, minute, second);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
    }

    const date = new Date(normalizedText);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const isExcelErrorToken = (value: string) => {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized.startsWith("#") && (
      normalized.includes("NAME") ||
      normalized.includes("VALUE") ||
      normalized.includes("REF") ||
      normalized.includes("NUM") ||
      normalized.includes("DIV") ||
      normalized.includes("N/A") ||
      normalized.includes("NULL")
    );
  };

  const extractPhonesFromRow = (row: Record<string, unknown>) => {
    const candidates: string[] = [];

    const primaryPhone = getCellValueByAliases(row, [
      "رقم الهاتف",
      "الهاتف",
      "phone",
      "phone number",
      "mobile",
      "الجوال",
    ]);

    if (String(primaryPhone ?? "").trim()) {
      candidates.push(String(primaryPhone));
    }

    for (let index = 1; index <= 10; index += 1) {
      const value = getCellValueByAliases(row, [
        `رقم الهاتف ${index}`,
        `الهاتف ${index}`,
        `phone ${index}`,
        `mobile ${index}`,
      ]);
      if (String(value ?? "").trim()) {
        candidates.push(String(value));
      }
    }

    const excelErrorInAnyPhoneCell = candidates.some((value) => isExcelErrorToken(String(value)));
    const normalizedPhones = normalizePhoneList(candidates.join(","));

    return { normalizedPhones, excelErrorInAnyPhoneCell };
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
        "تاريخ التسجيل ISO": new Date(customer.createdAt).toISOString(),
        "عدد الطلبات": customer.orders?.length || 0,
        "آخر رسالة": lastMessage,
        "الجنس" : customer.gender ||  "غير محدد",
        "الفئة العمرية" : customer.age || "غير محدد",
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
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];

      if (!rows.length) {
        toast.error("الملف فارغ أو لا يحتوي بيانات قابلة للاستيراد");
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      const failedReasons: string[] = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        const rowNumber = index + 2;

        const name = String(getCellValueByAliases(row, ["اسم العميل", "الاسم", "name", "customer name"]) || "").trim();
        const country = String(getCellValueByAliases(row, ["الدولة", "البلد", "country"]) || "").trim();
        const createdAt = parseImportedDateValue(
          getCellValueByAliases(row, ["تاريخ التسجيل ISO", "تاريخ التسجيل", "createdAt", "manualCreatedAt", "تاريخ الإنشاء"])
        );
        const { normalizedPhones, excelErrorInAnyPhoneCell } = extractPhonesFromRow(row);

        if (!name || normalizedPhones.length === 0) {
          failedCount += 1;
          if (excelErrorInAnyPhoneCell) {
            failedReasons.push(`السطر ${rowNumber}: رقم الهاتف مكتوب بصيغة سببت خطأ Excel. اكتب الرقم كنص: '+963988...' أو غيّر تنسيق الخلية إلى Text`);
          } else {
            failedReasons.push(`السطر ${rowNumber}: الاسم أو الهاتف مفقود`);
          }
          continue;
        }

        const payload = {
          name,
          phone: normalizedPhones,
          country,
          countryCode: "",
          city: "",
          createdAt,
        };

        const res = await createCustomerAction(payload, user.id as string);
        if (res.success) {
          successCount += 1;
        } else {
          failedCount += 1;
          failedReasons.push(`السطر ${rowNumber}: ${res.error || "فشل إنشاء العميل"}`);
        }
      }

      if (successCount > 0) {
        toast.success(`تم استيراد ${successCount} عميل`);
      }
      if (failedCount > 0) {
        toast.error(`تعذر استيراد ${failedCount} عميل`);
        failedReasons.slice(0, 3).forEach((reason) => toast.error(reason));
      }

      await getData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل استيراد الملف";
      toast.error(message || "فشل استيراد الملف");
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

  React.useEffect(() => {
    setPage(1);
  }, [search, dateFilter, genderFilter, createdPreset, createdFrom, createdTo, viewMode]);

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
      header: "الدولة",
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
              : customer.status === "مهتم"
                ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
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
      header: "تاريخ التسجيل",
      accessor: (customer: any) => new Date(customer.createdAt).toLocaleDateString("ar-EG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      className: "text-xs font-bold text-slate-600 dark:text-slate-300",
    },
    {
      header: "عدد الطلبات",
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
      <CustomersHeader
        user={user}
        selectedCount={selectedCustomers.length}
        importInputRef={importInputRef}
        onOpenCreate={() => {
          setFormdata({ name: "", phone: [""] });
          setEditId(null);
          setIsOpen(true);
        }}
        onToggleSelectAll={toggleSelectAll}
        onOpenBulkAssign={() => setIsBulkAssignOpen(true)}
        onBulkDelete={handleBulkDelete}
        onImportClick={handleImportClick}
        onImportFile={handleImportFile}
        onExport={handleExportAction}
        onClearSelection={() => setSelectedCustomers([])}
      />

      <CustomersFilters
        search={search}
        setSearch={setSearch}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
        createdPreset={createdPreset}
        setCreatedPreset={setCreatedPreset}
        createdFrom={createdFrom}
        setCreatedFrom={setCreatedFrom}
        createdTo={createdTo}
        setCreatedTo={setCreatedTo}
      />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {visibleCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  user={user}
                  isSelected={selectedCustomers.includes(customer.id)}
                  statusOptions={STATUS_OPTIONS}
                  onOpenCustomer={getSingleCustomer}
                  onToggleSelect={toggleSelect}
                  onEdit={(selectedCustomer) => {
                    setEditId(selectedCustomer.id)
                    const normalizedPhones = Array.isArray(selectedCustomer.phone)
                      ? selectedCustomer.phone.filter((num: any) => String(num || "").trim().length > 0)
                      : String(selectedCustomer.phone || "")
                          .split(/[\s,\-\n]+/)
                          .map((num: string) => num.trim())
                          .filter((num: string) => num.length > 0)
                    setFormdata({
                      name: selectedCustomer.name,
                      phone: normalizedPhones.length > 0 ? normalizedPhones : [""]
                    })
                    setIsOpen(true)
                  }}
                  onDelete={deleteCus}
                  onStatusChange={handleStatus}
                  onOpenOrder={(selectedCustomerId) => {
                    setCustomerId(selectedCustomerId);
                    setisOpenOrder(true);
                  }}
                  onViewOrders={(orders) => {
                    setisOpenordercustomer(true)
                    setCustomerorder(orders)
                  }}
                  onOpenAssign={(selectedCustomer) => {
                    setCustomer(selectedCustomer);
                    setOpenAssignModal(true);
                  }}
                />
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
                                    className: "w-full bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all",
                                    onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => {
                                      event.preventDefault();
                                      const pasted = event.clipboardData.getData("text");
                                      const normalized = normalizePhoneForInput(pasted);
                                      if (normalized) onChange(normalized);
                                    }
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

                        {(errors.phone as any)?.[index] && (
                          <p className="text-xs text-red-500">
                            {(errors.phone as any)[index]?.message as string}
                          </p>
                        )}

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
                    {((errors.phone as any)?.message || (errors.phone as any)?.root?.message) && (
                      <p className="text-xs text-red-500">
                        {((errors.phone as any)?.message || (errors.phone as any)?.root?.message) as string}
                      </p>
                    )}
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