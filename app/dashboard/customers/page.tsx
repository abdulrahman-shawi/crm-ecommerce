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
import { hasPermission, isAdmin } from "@/lib/utils";
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

/* ===================== Constants ===================== */

const STATUS_OPTIONS = [
  { label: "فرصة جديدة", value: "فرصة جديدة" },
  { label: "جاري المتابعة", value: "جاري المتابعة" },
  { label: "تم البيع", value: "تم البيع" },
  { label: "غير مهتم / ملغي", value: "غير مهتم / ملغي" },
];


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

  const [dateFilter, setDateFilter] = React.useState('الكل');
  const [alluser, setUsers] = React.useState<any[]>([])
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const { user } = useAuth()

  const filterCustomer = useCustomerFilters(customers, search, dateFilter);
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
        const phoneArray = Array.isArray(data.phone)
          ? data.phone.filter((num) => String(num || "").trim().length > 0)
          : String(data.phone || "")
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
      />
      <div className="  dir-rtl" dir="rtl">
        <div className=" mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filterCustomer
              .filter((customer) => {
                if (isAdmin(user)) return true;
                return customer.users.some((u: any) => u.id === user?.id);
              })
              .map((customer) => (
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