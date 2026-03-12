import React from 'react';
import toast from 'react-hot-toast';
import { createOrder, updateOrder } from '@/server/order';

interface OrderFormItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  note: string;
  total: number;
  modelNumber: string;
}

interface OrderFormData {
  customerId: string;
  receiverName: string;
  receiverPhone: (string | undefined)[];
  country: string;
  city: string;
  municipality: string;
  fullAddress: string;
  paymentMethod: string;
  amount: string;
  overallDiscount: number;
  status: string;
  deliveryNotes: string;
  additionalNotes: string;
  googleMapsLink: string;
}

export const useOrderForm = (userId?: string) => {
  // بيانات الطلب
  const [items, setItems] = React.useState<OrderFormItem[]>([
    { productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }
  ]);

  // بيانات العميل والمبالغ
  const [customerId, setCustomerId] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("عند الاستلام");
  const [amount, setAmount] = React.useState("");

  // بيانات المستلم والعنوان
  const [receiverName, setReceiverName] = React.useState("");
  const [receiverPhone, setReceiverPhone] = React.useState<(string | undefined)[]>([""]); 
  const [country, setCountry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [municipality, setMunicipality] = React.useState("");
  const [fullAddress, setFullAddress] = React.useState("");

  // تفاصيل الشحن والملاحظات
  const [googleMapsLink, setGoogleMapsLink] = React.useState("");
  const [deliveryNotes, setDeliveryNotes] = React.useState("");
  const [additionalNotes, setAdditionalNotes] = React.useState("");

  // حالة الطلب والتعديل
  const [status, setStatus] = React.useState("طلب جديد");
  const [editId, setEditId] = React.useState<string | number | null>(null);
  const [overallDiscount, setOverallDiscount] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // بحث العميل
  const [customerSearchQuery, setCustomerSearchQuery] = React.useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);

  // حقول البحث والفلاتر
  const [searchQueries, setSearchQueries] = React.useState<Record<number, string>>({});
  const [showDropdown, setShowDropdown] = React.useState<Record<number, boolean>>({});

  // حساب الإجماليات
  const subTotal = items.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = subTotal - overallDiscount;
  const remainingAmount = Math.max(0, Number(grandTotal) - Number(amount || 0));

  // التحقق من صحة النموذج
  const validateForm = (): boolean => {
    if (!customerId) {
      toast.error("يرجى اختيار العميل");
      return false;
    }

    if (items.length === 0 || !items[0].productId) {
      toast.error("يرجى إضافة منتج واحد على الأقل");
      return false;
    }

    if (!receiverName || receiverName.trim() === "") {
      toast.error("يرجى تحديد اسم المستلم");
      return false;
    }

    if (receiverPhone.length === 0 || receiverPhone.some(phone => !phone || String(phone).trim().length < 10)) {
      toast.error("يرجى إدخال رقم هاتف صحيح");
      return false;
    }

    if (!country || !String(country).trim() || !city || !String(city).trim()) {
      toast.error("يرجى اختيار الدولة والمدينة");
      return false;
    }

    if (paymentMethod === "مختلطة") {
      const amountValue = Number(amount);

      if (!amount) {
        toast.error("يرجى إدخال قيمة الحوالة");
        return false;
      }

      if (amountValue < 0) {
        toast.error("قيمة الحوالة يجب أن تكون رقمًا موجبًا");
        return false;
      }

      if (amountValue > Number(grandTotal)) {
        toast.error("قيمة الحوالة لا يمكن أن تتجاوز الإجمالي النهائي");
        return false;
      }
    }

    return true;
  };

  // إرسال النموذج
  const handleSubmit = async (): Promise<boolean> => {
    if (!validateForm()) return false;

    setIsSubmitting(true);
    const loadingMessage = editId ? "جاري تعديل الطلب..." : "جاري حفظ الطلب الجديد...";
    const loadingToast = toast.loading(loadingMessage);

    const orderData = {
      customerId,
      status,
      receiverName,
      receiverPhone,
      country,
      city,
      municipality,
      fullAddress,
      googleMapsLink,
      deliveryNotes,
      paymentMethod,
      amount: paymentMethod === "مختلطة" ? amount : "",
      amountBank: paymentMethod === "مختلطة" ? String(remainingAmount) : "",
      additionalNotes,
      grandTotal: Number(grandTotal),
      overallDiscount: Number(overallDiscount),
      subTotal: Number(subTotal)
    };

    try {
      let res;
      if (editId) {
        res = await updateOrder(orderData, editId, items);
      } else {
        res = await createOrder(orderData, items, userId);
      }

      if (res.success) {
        toast.success(editId ? "تم تحديث الطلب بنجاح" : "تم حفظ الطلب بنجاح");
        setIsSubmitting(false);
        toast.dismiss(loadingToast);
        return true;
      } else {
        toast.error((res as any)?.message || "فشل في معالجة الطلب");
        setIsSubmitting(false);
        toast.dismiss(loadingToast);
        return false;
      }
    } catch (error) {
      console.error("Submit Error:", error);
      toast.error("حدث خطأ غير متوقع في النظام");
      setIsSubmitting(false);
      toast.dismiss(loadingToast);
      return false;
    }
  };

  // إعادة تعيين النموذج
  const resetForm = () => {
    setStatus("طلب جديد");
    setEditId(null);
    setItems([{ productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }]);
    setSearchQueries({});
    setShowDropdown({});
    setOverallDiscount(0);

    setCustomerId("");
    setCustomerSearchQuery("");
    setShowCustomerDropdown(false);
    setPaymentMethod("عند الاستلام");
    setAmount("");

    setReceiverName("");
    setReceiverPhone([""]);
    setCountry("");
    setCity("");
    setMunicipality("");
    setFullAddress("");

    setGoogleMapsLink("");
    setDeliveryNotes("");
    setAdditionalNotes("");
  };

  // تحميل بيانات الطلب للتعديل
  const loadOrderForEdit = (data: any) => {
    const normalizedItems = (Array.isArray(data?.items) ? data.items : []).map((item: any) => {
      const price = Number(item?.price ?? item?.product?.stocks?.[0]?.price ?? 0);
      const quantity = Number(item?.quantity ?? 1);
      const discount = Number(item?.discount ?? 0);
      const productId = String(item?.productId ?? item?.product?.id ?? "");
      return {
        productId,
        name: item?.product?.name || item?.name || "",
        modelNumber: item?.product?.modelNumber || item?.modelNumber || "",
        price,
        quantity,
        discount,
        note: item?.note || "",
        total: Math.max(0, Number(price || 0) - Number(discount || 0)) * quantity,
      };
    });

    const nextItems = normalizedItems.length > 0
      ? normalizedItems
      : [{ productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }];

    const nextSearchQueries = nextItems.reduce((acc: Record<number, string>, item: any, index: number) => {
      acc[index] = item.name || item.modelNumber || "";
      return acc;
    }, {});

    setEditId(data?.id ?? null);
    setItems(nextItems);
    setSearchQueries(nextSearchQueries);
    setShowDropdown({});

    setCustomerId(String(data?.customerId || ""));
    setCustomerSearchQuery(data?.customer?.name || "");
    setStatus(data?.status || "طلب جديد");
    setPaymentMethod(data?.paymentMethod || "عند الاستلام");
    setAmount(String(data?.amount ?? ""));

    setReceiverName(data?.receiverName || "");
    setReceiverPhone(Array.isArray(data?.receiverPhone) ? data.receiverPhone : [data?.receiverPhone || ""]);
    setCountry(data?.country || "");
    setCity(data?.city || "");
    setMunicipality(data?.municipality || "");
    setFullAddress(data?.fullAddress || "");

    setGoogleMapsLink(data?.googleMapsLink || "");
    setDeliveryNotes(data?.deliveryNotes || "");
    setAdditionalNotes(data?.additionalNotes || "");
    setOverallDiscount(Number(data?.discount ?? 0));
  };

  return {
    // الحالات
    items,
    setItems,
    customerId,
    setCustomerId,
    receiverName,
    setReceiverName,
    receiverPhone,
    setReceiverPhone,
    country,
    setCountry,
    city,
    setCity,
    municipality,
    setMunicipality,
    fullAddress,
    setFullAddress,
    paymentMethod,
    setPaymentMethod,
    amount,
    setAmount,
    status,
    setStatus,
    editId,
    setEditId,
    overallDiscount,
    setOverallDiscount,
    deliveryNotes,
    setDeliveryNotes,
    additionalNotes,
    setAdditionalNotes,
    googleMapsLink,
    setGoogleMapsLink,
    isSubmitting,
    customerSearchQuery,
    setCustomerSearchQuery,
    showCustomerDropdown,
    setShowCustomerDropdown,
    searchQueries,
    setSearchQueries,
    showDropdown,
    setShowDropdown,

    // الحسابات
    subTotal,
    grandTotal,
    remainingAmount,

    // الدوال
    handleSubmit,
    resetForm,
    loadOrderForEdit,
    validateForm,
  };
};
