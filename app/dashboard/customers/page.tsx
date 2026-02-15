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
import { hasPermission, isAdmin } from "@/lib/utils";
import toast from "react-hot-toast";
import { CheckSquare, Download, Eye, MapPin, MessageCircle, Pencil, Phone, Plus, Save, Send, ShoppingBag, Trash2, Upload, UserPlus, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getProduct } from "@/server/product";
import { createOrder } from "@/server/order";
import { Controller, useFieldArray } from "react-hook-form";
import ViewOrderCustomer from "@/components/pages/customers/viewOrder";
import AssignUserModal from "@/components/pages/customers/assignuser";
import GetCustomerSingle from "@/components/pages/customers/gitSingleCustomer";
import OrderCustomer from "@/components/pages/customers/orderCustomer";
import { Country, City } from 'country-state-city';

/* ===================== Constants ===================== */

const STATUS_OPTIONS = [
  { label: "فرصة جديدة", value: "فرصة جديدة" },
  { label: "جاري المتابعة", value: "جاري المتابعة" },
  { label: "تم البيع", value: "تم البيع" },
  { label: "غير مهتم / ملغي", value: "غير مهتم / ملغي" },
];


const countryOptions = [
  { label: "أفغانستان (+93)", value: "+93-AF" },
  { label: "ألبانيا (+355)", value: "+355-AL" },
  { label: "الجزائر (+213)", value: "+213-DZ" },
  // ...
  { label: "كندا (+1)", value: "+1-CA" },
  { label: "الولايات المتحدة (+1)", value: "+1-US" },
  // ...
  { label: "كازاخستان (+7)", value: "+7-KZ" },
  { label: "روسيا (+7)", value: "+7-RU" },
];


