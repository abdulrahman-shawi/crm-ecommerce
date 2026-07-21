"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Save, Trash2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import toast from "react-hot-toast";
import { AppModal } from "@/components/ui/app-modal";
import { getCountries } from "@/server/country";
import { getCities } from "@/server/city";
import { getWarehouse } from "@/server/warehouse";
import { getProductCatalog } from "@/server/product";
import { createWholesaleOrder } from "@/server/wholesale-order";

interface WholesaleCustomer {
  id: string;
  name: string;
  contactName: string | null;
  phone: string[];
  country: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  googleMapsLink: string | null;
  notes: string | null;
}

interface WholesaleOrderItem {
  productId: string;
  name: string;
  modelNumber: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  note: string;
}

interface WholesaleOrderCustomerProps {
  customer: WholesaleCustomer;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  "طلب جديد",
  "تم استلام الطلب",
  "تم ارسال الطلب",
  "تم تسليم الطلب",
  "فشل التسليم مرتجع",
  "تم الغاء الطلب",
  "معلق / نقص معلومات",
  "المتجر",
];

const PAYMENT_OPTIONS = ["عند الاستلام", "تحويل بنكي", "مختلطة"];

function createEmptyItem(): WholesaleOrderItem {
  return {
    productId: "",
    name: "",
    modelNumber: "",
    quantity: 1,
    price: 0,
    discount: 0,
    total: 0,
    note: "",
  };
}

function getEffectivePrice(price: number, discount: number) {
  return Math.max(0, Number(price || 0) - Number(discount || 0));
}

