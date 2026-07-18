import { AppModal } from "@/components/ui/app-modal";
import { useAuth } from "@/context/AuthContext";
import { getCities } from "@/server/city";
import { getCountries } from "@/server/country";
import { getGeneralSettings } from "@/server/general-settings";
import { createOrder, updateOrder } from "@/server/order";
import { getshipping } from "@/server/shipping";
import { getWarehouse } from "@/server/warehouse";
import { useOrderStore } from "@/store/customer";
import { AnimatePresence, motion } from "framer-motion";
import { Save, Trash2 } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import PhoneInput from 'react-phone-number-input'

const formatDateForInput = (dateLike?: string | Date | null) => {
  if (!dateLike) return "";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function OrderCustomerEdit({ initialData, customers, customerId, products, isOpenOrder, setEditId, setCustomerId, setisOpenOrder, editId, getData }: { initialData?: any, customers: any, customerId: any, products: any, isOpenOrder: any, setEditId: any, setCustomerId: any, setisOpenOrder: any, editId: any, getData: any }) {
  // ...existing code...
  const [items, setItems] = React.useState([
    { productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }
  ]);
  const [paymentMethod, setPaymentMethod] = React.useState("عند الاستلام");
  const [turkeyExchangeRate, setTurkeyExchangeRate] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    const loadExchangeRate = async () => {
      try {
        const res = await getGeneralSettings();
        if (isMounted) {
          setTurkeyExchangeRate(Number(res?.data?.usdToTryRate || 0));
        }
      } catch (error) {
      }
    };

    loadExchangeRate();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const loadShipping = async () => {
      try {
        const res = await getshipping();
        if (isMounted && res?.success) {
          setShipping(Array.isArray(res.data) ? res.data : []);
        }
      } catch (error) {
      }
    };

    loadShipping();
    return () => {
      isMounted = false;
    };
  }, []);

  // بيانات المستلم والعنوان
  const [receiverName, setReceiverName] = React.useState("");
  const [receiverPhone, setReceiverPhone] = React.useState<(string | undefined)[]>([""]);
  const [stockWarehouseId, setStockWarehouseId] = React.useState("");
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [countryRows, setCountryRows] = React.useState<any[]>([]);
  const [cityRows, setCityRows] = React.useState<any[]>([]);
  const [country, setCountry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [municipality, setMunicipality] = React.useState("");
  const [fullAddress, setFullAddress] = React.useState("");
  const [status, setStatus] = React.useState("طلب جديد");
  // تفاصيل الشحن
  const [amount, setamount] = React.useState("");
  const [amountBank, setamountBank] = React.useState("");
  const [googleMapsLink, setGoogleMapsLink] = React.useState("");
  const [shipping, setShipping] = React.useState<any[]>([]);
  const [shippingId, setShippingId] = React.useState<string>("");
  const [deliveryMethod, setDeliveryMethod] = React.useState("");

  const [customerSearchQuery, setCustomerSearchQuery] = React.useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
  const [deliveryNotes, setDeliveryNotes] = React.useState("");
  const [overallDiscount, setOverallDiscount] = React.useState(0);
  const [additionalNotes, setAdditionalNotes] = React.useState("");
  const [manualCreatedAt, setManualCreatedAt] = React.useState("");
  const [searchQueries, setSearchQueries] = React.useState<Record<number, string>>({});
  const [showDropdown, setShowDropdown] = React.useState<Record<number, boolean>>({});
  const { user } = useAuth()
  const isAdminUser = user?.accountType === "ADMIN";
  const isEditMode = Boolean(editId);
  const selectedWarehouse = warehouses.find((warehouse) => String(warehouse.id) === stockWarehouseId);
  const stockCountry = String(selectedWarehouse?.location || "").trim();
  const selectedCountryRow = countryRows.find((row) => row.name === country);
  const filteredCities = selectedCountryRow
    ? cityRows.filter((row) => Number(row.countryId) === Number(selectedCountryRow.id))
    : [];

  const isTurkeyStock = stockCountry === "تركيا";
  const currencySymbol = isTurkeyStock ? "₺" : "$";
  const convertUsdToOrderCurrency = (value: number) => {
    const normalized = Number(value || 0);
    return isTurkeyStock && turkeyExchangeRate > 0 ? normalized * turkeyExchangeRate : normalized;
  };

  const getProductAvailableStockByWarehouse = (product: any, selectedWarehouseValue: string) => {
    if (!Array.isArray(product?.stocks)) return 0;
    return product.stocks
      .filter((stock: any) => String(stock?.warehouse?.id || "") === String(selectedWarehouseValue || ""))
      .reduce((sum: number, stock: any) => sum + (Number(stock?.quantity) || 0), 0);
  };

  const getProductPricingByWarehouse = (product: any, selectedWarehouseValue: string) => {
    if (!Array.isArray(product?.stocks) || !selectedWarehouseValue) {
      return { price: 0, discount: 0 };
    }

    const matchedStock = product.stocks.find((stock: any) =>
      String(stock?.warehouse?.id || "") === String(selectedWarehouseValue || "") && Number(stock?.quantity || 0) > 0
    );

    if (!matchedStock) {
      return { price: 0, discount: 0 };
    }

    return {
      price: convertUsdToOrderCurrency(Number(matchedStock?.price || 0)),
      discount: convertUsdToOrderCurrency(Number(matchedStock?.discount || 0)),
    };
  };

  React.useEffect(() => {
    let isMounted = true;

    const loadReferenceData = async () => {
      try {
        const [warehouseRows, countriesData, citiesData] = await Promise.all([
          getWarehouse(),
          getCountries(),
          getCities(),
        ]);

        if (!isMounted) {
          return;
        }

        setWarehouses(Array.isArray(warehouseRows) ? warehouseRows : []);
        setCountryRows(Array.isArray(countriesData) ? countriesData : []);
        setCityRows(Array.isArray(citiesData) ? citiesData : []);
      } catch (error) {
      }
    };

    loadReferenceData();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
  if (initialData && isOpenOrder) {
    console.log("Initial Data:", initialData)
    // تعبئة البيانات عند التعديل
    setItems(initialData.items || []);
    setCustomerId(initialData.customerId || "");
    setReceiverName(initialData.receiverName || "");
    setReceiverPhone(initialData.receiverPhone || [""]);
    setStockWarehouseId(initialData?.warehouseId ? String(initialData.warehouseId) : "");
    setCountry(initialData.country || "");
    setCity(initialData.city || "");
    setamount(initialData?.amount)
    setamountBank(initialData?.amountBank)
    setShippingId(initialData?.shippingId ? String(initialData.shippingId) : "");
    setDeliveryMethod(initialData?.deliveryMethod || "");
    setTurkeyExchangeRate(Number(initialData?.usdToTryRateAtOrder || 0));
    setMunicipality(initialData.municipality || "");
    setFullAddress(initialData.fullAddress || "");
    setPaymentMethod(initialData.paymentMethod || "عند الاستلام");
    setOverallDiscount(Number(initialData?.discount ?? initialData?.overallDiscount ?? 0));
    setStatus(initialData.status || "طلب جديد");
    setManualCreatedAt(formatDateForInput(initialData?.manualCreatedAt || initialData?.createdAt));
  } else if (!initialData && isOpenOrder) {
    // تصفير الحقول عند إضافة طلب جديد
    resetForm();
  }
}, [initialData, isOpenOrder]);
  const addNewItem = () => {
    setItems([...items, { productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }]);
  };

  const getEffectivePrice = (price: number, discount: number) => {
    return Math.max(0, Number(price || 0) - Number(discount || 0));
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
      const pricing = getProductPricingByCountry(product, stockCountry);
      item.productId = value;
      item.name = product?.name || "";
      item.modelNumber = product?.modelNumber || "";
      item.price = pricing.price;
      item.discount = pricing.discount;
      setSearchQueries({ ...searchQueries, [index]: item.name });
      setShowDropdown({ ...showDropdown, [index]: false });
    } else {
      (item as any)[field] = value;
    }

    item.total = getEffectivePrice(item.price, item.discount) * item.quantity;
    setItems(newItems);
  };

  const setGrandTotal = useOrderStore((state) => state.setGrandTotal);

  const subTotal = items.reduce((sum, item) => sum + ((item.price - item.discount) * item.quantity), 0);
  const grandTotal = subTotal - overallDiscount;
  // تحديث المخزن العالمي عند تغير المجموع أو المبلغ المدفوع
  React.useEffect(() => {
    setGrandTotal(grandTotal);
  }, [grandTotal]);

  const resetForm = () => {
    // إغلاق المودال أولاً
    setisOpenOrder(false);

    // إعادة بيانات الطلب والمنتجات
    setStatus("طلب جديد");
    setEditId(null);
    setItems([{ productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }]);
    setSearchQueries({});
    setShowDropdown({});
    setOverallDiscount(0);

    // إعادة بيانات العميل
    setCustomerId("");
    setCustomerSearchQuery("");
    setShowCustomerDropdown(false);
    setPaymentMethod("عند الاستلام");

    // إعادة بيانات المستلم والعنوان
    setReceiverName("");
    setReceiverPhone([""]);
    setStockWarehouseId("");
    setCountry("");
    setCity("");
    setMunicipality("");
    setFullAddress("");

    // إعادة تفاصيل الشحن والملاحظات
    setamount("");
    setamountBank("");
    setGoogleMapsLink("");
    setShippingId("");
    setDeliveryMethod("");
    setDeliveryNotes("");
    setAdditionalNotes("");
    setManualCreatedAt("");
  };
  const handleSubmit = async () => {
    // التحقق الأولي
    if (!customerId) {
      toast.error("يرجى اختيار العميل");
      return;
    }

    if (!receiverName || receiverName.trim() === "") {
      toast.error("يرجى تحديد اسم المستلم");
      return;
    }

    if (!stockWarehouseId) {
      toast.error("يرجى اختيار المستودع");
      return;
    }

    if (!country || !String(country).trim() || !city || !String(city).trim()) {
      toast.error("يرجى اختيار الدولة والمدينة");
      return;
    }

    if (!municipality || municipality.trim() === "") {
      toast.error("يرجى تحديد البلدية/المنطقة");
      return;
    }
    if (!fullAddress || fullAddress.trim() === "") {
      toast.error("يرجى كتابة عنوان التسليم");
      return;
    }

    if (items.length === 0 || !items[0].productId) {
      toast.error("يرجى إضافة منتج واحد على الأقل");
      return;
    }

    if (receiverPhone.length === 0 || receiverPhone.some(phone => !phone || phone.length < 10)) {
  toast.error("يرجى إدخال رقم هاتف صحيح");
  return;
}

    if(paymentMethod === "مختلطة"){
      if(amount === "" && amountBank === ""){
        toast.error("يجب ادخال قيمة الدفعة المستلمة")
      }
    }



    // تفعيل حالة التحم

    // تصحيح رسالة الـ Toast
    const loadingMessage = "جاري حفظ الطلب الجديد...";
    const loadingToast = toast.loading(loadingMessage);

    const orderData = {
      customerId,
      status,
      receiverName,
      receiverPhone,
      warehouseId: Number(stockWarehouseId),
      stockCountry,
      usdToTryRateAtOrder: stockCountry === "تركيا" ? Number(turkeyExchangeRate) : 0,
      country,
      city,
      municipality,
      fullAddress,
      googleMapsLink,
      shippingId: shippingId || null,
      deliveryMethod,
      amount,
      amountBank: Number(grandTotal - Number(amount)),
      deliveryNotes,
      paymentMethod,
      additionalNotes,
      grandTotal: Number(grandTotal),
      overallDiscount: Number(overallDiscount),
      subTotal: Number(subTotal),
      ...(isAdminUser && isEditMode ? { manualCreatedAt: manualCreatedAt || null } : {})
    };

    try {
      let res;
      // // حالة إنشاء طلب جديد
      res = await updateOrder(orderData, editId , items);
      console.log(orderData, customerId, items, user?.id)
      if (res.success) {
        toast.success(editId ? "تم تحديث الطلب بنجاح" : "تم حفظ الطلب بنجاح");

        // تحديث قائمة الطلبات في الواجهة
        getData()

        // إغلاق المودال
        setisOpenOrder(false);

        // تنظيف الحقول (اختياري حسب حاجتك)
        resetForm();
      } else {
        // عرض الخطأ القادم من السيرفر (مثل كمية غير كافية أو فشل Transaction)
        console.log(res.success)
        toast.error(res.success || "فشل في معالجة الطلب يرجى التأكد من عدد المنتجات أو اسم المنتج");

      }
    } catch (error) {
      console.log("Submit Error:", error);
      toast.error("حدث خطأ غير متوقع في النظام");
    } finally {
      // إنهاء حالة التحميل وإخفاء الـ Toast
      toast.dismiss(loadingToast);
    }
  };


  return (
    <div>
      <AppModal footer={
        <div className="pt-6 w-full flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-6 items-center">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-red-500 uppercase px-1">خصم إضافي (كلي)</label>
              <div className="relative">
                <input type="number" value={overallDiscount} onChange={(e) => setOverallDiscount(Number(e.target.value))} className="w-32 bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 dark:border-red-900/20 outline-none font-bold text-red-600 text-center" placeholder="0" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400"> {currencySymbol}</span>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 px-8 py-4 rounded-3xl">
              <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">الإجمالي النهائي</p>
              <h3 className="text-3xl font-black font-sans text-blue-600 italic"> {currencySymbol}{grandTotal.toLocaleString()}</h3>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              className={`px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2`}
            >
              <Save size={20} /> حفظ الفاتورة
            </button>
            <button
              onClick={resetForm}
              className="px-8 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      } size='full' isOpen={isOpenOrder} onClose={resetForm} title='اضافة طلب'>
        <div>
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2 my-1">
                <label className="text-xs font-bold text-slate-500 mr-2" htmlFor="">العميل /المورد</label>
                <input
                  disabled={true}
                  type="text"
                  // يعرض اسم العميل المختار حالياً أو نص البحث
                  value={customerSearchQuery || customers?.find((c: any) => c.id === customerId)?.name || ""}
                  placeholder="ابحث عن عميل..."
                  onFocus={() => setShowCustomerDropdown(true)}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 mr-2">المستودع</label>
                <select
                  value={stockWarehouseId}
                  onChange={(e) => {
                    setStockWarehouseId(e.target.value);
                
                    setSearchQueries({});
                    setShowDropdown({});
                  }}
                  className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="">اختر المستودع</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.name} - {warehouse.location}
                    </option>
                  ))}
                </select>
              </div>
              {isAdminUser && isEditMode && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 mr-2">تاريخ الإنشاء (اختياري)</label>
                  <input
                    type="date"
                    value={manualCreatedAt}
                    onChange={(e) => setManualCreatedAt(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              )}
            </div>
            {items.map((item: any, index: number) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 items-center">
                <div className="md:col-span-3 relative"> {/* تم إضافة relative هنا لضبط القائمة المنسدلة */}
                  <label className="text-[10px] font-bold text-slate-400 mb-1">المنتج</label>
                  <input
                    type="text"
                    value={searchQueries[index] || item.product?.name || item.product?.modelNumber}
                    placeholder="اكتب اسم المنتج..."
                    onFocus={() => setShowDropdown({ ...showDropdown, [index]: true })}
                    onChange={(e) => {
                      setSearchQueries({ ...searchQueries, [index]: e.target.value });
                      setShowDropdown({ ...showDropdown, [index]: true });
                    }}
                    className="w-full text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-900 p-3 rounded-xl border-none outline-none font-bold text-sm shadow-sm"
                  />
                  <AnimatePresence>
                    {showDropdown[index] && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute z-[210] w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {products?.filter((p: any) => {
                          const currentStock = stockWarehouseId ? getProductAvailableStockByWarehouse(p, stockWarehouseId) : 0;
                          const isAvailable = currentStock > 0;
                          const matchesWarehouse = stockWarehouseId
                            ? Array.isArray(p?.stocks) && p.stocks.some((s: any) => String(s?.warehouse?.id || "") === stockWarehouseId)
                            : false;

                          // شرط البحث (الاسم أو الموديل)
                          const query = (searchQueries[index] || "").toLowerCase();
                          const matchesSearch =
                            String(p?.name || "").toLowerCase().includes(query) ||
                            String(p?.modelNumber || "").toLowerCase().includes(query);

                          return isAvailable && matchesSearch && matchesWarehouse;
                        }
                        ).map((product: any) => {
                          const pricing = getProductPricingByWarehouse(product, stockWarehouseId);
                          return (
                          <div
                            key={product.id}
                            onClick={() => updateItem(index, "productId", product.id.toString(), products)}
                            className="px-4 py-3 hover:bg-blue-50 text-slate-900 dark:text-slate-50 dark:hover:bg-blue-900/20 cursor-pointer text-sm font-bold border-b border-slate-50 dark:border-slate-700 last:border-0"
                          >
                            <div className="flex justify-between items-center">
                              <span className='text-slate-900 dark:text-slate-50'>{product.name}</span>
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">
                                {product.modelNumber}
                              </span>
                            </div>
                            <div className="text-blue-500 text-xs mt-1"> {currencySymbol} {getEffectivePrice(pricing.price, pricing.discount)}</div>
                          </div>
                        )})}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="md:col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 mb-1">الكمية</label>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0, products)} className="w-full text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-900 p-3 rounded-xl text-center font-bold outline-none text-sm shadow-sm" />
                </div>
                <div className="md:col-span-1 text-center">
                  <label className="text-[10px] font-bold text-slate-400 mb-1">السعر</label>
                  <div className="p-3 text-sm font-bold"> {currencySymbol}{getEffectivePrice(item.price, item.discount)}</div>
                </div>
                <div className="md:col-span-1">
                  <label className="text-[10px] font-bold text-red-400 mb-1">الخصم</label>
                  <input type="number" value={item.discount} onChange={(e) => updateItem(index, "discount", e.target.value, products)} className="w-full bg-red-50 dark:bg-red-900/10 p-3 rounded-xl text-center font-bold text-red-600 outline-none text-sm border border-red-100 dark:border-red-900/20" />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-bold text-slate-400 mb-1">ملاحظات المنتج</label>
                  <input type="text" value={item.note} onChange={(e) => updateItem(index, "note", e.target.value, products)} className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl outline-none text-xs shadow-sm" placeholder="إضافة ملاحظة..." />
                </div>
                <div className="md:col-span-1 text-center font-black text-blue-600 italic"> {currencySymbol}{(item.price -item.discount) * item.quantity }</div>
                <div className="md:col-span-1 flex justify-center">
                  <button
                    onClick={() => {
                      // تصفية المصفوفة لحذف العنصر المختار
                      const newItems = items.filter((_, i) => i !== index);
                      setItems(newItems);

                      // تحديث حالات البحث والقوائم المنسدلة المرتبطة بالفهارس (Indices)
                      const newQueries = { ...searchQueries };
                      const newDropdowns = { ...showDropdown };

                      // حذف المفتاح الخاص بالعنصر المحذوف
                      delete newQueries[index];
                      delete newDropdowns[index];

                      // إعادة بناء الكائنات لضمان ترتيب المفاتيح بعد الحذف (اختياري لكنه يحل مشاكل الإزاحة)
                      const resetQueries: Record<number, string> = {};
                      const resetDropdowns: Record<number, boolean> = {};

                      newItems.forEach((_, i) => {
                        // إذا كان الفهرس القديم موجوداً، انقله للفهرس الجديد
                        const oldIndex = i >= index ? i + 1 : i;
                        if (searchQueries[oldIndex]) resetQueries[i] = searchQueries[oldIndex];
                        if (showDropdown[oldIndex]) resetDropdowns[i] = showDropdown[oldIndex];
                      });

                      setSearchQueries(resetQueries);
                      setShowDropdown(resetDropdowns);
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addNewItem} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold text-xs hover:border-blue-500 hover:text-blue-500 transition-all">+ إضافة بند جديد</button>
          </div>
          <div className="space-y-8" dir="rtl">
            {/* القسم الأول: بيانات العميل والطلب */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
              {/* معلومات المستلم مع قائمة منسدلة للبحث */}
              <div className="space-y-2 md:col-span-2 relative">
                <label className="text-xs font-bold text-slate-500 mr-2">معلومات المستلم</label>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 mr-2">اسم الشخص المستلم</label>
                <input type="text" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="اسم المستلم" className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500">أرقام هواتف المستلم</label>
                {receiverPhone.map((phone: any, index: any) => (
                  <div key={index} className="flex w-full items-start gap-2">
                    <PhoneInput
                      international
                      placeholder="Enter phone number"
                      value={phone}
                      withCountryCallingCode
                      className="w-full min-w-0 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      onChange={(value) => { // القيمة هنا هي الرقم مباشرة وليست e
                        const newPhones = [...receiverPhone];
                        newPhones[index] = value; // نضع القيمة مباشرة
                        setReceiverPhone(newPhones);
                      }}
                      defaultCountry="SY"
                    />

                    {/* زر حذف الحقل إذا كان هناك أكثر من حقل واحد */}
                    {receiverPhone.length > 1 && (
                      <button
                        onClick={() => setReceiverPhone(receiverPhone.filter((_: any, i: any) => i !== index))}
                        className="p-2 text-rose-500 bg-rose-50 rounded-lg"
                      >
                        X
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setReceiverPhone([...receiverPhone, ""])}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  + إضافة رقم هاتف آخر
                </button>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 mr-2">طريقة الدفع</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                  <option value="عند الاستلام">عند الاستلام</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                  <option value="مختلطة">مختلطة</option>
                </select>
              </div>
              {paymentMethod === "مختلطة" ? (
                <div className="grid col-span-2 grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 mr-2">المبلغ المستلم</label>
                    <input type="text" value={amount} onChange={(e) => setamount(e.target.value)} className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 mr-2">المبلغ المتبقي</label>
                    <input type="text" value={Number(grandTotal) - Number(amount)} readOnly className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left" dir="ltr" />
                  </div>
                </div>
              ) : (
                <div className=""></div>
              )}
            </div>

            {/* القسم الثاني: تفاصيل العنوان والشحن */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 mr-2">الدولة</label>
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setCity("");
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                >
                  <option value="">اختر الدولة</option>
                  {countryRows.map((countryRow) => (
                    <option key={countryRow.id} value={countryRow.name}>{countryRow.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 mr-2">المدينة / المنطقة</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!country}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold disabled:opacity-50"
                >
                  <option value="">اختر المدينة</option>
                  {filteredCities.map((cityRow) => (
                    <option key={cityRow.id} value={cityRow.name}>{cityRow.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 mr-2">البلدية</label>
                <input type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
            </div>

            {/* القسم الثالث: الشحن والملاحظات */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 mr-2">شركة الشحن</label>
                <select
                  value={shippingId}
                  onChange={(e) => setShippingId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="">اختر شركة الشحن</option>
                  {shipping.map((s: any) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 mr-2">عنوان التسليم التفصيلي</label>
                <input type="text" value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 mr-2">رابط الخريطة</label>
                <input type="text" value={googleMapsLink} onChange={(e) => setGoogleMapsLink(e.target.value)} placeholder="رابط الخريطة" className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left" dir="ltr" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 mr-2">ملاحظات التوصيل</label>
                <textarea rows={2} value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="ملاحظات للمندوب..." className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none" />
              </div>
            </div>
          </div>

        </div>
      </AppModal>

    </div>
  )
}