/* ===================== Schema (التحقق المرن) ===================== */
// نصيحة خبير: استخدم .or(z.literal("")) لضمان أن الحقول الفارغة لا تكسر شرط الـ min
const customerSchema = z.object({
  name: z.string().min(3, "الاسم يجب أن يكون 3 حروف على الأقل"),
  // هنا نتأكد أننا نستقبل نصاً من الفورم ثم نحوله لمصفوفة
  phone: z.preprocess(
    (val) => (typeof val === "string" && val !== "" ? [val] : val),
    z.array(z.string()).optional().default([])
  ),
  countryCode: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  
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

  const [dateFilter, setDateFilter] = React.useState('الكل');
  const [alluser, setUsers] = React.useState<any[]>([])
  const [selectedCustomers, setSelectedCustomers] = React.useState<any[]>([]);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  const [selectedCountryCode, setSelectedCountryCode] = React.useState(formdata?.countryCode || "");

// جلب القوائم
const countriesList = React.useMemo(() => 
  Country.getAllCountries().map(c => ({ label: `${c.name} ${c.flag}`, value: c.isoCode })), 
[]);

const citiesList = React.useMemo(() => 
  selectedCountryCode ? (City.getCitiesOfCountry(selectedCountryCode) || []).map(c => ({ label: c.name, value: c.name })) : [], 
[selectedCountryCode]);
  // دالة للتعامل مع الاختيار

  const filterCustomer = customers.filter((e: any) => {
    // 1. منطق البحث النصي الحالي
    const matchesSearch =
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.countryCode?.toLowerCase().includes(search.toLowerCase()) ||
      e.phone?.some((p:any )=> p.toLowerCase().includes(search.toLowerCase())) ||
      e.city?.toLowerCase().includes(search.toLowerCase()) || // أضفت المدينة كما طلبت
      e.country?.toLowerCase().includes(search.toLowerCase());


    // إذا كان المستخدم اختار حالة معينة، نقوم بالمطابقة، وإذا لم يختار (All) نعرض الكل
    const matchesStatus = dateFilter !== 'الكل'
      ? e.status === dateFilter
      : true;

    return matchesSearch && matchesStatus;
  });

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
      item.productId = value;
      item.name = product?.name || "";
      item.modelNumber = product?.modelNumber || "";
      item.price = product?.price || 0;
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
  const toggleTab = (tab: "skin" | "laser" | "slimming") => {
    setActiveTabs((prev) =>
      prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab]
    );
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
  const { user } = useAuth()
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

  const onSubmit = async (data: CustomerFormValues) => {
    const loading = toast.loading(editId ? "جاري تحديث العميل" : "جاري إضافة العميل")
    if (editId) {

      try {
        const res = await updateCustomer(data, editId)
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
        // 1. استلام القيمة والتأكد من تحويلها لنص أولاً للمعالجة
        // نستخدم String() لضمان تحويل أي نوع قادم إلى نص بأمان
        const rawInput = String(data.phone || "");

        // 2. تقسيم النص بناءً على المسافات أو الفواصل
        const phoneArray = rawInput
          .split(/[,\s\n]+/)
          .map(num => num.trim())
          .filter(num => num.length > 0);

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
    const worksheetData = customers.map((customer) => {
      // تجميع الرسائل الأخيرة أو الطلبات إذا أردت
      const lastMessage = customer.message && customer.message.length > 0
        ? customer.message[customer.message.length - 1].message
        : "لا توجد رسائل";

      return {
        "اسم العميل": customer.name,
        "رقم الهاتف": customer.phone ? customer.phone.join(' - ') : 'N/A',
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

        const phoneArray = phoneRaw
          .split(/\s*-\s*|,|\n/)
          .map((num) => num.trim())
          .filter((num) => num.length > 0);

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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">نظام إدارة العملاء</h1>
        <div className="flex items-center gap-3">
          {user && hasPermission(user, "addCustomers") && (
            <Button onClick={() => setIsOpen(true)}><Plus size={20} /></Button>
          )}
        <div className="flex justify-between items-center">

          <div className="flex gap-2">
            <Button onClick={toggleSelectAll} variant="outline">
              <CheckSquare size={20} />
            </Button>
            {selectedCustomers.length > 0 && (
              <>
                <Button onClick={() => setIsBulkAssignOpen(true)} variant="outline">
                  <UserPlus size={20} />
                </Button>
                <Button onClick={handleBulkDelete} variant="secondary">
                  <Trash2 size={20} />
                </Button>
              </>
            )}
            {canImport && (
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
            <Button onClick={handleExportAction}><Download size={20} /></Button>
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
            placeholder="ابحث بالرقم أو الاسم أو المدينة"
            className="flex-1 h-11 w-full rounded-lg border border-slate-800/50 dark:border-slate-100/50 text-slate-800 dark:text-slate-100 bg-transparent p-5 my-3"
          />
          </div>

          {/* خيارات التاريخ */}
          <div className="flex bg-slate-100 w-full justify-center dark:bg-slate-800 p-1 rounded-xl gap-1 h-11 items-center">
            {[
              { id: 'الكل', label: 'الكل' },
              { id: 'فرصة جديدة', label: 'فرصة جديدو' },
              { id: 'جاري المتابعة', label: 'جاري المتابعة' },
              { id: 'تم البيع', label: 'تم البيع' },
              { id: 'غير مهتم / ملغي', label: 'غير مهتم / ملغي' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)} // تأكد من تعريف هذا الـ State
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dateFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}

          </div>
        </div>
      </div>
      <div className="  dir-rtl" dir="rtl">
        <div className=" mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filterCustomer
              .filter((customer) => {
                if (isAdmin(user)) return true;
                return customer.users.some((u: any) => u.id === user?.id);
              })
              .map((customer) => (
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
                        setFormdata({
                          name: customer.name,
                          phone: customer.phone ? customer.phone.join(' ') : '',
                          countryCode: customer.countryCode,
                          country: customer.country
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
                            handleStatus(customer.id, e.target.value);
                          }}
                          className={`
      appearance-none outline-none cursor-pointer
      px-4 py-1.5 rounded-full text-[10px] font-black text-center transition-all border
      ${customer.status === "فرصة جديدة" ? 'bg-blue-100 text-blue-600 border-rose-200' :
                              customer.status === "جاري المتابعة" ? 'bg-green-100 text-green-600 border-green-200' :
                                customer.status === "تم البيع" ? 'bg-yellow-100 text-yellow-600 border-green-200' :
                                  customer.status === "غير مهتم / ملغي" ? 'bg-red-100 text-red-500 border-slate-200' :
                                    'bg-amber-100 text-amber-600 border-amber-200'
                            }
    `}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value} className="bg-white text-slate-900">
                              {option.label}
                            </option>
                          ))}
                        </select>

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
                      {user && isAdmin(user) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomer(customer);
                            setOpenAssignModal(true);
                          }}
                          className="p-2 flex text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                          title="تعيين موظف"
                        >
                          {customer.users.map((e: any, i: any) => (
                            <div className="w-5 h-5 flex items-center rounded-full p-1">
                              <p>{e.username[0]}</p>
                            </div>
                          ))}
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
                      تواصل
                    </button>

                  </div>
                </div>
              ))}
          </div>

        </div>
      </div>

      <AppModal size="lg" isOpen={isOpen} onClose={() => setIsOpen(false)} title="إضافة ملف عميل شامل">
        <DynamicForm schema={customerSchema} onSubmit={onSubmit} defaultValues={formdata}>
          {({ register, control, formState: { errors }, setValue }) => {
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

                  {/* الدولة */}
                  <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900 dark:text-slate-100">الدولة</label>
            <select
              {...register("countryCode")}
              className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => {
                const code = e.target.value;
                setSelectedCountryCode(code);
                // تحديث اسم الدولة النصي أيضاً إذا كنت تحتاجه في الـ Schema
                const countryName = countriesList.find(c => c.value === code)?.label || "";
                setValue("country", countryName);
                setValue("city", ""); // تصفير المدينة عند تغيير الدولة
              }}
            >
              <option value="">اختر الدولة</option>
              {countriesList.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.countryCode && <p className="text-xs text-red-500">{errors.countryCode.message?.toString()}</p>}
          </div>

          {/* اختيار المدينة (يظهر فقط إذا تم اختيار دولة) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900 dark:text-slate-100">المدينة</label>
            <select
              {...register("city")}
              disabled={!selectedCountryCode}
              className="w-full text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">اختر المدينة</option>
              {citiesList.map((city) => (
                <option key={city.value} value={city.value}>{city.label}</option>
              ))}
            </select>
          </div>

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