function getPhoneDefaultCountry(country: string | null | undefined) {
  return String(country || "سوريا") === "تركيا" ? "TR" : "SY";
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

function getProductAvailableStockByWarehouse(product: any, warehouseId: string) {
  if (!Array.isArray(product?.stocks)) return 0;
  return product.stocks
    .filter((stock: any) => String(stock?.warehouse?.id || "") === String(warehouseId || ""))
    .reduce((sum: number, stock: any) => sum + (Number(stock?.quantity) || 0), 0);
}

function getCurrencySymbol(location?: string) {
  return String(location || "").trim() === "تركيا" ? "₺" : "$";
}

function normalizePhoneList(values: (string | undefined)[]) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

export default function WholesaleOrderCustomer({ customer, isOpen, onClose, onSuccess }: WholesaleOrderCustomerProps) {
  const [products, setProducts] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [countryRows, setCountryRows] = React.useState<any[]>([]);
  const [cityRows, setCityRows] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [warehouseId, setWarehouseId] = React.useState("");
  const [items, setItems] = React.useState<WholesaleOrderItem[]>([createEmptyItem()]);
  const [searchQueries, setSearchQueries] = React.useState<Record<number, string>>({});
  const [showDropdown, setShowDropdown] = React.useState<Record<number, boolean>>({});

  const [receiverName, setReceiverName] = React.useState("");
  const [receiverPhone, setReceiverPhone] = React.useState<(string | undefined)[]>([""]);
  const [country, setCountry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [municipality, setMunicipality] = React.useState("");
  const [fullAddress, setFullAddress] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("عند الاستلام");
  const [status, setStatus] = React.useState("طلب جديد");
  const [deliveryNotes, setDeliveryNotes] = React.useState("");
  const [additionalNotes, setAdditionalNotes] = React.useState("");
  const [googleMapsLink, setGoogleMapsLink] = React.useState("");
  const [overallDiscount, setOverallDiscount] = React.useState(0);

  const selectedWarehouse = warehouses.find((warehouse) => String(warehouse.id) === warehouseId);
  const stockCountry = String(selectedWarehouse?.location || "").trim();
  const currencySymbol = getCurrencySymbol(stockCountry);

  const selectedCountryRow = countryRows.find((row) => row.name === country);
  const filteredCities = selectedCountryRow
    ? cityRows.filter((row) => Number(row.countryId) === Number(selectedCountryRow.id))
    : [];

  React.useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [productsResponse, warehousesResponse, countriesResponse, citiesResponse] = await Promise.all([
          getProductCatalog(),
          getWarehouse(),
          getCountries(),
          getCities(),
        ]);

        if (!isMounted) return;

        setProducts(Array.isArray(productsResponse) ? productsResponse : []);
        setWarehouses(Array.isArray(warehousesResponse) ? warehousesResponse : []);
        setCountryRows(Array.isArray(countriesResponse) ? countriesResponse : []);
        setCityRows(Array.isArray(citiesResponse) ? citiesResponse : []);
      } catch (error) {
        console.error("Error loading wholesale order data:", error);
        toast.error("تعذر تحميل بيانات المنتجات والمستودعات");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    setWarehouseId("");
    setItems([createEmptyItem()]);
    setSearchQueries({});
    setShowDropdown({});
    setReceiverName(customer.contactName || customer.name || "");
    setReceiverPhone(customer.phone.length > 0 ? [...customer.phone] : [""]);
    setCountry(String(customer.country || ""));
    setCity(String(customer.city || ""));
    setMunicipality(String(customer.area || ""));
    setFullAddress(String(customer.address || ""));
    setGoogleMapsLink(String(customer.googleMapsLink || ""));
    setAdditionalNotes(String(customer.notes || ""));
    setPaymentMethod("عند الاستلام");
    setStatus("طلب جديد");
    setDeliveryNotes("");
    setOverallDiscount(0);
  }, [isOpen, customer]);

  const addNewItem = () => {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  };

  const updateItem = (index: number, field: keyof WholesaleOrderItem, value: any) => {
    setItems((currentItems) => {
      const nextItems = [...currentItems];
      const currentItem = { ...nextItems[index] };

      if (field === "productId") {
        const isDuplicate = currentItems.some((item, itemIndex) => itemIndex !== index && String(item.productId) === String(value || ""));
        if (isDuplicate) {
          toast.error("هذا المنتج مضاف بالفعل داخل الطلب");
          return currentItems;
        }

        const product = products.find((currentProduct: any) => Number(currentProduct?.id) === Number(value || 0));
        const price = product ? resolveWholesaleUnitPrice(product, currentItem.quantity, warehouseId) : 0;
        currentItem.productId = String(value || "");
        currentItem.name = product?.name || "";
        currentItem.modelNumber = product?.modelNumber || "";
        currentItem.price = price;
        currentItem.discount = 0;
        setSearchQueries((current) => ({ ...current, [index]: currentItem.name }));
        setShowDropdown((current) => ({ ...current, [index]: false }));
      } else if (field === "quantity") {
        currentItem.quantity = Math.max(1, Number(value || 1));
        const product = products.find((currentProduct: any) => Number(currentProduct?.id) === Number(currentItem.productId || 0));
        currentItem.price = product ? resolveWholesaleUnitPrice(product, currentItem.quantity, warehouseId) : currentItem.price;
      } else if (field === "discount") {
        currentItem.discount = Math.max(0, Number(value || 0));
      } else if (field === "note") {
        currentItem.note = String(value || "");
      }

      currentItem.total = getEffectivePrice(currentItem.price, currentItem.discount) * currentItem.quantity;
      nextItems[index] = currentItem;
      return nextItems;
    });
  };

  const removeItem = (index: number) => {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return [createEmptyItem()];
      }
      const nextItems = currentItems.filter((_, itemIndex) => itemIndex !== index);

      const nextQueries: Record<number, string> = {};
      const nextDropdowns: Record<number, boolean> = {};
      nextItems.forEach((_, i) => {
        const oldIndex = i >= index ? i + 1 : i;
        if (searchQueries[oldIndex]) nextQueries[i] = searchQueries[oldIndex];
        if (showDropdown[oldIndex]) nextDropdowns[i] = showDropdown[oldIndex];
      });
      setSearchQueries(nextQueries);
      setShowDropdown(nextDropdowns);
      return nextItems;
    });
  };

  const handleWarehouseChange = (value: string) => {
    setWarehouseId(value);
    setItems([createEmptyItem()]);
    setSearchQueries({});
    setShowDropdown({});
  };

  const handleCountryChange = (value: string) => {
    setCountry(value);
    setCity("");
  };

  const subTotal = items.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = Math.max(0, subTotal - overallDiscount);

  const handleSubmit = async () => {
    if (!warehouseId) {
      toast.error("يرجى اختيار المستودع");
      return;
    }

    if (items.length === 0 || !items[0].productId) {
      toast.error("يرجى إضافة منتج واحد على الأقل");
      return;
    }

    if (!receiverName.trim()) {
      toast.error("يرجى تحديد اسم المستلم");
      return;
    }

    const phones = normalizePhoneList(receiverPhone);
    if (phones.length === 0 || phones.some((phone) => phone.length < 10)) {
      toast.error("يرجى إدخال رقم هاتف صحيح");
      return;
    }

    if (!country.trim() || !city.trim()) {
      toast.error("يرجى اختيار الدولة والمدينة");
      return;
    }

    if (!municipality.trim()) {
      toast.error("يرجى تحديد البلدية/المنطقة");
      return;
    }

    if (!fullAddress.trim()) {
      toast.error("يرجى كتابة عنوان التسليم");
      return;
    }

    const payload = {
      wholesaleCustomerId: customer.id,
      warehouseId,
      receiverName: receiverName.trim(),
      receiverPhone: phones,
      country,
      city,
      municipality,
      fullAddress,
      paymentMethod,
      status,
      overallDiscount,
      deliveryNotes,
      additionalNotes,
      googleMapsLink,
      manualCreatedAt: "",
    };

    const normalizedItems = items
      .filter((item) => String(item.productId || "").trim())
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity || 1),
        discount: Number(item.discount || 0),
      }));

    setIsSubmitting(true);
    const loadingToast = toast.loading("جاري إنشاء طلب الجملة...");

    try {
      const response = await createWholesaleOrder(payload, normalizedItems);
      if (!response.success) {
        toast.error(response.error || "تعذر إنشاء طلب الجملة");
        return;
      }

      toast.success("تم إنشاء طلب الجملة بنجاح");
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
      toast.dismiss(loadingToast);
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="إضافة طلب جملة"
      size="full"
      footer={
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-6 pt-4">
          <div className="flex gap-6 items-center">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-red-500 uppercase px-1">خصم إضافي (كلي)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={overallDiscount}
                  onChange={(event) => setOverallDiscount(Number(event.target.value || 0))}
                  className="w-32 bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 dark:border-red-900/20 outline-none font-bold text-red-600 text-center"
                  placeholder="0"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400">{currencySymbol}</span>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 px-8 py-4 rounded-3xl">
              <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">الإجمالي النهائي</p>
              <h3 className="text-3xl font-black font-sans text-blue-600 italic">
                {currencySymbol}{grandTotal.toLocaleString()}
              </h3>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading}
              className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={20} />
              حفظ الفاتورة
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-8 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              إلغاء
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* المنتجات والمستودع */}
        <div className="space-y-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 my-1">
              <label className="text-xs font-bold text-slate-500 mr-2">عميل الجملة</label>
              <input
                type="text"
                readOnly
                value={customer?.name || ""}
                className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-bold transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 mr-2">المستودع</label>
              <select
                value={warehouseId}
                onChange={(event) => handleWarehouseChange(event.target.value)}
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
          </div>

          {items.map((item, index) => {
            const product = products.find((currentProduct: any) => Number(currentProduct?.id) === Number(item.productId || 0));
            const tiers = Array.isArray(product?.wholesalePricingTiers) ? product.wholesalePricingTiers : [];
            return (
              <div key={index} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 items-center">
                  <div className="md:col-span-3 relative">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">المنتج</label>
                    <input
                      type="text"
                      value={searchQueries[index] || item.name || item.modelNumber}
                      placeholder="اكتب اسم المنتج..."
                      onFocus={() => setShowDropdown((current) => ({ ...current, [index]: true }))}
                      onChange={(event) => {
                        setSearchQueries((current) => ({ ...current, [index]: event.target.value }));
                        setShowDropdown((current) => ({ ...current, [index]: true }));
                      }}
                      className="w-full text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-900 p-3 rounded-xl border-none outline-none font-bold text-sm shadow-sm"
                    />
                    <AnimatePresence>
                      {showDropdown[index] && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute z-[210] w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto"
                        >
                          {products
                            .filter((currentProduct: any) => {
                              const currentStock = warehouseId ? getProductAvailableStockByWarehouse(currentProduct, warehouseId) : 0;
                              const isAvailable = currentStock > 0;
                              const matchesWarehouse = warehouseId
                                ? Array.isArray(currentProduct?.stocks) && currentProduct.stocks.some((stock: any) => String(stock?.warehouse?.id || "") === warehouseId)
                                : false;
                              const query = (searchQueries[index] || "").toLowerCase();
                              const matchesSearch =
                                String(currentProduct?.name || "").toLowerCase().includes(query) ||
                                String(currentProduct?.modelNumber || "").toLowerCase().includes(query);
                              return isAvailable && matchesSearch && matchesWarehouse;
                            })
                            .map((currentProduct: any) => {
                              const price = resolveWholesaleUnitPrice(currentProduct, item.quantity, warehouseId);
                              return (
                                <div
                                  key={currentProduct.id}
                                  onClick={() => updateItem(index, "productId", currentProduct.id.toString())}
                                  className="px-4 py-3 hover:bg-blue-50 text-slate-900 dark:text-slate-50 dark:hover:bg-blue-900/20 cursor-pointer text-sm font-bold border-b border-slate-50 dark:border-slate-700 last:border-0"
                                >
                                  <div className="flex justify-between items-center">
                                    <span>{currentProduct.name}</span>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">
                                      {currentProduct.modelNumber}
                                    </span>
                                  </div>
                                  <div className="text-blue-500 text-xs mt-1">{currencySymbol}{getEffectivePrice(price, 0)}</div>
                                </div>
                              );
                            })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">الكمية</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => updateItem(index, "quantity", parseInt(event.target.value) || 0)}
                      className="w-full text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-900 p-3 rounded-xl text-center font-bold outline-none text-sm shadow-sm"
                    />
                  </div>
                  <div className="md:col-span-1 text-center">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">السعر</label>
                    <div className="p-3 text-sm font-bold">{currencySymbol}{getEffectivePrice(item.price, 0)}</div>
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-red-400 mb-1">الخصم</label>
                    <input
                      type="number"
                      min={0}
                      value={item.discount}
                      onChange={(event) => updateItem(index, "discount", Number(event.target.value || 0))}
                      className="w-full bg-red-50 dark:bg-red-900/10 p-3 rounded-xl text-center font-bold text-red-600 outline-none text-sm border border-red-100 dark:border-red-900/20"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">ملاحظات المنتج</label>
                    <input
                      type="text"
                      value={item.note}
                      onChange={(event) => updateItem(index, "note", event.target.value)}
                      className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl outline-none text-xs shadow-sm"
                      placeholder="إضافة ملاحظة..."
                    />
                  </div>
                  <div className="md:col-span-1 text-center font-black text-blue-600 italic">
                    {currencySymbol}{item.total}
                  </div>
                  <div className="md:col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {tiers.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    شرائح الجملة: {tiers.map((tier: any) => {
                      const min = Number(tier?.minQuantity || 0);
                      const max = tier?.maxQuantity == null ? "+" : Number(tier.maxQuantity);
                      return `${min}-${max}: ${Number(tier?.price || 0)}`;
                    }).join(" | ")}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addNewItem}
            className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold text-xs hover:border-blue-500 hover:text-blue-500 transition-all"
          >
            + إضافة بند جديد
          </button>
        </div>

        {/* بيانات المستلم والعنوان */}
        <div className="space-y-8" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 mr-2">معلومات المستلم</label>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">اسم الشخص المستلم</label>
              <input
                type="text"
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                placeholder="اسم المستلم"
                className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">أرقام هواتف المستلم</label>
              {receiverPhone.map((phone, index) => (
                <div key={index} className="flex w-full items-start gap-2">
                  <PhoneInput
                    international
                    placeholder="Enter phone number"
                    value={phone}
                    withCountryCallingCode
                    defaultCountry={getPhoneDefaultCountry(country)}
                    className="w-full min-w-0 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    onChange={(value) => {
                      const newPhones = [...receiverPhone];
                      newPhones[index] = value;
                      setReceiverPhone(newPhones);
                    }}
                  />
                  {receiverPhone.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setReceiverPhone(receiverPhone.filter((_, i) => i !== index))}
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
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              >
                {PAYMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 mr-2">حالة الطلب</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">الدولة</label>
              <select
                value={country}
                onChange={(event) => handleCountryChange(event.target.value)}
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
                onChange={(event) => setCity(event.target.value)}
                disabled={!country}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold disabled:opacity-50 transition-all"
              >
                <option value="">اختر المدينة</option>
                {filteredCities.map((cityRow) => (
                  <option key={cityRow.id} value={cityRow.name}>{cityRow.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">البلدية</label>
              <input
                type="text"
                value={municipality}
                onChange={(event) => setMunicipality(event.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">عنوان التسليم التفصيلي</label>
              <input
                type="text"
                value={fullAddress}
                onChange={(event) => setFullAddress(event.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">رابط الخريطة</label>
              <input
                type="text"
                value={googleMapsLink}
                onChange={(event) => setGoogleMapsLink(event.target.value)}
                placeholder="رابط الخريطة"
                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 mr-2">ملاحظات التوصيل</label>
              <textarea
                rows={2}
                value={deliveryNotes}
                onChange={(event) => setDeliveryNotes(event.target.value)}
                placeholder="ملاحظات للمندوب..."
                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 mr-2">ملاحظات إضافية</label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={(event) => setAdditionalNotes(event.target.value)}
                placeholder="ملاحظات إضافية..."
                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  );
}
