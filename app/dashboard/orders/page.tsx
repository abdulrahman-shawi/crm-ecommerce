"use client"
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { formatPhoneForDisplay, hasPermission, isAdmin } from '@/lib/utils';
import { createOrder, deleteOrder, getOrdersByUser, updateOrder, updateOrderShippingFromTable, updateStaus } from '@/server/order';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart2, Download, Eye, Pencil, Plus, Save, Search, Trash, Trash2, Upload, X } from 'lucide-react';
import * as React from 'react';
import toast from 'react-hot-toast';
import { TableAction } from '../../../components/shared/DataTable';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PhoneInput from 'react-phone-number-input';
import { useOrderStore } from '@/store/customer';
import OrderCustomer from '@/components/pages/customers/orderCustomer';
import OrderCustomerEdit from '@/components/pages/customers/orderCustomerEdit';
import { StatusCards } from '@/orders/StatusCards';
import { SearchAndFilter } from '@/orders/SearchAndFilter';
import { ShippingModal } from '@/orders/ShippingModal';
import { OrderTable } from '@/orders/OrderTable';
import { useOrderFilters } from '@/orders/useOrderFilters';
import { useOrderData } from '@/orders/useOrderData';
import ViewOrder from '@/orders/ViewOrder';
import ViewOrderCustomer from '@/orders/ViewOrderCustomer';
import { shareOrderPdfToCustomerWhatsApp } from '@/orders/orderPdf';
import {
    getCellValueByAliases,
    parseItemsFromSummary,
    normalizeText,
    parseImportedDateValue,
    getEffectivePrice,
    openWhatsAppByPhone,
    getOrderCurrencySymbol,
    getOrderShippingName,
    getOrderShippingPrice,
    getOrderShippingCommissions,
    getOrderTotalShippingExpenses,
    getOrderDeliveryMethod,
    getOrderDisplayDate,
} from '@/orders/orderHelpers';
interface IOrderLayoutProps {
}

interface OrderCustomerProps {
  items: any[];
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  customers: any[];
  customerId: any;
  setCustomerId: React.Dispatch<React.SetStateAction<any>>;
  products: any[];
  isOpenOrder: boolean;
  setisOpenOrder: React.Dispatch<React.SetStateAction<boolean>>;
  editId: any;
  setEditId: React.Dispatch<React.SetStateAction<any>>;
  getData: () => Promise<void>;
  
  // الخصائص المفقودة التي تسبب الخطأ:
  receiverName: string;
  setReceiverName: React.Dispatch<React.SetStateAction<string>>;
  receiverPhone: any[];
  setReceiverPhone: React.Dispatch<React.SetStateAction<any[]>>;
  country: string;
  setCountry: React.Dispatch<React.SetStateAction<string>>;
  city: string;
  setCity: React.Dispatch<React.SetStateAction<string>>;
  municipality: string;
  setMunicipality: React.Dispatch<React.SetStateAction<string>>;
  fullAddress: string;
  setFullAddress: React.Dispatch<React.SetStateAction<string>>;
  paymentMethod: string;
  setPaymentMethod: React.Dispatch<React.SetStateAction<string>>;
  amount: any;
  setAmount: React.Dispatch<React.SetStateAction<any>>;
  overallDiscount: number;
  setOverallDiscount: React.Dispatch<React.SetStateAction<number>>;
  status: string;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  deliveryNotes: string;
  setDeliveryNotes: React.Dispatch<React.SetStateAction<string>>;
  additionalNotes: string;
  setAdditionalNotes: React.Dispatch<React.SetStateAction<string>>;
  googleMapsLink: string;
  setGoogleMapsLink: React.Dispatch<React.SetStateAction<string>>;
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
}

const OrderLayout: React.FunctionComponent<IOrderLayoutProps> = (props) => {
    const { user } = useAuth();
    const {
        products,
        customers,
        orders,
        shippingCompanies,
        refreshOrders: Order,
        refreshCustomers: getAlluser,
        refreshShippingCompanies: loadShippingCompanies,
    } = useOrderData(user);
    const [order, setorder] = React.useState<any>({})
    const [isOpen, setIsOpen] = React.useState(false);
    const [isOpenorder, setisOpenorder] = React.useState(false);
    const [isOpenordercustomer, setisOpenordercustomer] = React.useState(false);
    const [status, setStatus] = React.useState("طلب جديد");
    const [editId, setEditId] = React.useState<string | number | null>(null);
    const [items, setItems] = React.useState([
        { productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }
    ]);
    
    const [searchQueries, setSearchQueries] = React.useState<Record<number, string>>({});
    const [showDropdown, setShowDropdown] = React.useState<Record<number, boolean>>({});
    const [overallDiscount, setOverallDiscount] = React.useState(0);

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

    // تفاصيل الشحن
    const [googleMapsLink, setGoogleMapsLink] = React.useState("");

    const [customerSearchQuery, setCustomerSearchQuery] = React.useState("");
    const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
    const [deliveryNotes, setDeliveryNotes] = React.useState("");
    const [additionalNotes, setAdditionalNotes] = React.useState("");
    const [isShippingModalOpen, setIsShippingModalOpen] = React.useState(false);
    const [shippingModalSaving, setShippingModalSaving] = React.useState(false);
    const [shippingTargetOrder, setShippingTargetOrder] = React.useState<any>(null);
    const [shippingForm, setShippingForm] = React.useState({
        shippingCompanyName: "",
        shippingPrice: "0",
        moneyTransferCommission: "0",
        otherCommissions: "0",
    });
    const importInputRef = React.useRef<HTMLInputElement | null>(null);
    const subTotal = items.reduce((sum, i) => sum + i.total, 0);
    const grandTotal = subTotal - overallDiscount;
    const remainingAmount = Math.max(0, Number(grandTotal) - Number(amount || 0));

    const updateItem = (index: number, field: string, value: any, products: any[]) => {
        const newItems = [...items];
        const item = newItems[index];

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

        item.total = getEffectivePrice(item.price, item.discount) * item.quantity;
        setItems(newItems);
    };

    const canManageOrderShippingUi = React.useMemo(() => {
        if (!user) return false;
        if (isAdmin(user)) return true;
        return String(user?.permission?.roleName || "").trim().includes("مستودع");
    }, [user]);

    const shippingCompanyOptions = React.useMemo(() => {
        const normalized = shippingCompanies
            .map((company: any) => String(company?.name || "").trim())
            .filter(Boolean);

        const currentName = String(shippingForm.shippingCompanyName || "").trim();
        if (currentName && !normalized.includes(currentName)) {
            return [currentName, ...normalized];
        }

        return normalized;
    }, [shippingCompanies, shippingForm.shippingCompanyName]);

    const addNewItem = () => {
        setItems([...items, { productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }]);
    };



    const exportAllOrdersToExcel = (orders: any[]) => {
        // تجهيز البيانات مع شمول كل حقول الموديل
        const worksheetData = orders.map((order) => {
            // تجميع أسماء المنتجات وكمياتها في نص واحد
            const itemsSummary = order.items?.map((i: any) =>
                `${i.product?.name || 'منتج'} (${i.quantity})`
            ).join(" - ");
            const itemsStructured = JSON.stringify(
                (Array.isArray(order.items) ? order.items : []).map((i: any) => ({
                    productId: i.productId,
                    name: i.product?.name || '',
                    quantity: Number(i.quantity || 0),
                    price: Number(i.price || 0),
                    discount: Number(i.discount || 0),
                }))
            );

            return {
                "رقم المرجع": order.orderNumber,
                "تاريخ الإنشاء": new Date(getOrderDisplayDate(order)).toLocaleString('ar-EG'),
                "تاريخ الإنشاء ISO": new Date(getOrderDisplayDate(order)).toISOString(),
                "حالة الطلب": order.status,
                "اسم العميل": order.customer?.name,
                // هاتف العميل على شكل أرييه بعد تقسيمه، أو نص بديل إذا لم يكن موجودًا
                "هاتف العميل": order.customer?.phone ? (Array.isArray(order.customer.phone) ? order.customer.phone.join(' - ') : order.customer.phone) : "لم يسجل",
                "الجنس": order.customer?.gender || "غير محدد",
                "الفئة العمرية": order.customer?.age || "غير محدد",
                "المبلغ الإجمالي": order.totalAmount,
                "الخصم": order.discount,
                "المبلغ النهائي": order.finalAmount,
                "طريقة الدفع": order.paymentMethod,
                "المنتجات المشتراة": itemsSummary,
                "اسم المستلم": order.receiverName || "نفس العميل",
                "هاتف المستلم": order.receiverPhone ? (Array.isArray(order.receiverPhone) ? order.receiverPhone.join(' - ') : order.receiverPhone) : "لم يسجل",
                "الدولة": order.country,
                "المدينة": order.city,
                "البلدية": order.municipality,
                "العنوان الكامل": order.fullAddress,
                "بلد المخزون": order?.warehouse?.location || order?.country || "",
                "رابط الخريطة": order.googleMapsLink,
                "طريقة التوصيل": getOrderDeliveryMethod(order),
                "شركة الشحن": getOrderShippingName(order),
                "سعر الشحن": getOrderShippingPrice(order),
                "عمولة تحويل الأموال": Number(order.moneyTransferCommission || 0),
                "عمولات أخرى": Number(order.otherCommissions || 0),
                "إجمالي مصاريف الشحن": getOrderTotalShippingExpenses(order),
                "المجموع الكلي مع الشحن": Number(order.finalAmount || 0) + getOrderTotalShippingExpenses(order),
                "المنتجات (JSON)": itemsStructured,
                "كود التتبع": order.trackingCode,
                "ملاحظات التوصيل": order.deliveryNotes,
                "بواسطة الموظف": order.user?.name || "Admin",
            };
        });

        // إنشاء ورقة العمل
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "كافة الطلبات");

        // ضبط اتجاه الصفحة للعربية وضبط عرض الأعمدة تلقائياً
        worksheet['!dir'] = "rtl";

        // تصدير الملف
        XLSX.writeFile(workbook, `Skynova_Full_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const allowedExtensions = ["xlsx", "xls", "csv"];
        const extension = String(file.name.split(".").pop() || "").toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            toast.error("صيغة الملف غير مدعومة. استخدم xlsx أو xls أو csv");
            event.target.value = "";
            return;
        }

        if (!user?.id) {
            toast.error("يجب تسجيل الدخول أولاً");
            event.target.value = "";
            return;
        }

        const loading = toast.loading("جارٍ استيراد الملف...");
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const firstSheetName = workbook.SheetNames?.[0];

            if (!firstSheetName) {
                toast.error("تعذر قراءة الملف: لا توجد أوراق بيانات");
                return;
            }

            const sheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];

            if (!rows.length) {
                toast.error("فشل الاستيراد: الملف فارغ أو لا يحتوي بيانات قابلة للقراءة");
                return;
            }

            let successCount = 0;
            let failedCount = 0;
            const failedReasons: string[] = [];

            for (let index = 0; index < rows.length; index += 1) {
                const row = rows[index] || {};
                const rowNumber = index + 2;

                const customerName = String(getCellValueByAliases(row, ["اسم العميل", "العميل", "customer", "customerName"]) || "").trim();
                const statusValue = String(getCellValueByAliases(row, ["حالة الطلب", "status"]) || "طلب جديد").trim() || "طلب جديد";
                const paymentMethodValue = String(getCellValueByAliases(row, ["طريقة الدفع", "paymentMethod"]) || "عند الاستلام").trim() || "عند الاستلام";
                const manualCreatedAtValue = parseImportedDateValue(
                    getCellValueByAliases(row, ["تاريخ الإنشاء ISO", "تاريخ الإنشاء", "manualCreatedAt", "createdAt"])
                );

                const countryValue = String(getCellValueByAliases(row, ["الدولة", "country"]) || "").trim();
                const stockCountryValue = String(getCellValueByAliases(row, ["بلد المخزون", "stockCountry"]) || countryValue).trim();
                const cityValue = String(getCellValueByAliases(row, ["المدينة", "city"]) || "").trim();
                const municipalityValue = String(getCellValueByAliases(row, ["البلدية", "municipality"]) || "").trim();
                const fullAddressValue = String(getCellValueByAliases(row, ["العنوان الكامل", "address", "fullAddress"]) || "").trim();
                const receiverNameValue = String(getCellValueByAliases(row, ["اسم المستلم", "receiverName"]) || customerName).trim();
                const receiverPhoneRaw = String(getCellValueByAliases(row, ["هاتف المستلم", "receiverPhone", "phone"]) || "").trim();
                const receiverPhoneValue = receiverPhoneRaw
                    ? receiverPhoneRaw.split(/[-,،]/).map((p) => p.trim()).filter(Boolean)
                    : [];

                const deliveryNotesValue = String(getCellValueByAliases(row, ["ملاحظات التوصيل", "deliveryNotes"]) || "").trim();
                const additionalNotesValue = String(getCellValueByAliases(row, ["ملاحظات إضافية", "additionalNotes"]) || "").trim();
                const googleMapsLinkValue = String(getCellValueByAliases(row, ["رابط الخريطة", "googleMapsLink"]) || "").trim();
                const shippingNameValue = String(getCellValueByAliases(row, ["شركة الشحن", "shipping"]) || "").trim();
                const overallDiscountValue = Number(getCellValueByAliases(row, ["الخصم", "discount"]) || 0);

                if (!customerName) {
                    failedCount += 1;
                    failedReasons.push(`السطر ${rowNumber}: اسم العميل مفقود`);
                    continue;
                }

                if (!stockCountryValue) {
                    failedCount += 1;
                    failedReasons.push(`السطر ${rowNumber}: بلد المخزون مفقود`);
                    continue;
                }

                const matchedCustomer = customers.find((customer: any) => normalizeText(customer?.name) === normalizeText(customerName));
                if (!matchedCustomer?.id) {
                    failedCount += 1;
                    failedReasons.push(`السطر ${rowNumber}: العميل غير موجود بالنظام (${customerName})`);
                    continue;
                }

                const structuredItemsRaw = String(getCellValueByAliases(row, ["المنتجات (JSON)", "itemsJson", "items"]) || "").trim();
                let parsedItemsFromRow: Array<{ name: string; quantity: number; productId?: number; price?: number; discount?: number }> = [];

                if (structuredItemsRaw) {
                    try {
                        const parsed = JSON.parse(structuredItemsRaw);
                        if (Array.isArray(parsed)) {
                            parsedItemsFromRow = parsed
                                .map((item: any) => ({
                                    name: String(item?.name || "").trim(),
                                    quantity: Number(item?.quantity || 0),
                                    productId: item?.productId ? Number(item.productId) : undefined,
                                    price: item?.price !== undefined ? Number(item.price) : undefined,
                                    discount: item?.discount !== undefined ? Number(item.discount) : undefined,
                                }))
                                .filter((item) => item.quantity > 0 && (item.name || item.productId));
                        }
                    } catch {
                        parsedItemsFromRow = [];
                    }
                }

                if (!parsedItemsFromRow.length) {
                    const itemsSummary = String(getCellValueByAliases(row, ["المنتجات المشتراة", "itemsSummary"]) || "").trim();
                    parsedItemsFromRow = parseItemsFromSummary(itemsSummary);
                }

                if (!parsedItemsFromRow.length) {
                    failedCount += 1;
                    failedReasons.push(`السطر ${rowNumber}: لا توجد منتجات صالحة للاستيراد`);
                    continue;
                }

                const orderItems: any[] = [];
                let itemResolveFailed = false;

                for (const importedItem of parsedItemsFromRow) {
                    const resolvedProduct = importedItem.productId
                        ? products.find((product: any) => Number(product?.id) === Number(importedItem.productId))
                        : products.find((product: any) => normalizeText(product?.name) === normalizeText(importedItem.name));

                    if (!resolvedProduct?.id) {
                        itemResolveFailed = true;
                        failedReasons.push(`السطر ${rowNumber}: المنتج غير موجود (${importedItem.name || importedItem.productId})`);
                        break;
                    }

                    const countryStock = Array.isArray(resolvedProduct?.stocks)
                        ? resolvedProduct.stocks.find((stock: any) => normalizeText(stock?.warehouse?.location) === normalizeText(stockCountryValue))
                        : null;
                    const fallbackStock = Array.isArray(resolvedProduct?.stocks) ? resolvedProduct.stocks[0] : null;
                    const effectiveStock = countryStock || fallbackStock;

                    const basePrice = importedItem.price !== undefined && !Number.isNaN(importedItem.price)
                        ? Number(importedItem.price)
                        : Number(effectiveStock?.price || 0);
                    const baseDiscount = importedItem.discount !== undefined && !Number.isNaN(importedItem.discount)
                        ? Number(importedItem.discount)
                        : Number(effectiveStock?.discount || 0);

                    orderItems.push({
                        productId: String(resolvedProduct.id),
                        quantity: Number(importedItem.quantity || 1),
                        price: basePrice,
                        discount: baseDiscount,
                    });
                }

                if (itemResolveFailed || !orderItems.length) {
                    failedCount += 1;
                    continue;
                }

                const subTotal = orderItems.reduce((sum, item) => {
                    const effectivePrice = Math.max(0, Number(item.price || 0) - Number(item.discount || 0));
                    return sum + (effectivePrice * Number(item.quantity || 0));
                }, 0);
                const overallDiscount = Number.isNaN(overallDiscountValue) ? 0 : Number(overallDiscountValue);
                const grandTotal = Math.max(0, subTotal - overallDiscount);

                const shippingMatch = shippingNameValue
                    ? shippingCompanies.find((shipping: any) => normalizeText(shipping?.name) === normalizeText(shippingNameValue))
                    : null;

                const orderPayload = {
                    customerId: matchedCustomer.id,
                    status: statusValue,
                    receiverName: receiverNameValue || customerName,
                    receiverPhone: receiverPhoneValue,
                    country: countryValue,
                    city: cityValue,
                    municipality: municipalityValue,
                    fullAddress: fullAddressValue,
                    googleMapsLink: googleMapsLinkValue,
                    deliveryNotes: deliveryNotesValue,
                    paymentMethod: paymentMethodValue,
                    amount: "",
                    amountBank: "",
                    additionalNotes: additionalNotesValue,
                    grandTotal,
                    overallDiscount,
                    subTotal,
                    stockCountry: stockCountryValue,
                    shippingId: shippingMatch?.id || undefined,
                    manualCreatedAt: manualCreatedAtValue,
                };

                const created = await createOrder(orderPayload, orderItems, user.id);
                if (created.success) {
                    successCount += 1;
                } else {
                    failedCount += 1;
                    failedReasons.push(`السطر ${rowNumber}: ${created.error || "فشل إنشاء الطلب"}`);
                }
            }

            if (successCount > 0) {
                await Order();
                toast.success(`تم استيراد ${successCount} طلب بنجاح`);
            }

            if (failedCount > 0) {
                toast.error(`تعذر استيراد ${failedCount} طلب`);
                failedReasons.slice(0, 4).forEach((reason) => toast.error(reason));
            }

            if (successCount === 0 && failedCount === 0) {
                toast.error("لم يتم استيراد أي طلب من الملف");
            }
        } catch (error) {
            toast.error("فشل الاستيراد: تعذر قراءة الملف");
        } finally {
            toast.dismiss(loading);
            event.target.value = "";
        }
    };

    const openShippingModal = (orderRow: any) => {
        setShippingTargetOrder(orderRow);
        setShippingForm({
            shippingCompanyName: String(orderRow?.shipping?.name || ""),
            shippingPrice: String(Number((orderRow?.shippingPrice ?? orderRow?.shipping?.price) || 0)),
            moneyTransferCommission: String(Number(orderRow?.moneyTransferCommission || 0)),
            otherCommissions: String(Number(orderRow?.otherCommissions || 0)),
        });
        setIsShippingModalOpen(true);
    };

    const handleSaveShippingModal = async () => {
        const orderId = Number(shippingTargetOrder?.id || 0);
        if (!orderId) {
            toast.error("معرف الطلب غير صالح");
            return;
        }

        const shippingCompanyName = String(shippingForm.shippingCompanyName || "").trim();
        const shippingPrice = Number(shippingForm.shippingPrice || 0);
        const moneyTransferCommission = Number(shippingForm.moneyTransferCommission || 0);
        const otherCommissions = Number(shippingForm.otherCommissions || 0);

        if (!shippingCompanyName) {
            toast.error("يرجى إدخال اسم شركة الشحن");
            return;
        }

        if (Number.isNaN(shippingPrice) || shippingPrice < 0) {
            toast.error("سعر الشحنة غير صالح");
            return;
        }

        if (Number.isNaN(moneyTransferCommission) || moneyTransferCommission < 0) {
            toast.error("عمولة تحويل الأموال غير صالحة");
            return;
        }

        if (Number.isNaN(otherCommissions) || otherCommissions < 0) {
            toast.error("العمولات الأخرى غير صالحة");
            return;
        }

        setShippingModalSaving(true);
        const loadingToast = toast.loading("جاري حفظ بيانات الشحن والعمولات...");

        try {
            const result = await updateOrderShippingFromTable(
                orderId,
                shippingCompanyName,
                shippingPrice,
                moneyTransferCommission,
                otherCommissions,
            );

            if (result.success) {
                toast.success("تم حفظ بيانات الشحن والعمولات");
                setIsShippingModalOpen(false);
                setShippingTargetOrder(null);
                await Order();
            } else {
                toast.error(result.error || "تعذر حفظ بيانات الشحن والعمولات");
            }
        } catch {
            toast.error("حدث خطأ أثناء حفظ بيانات الشحن والعمولات");
        } finally {
            setShippingModalSaving(false);
            toast.dismiss(loadingToast);
        }
    };

    const {
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
        visibleOrders,
        statusCounts,
        statusOptions,
        PAGE_SIZE,
    } = useOrderFilters(orders, user);

    // 1. تأكد من وجود حالة للتحميل في المكون الخاص بك
    // const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const handleSubmit = async () => {
        // التحقق الأولي
        if (!customerId) {
            toast.error("يرجى اختيار العميل");
            return;
        }

        if (items.length === 0 || !items[0].productId) {
            toast.error("يرجى إضافة منتج واحد على الأقل");
            return;
        }

        if (!receiverName || receiverName.trim() === "") {
            toast.error("يرجى تحديد اسم المستلم");
            return;
        }

        if (receiverPhone.length === 0 || receiverPhone.some(phone => !phone || String(phone).trim().length < 10)) {
            toast.error("يرجى إدخال رقم هاتف صحيح");
            return;
        }

        if (!country || !String(country).trim() || !city || !String(city).trim()) {
            toast.error("يرجى اختيار الدولة والمدينة");
            return;
        }

        if (paymentMethod === "مختلطة") {
            const amountValue = Number(amount);

            if (!amount) {
                toast.error("يرجى إدخال قيمة الحوالة");
                return;
            }

            if (amountValue < 0) {
                toast.error("قيمة الحوالة يجب أن تكون رقمًا موجبًا");
                return;
            }

            if (amountValue > Number(grandTotal)) {
                toast.error("قيمة الحوالة لا يمكن أن تتجاوز الإجمالي النهائي");
                return;
            }
        }

        // تفعيل حالة التحميل لمنع النقرات المتكررة (تعالج خطأ P2028)
        setIsSubmitting(true);

        // تصحيح رسالة الـ Toast
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
                // حالة التعديل
                res = await updateOrder(orderData, editId, items);
            } else {
                // حالة إنشاء طلب جديد
                res = await createOrder(orderData, items, user?.id);
            }

            if (res.success) {
                toast.success(editId ? "تم تحديث الطلب بنجاح" : "تم حفظ الطلب بنجاح");

                // تحديث قائمة الطلبات في الواجهة
                if (typeof Order === 'function') Order();

                // إغلاق المودال
                setIsOpen(false);

                // تنظيف الحقول (اختياري حسب حاجتك)
                // resetForm(); 
            } else {
                // عرض الخطأ القادم من السيرفر (مثل كمية غير كافية أو فشل Transaction)
                toast.error(res.success || "فشل في معالجة الطلب");
            }
        } catch (error) {
            console.error("Submit Error:", error);
            toast.error("حدث خطأ غير متوقع في النظام");
        } finally {
            // إنهاء حالة التحميل وإخفاء الـ Toast
            setIsSubmitting(false);
            toast.dismiss(loadingToast);
        }
    };
    const resetForm = () => {
        // إغلاق المودال أولاً
        setIsOpen(false);

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
        setAmount("");

        // إعادة بيانات المستلم والعنوان
        setReceiverName("");
        setReceiverPhone([""]);
        setCountry("");
        setCity("");
        setMunicipality("");
        setFullAddress("");

        // إعادة تفاصيل الشحن والملاحظات
        setGoogleMapsLink("");
        setDeliveryNotes("");
        setAdditionalNotes("");
    };

    const [ordercustomer, setordercustomer] = React.useState<any[]>([]); // مصفوفة للطلبات

    const showordercustomer = async (customerId: any) => {
        const res = await getOrdersByUser(customerId);
        if (res.success) {
            // التصحيح: خزن مصفوفة الطلبات القادمة من res وليس الـ id
            setordercustomer(res.data);
            console.log(ordercustomer)
            setisOpenordercustomer(true);
        }
    };

    const handleEditOrder = (data: any) => {
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
                total: getEffectivePrice(price, discount) * quantity,
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
        const receiverPhoneValues = Array.isArray(data?.receiverPhone)
            ? (data.receiverPhone.length ? data.receiverPhone : [""])
            : [data?.receiverPhone || ""];
        setReceiverPhone(receiverPhoneValues);

        setCountry(data?.country || "");
        setCity(data?.city || "");
        setMunicipality(data?.municipality || "");
        setFullAddress(data?.fullAddress || "");
        setGoogleMapsLink(data?.googleMapsLink || "");
        setDeliveryNotes(data?.deliveryNotes || "");
        setAdditionalNotes(data?.additionalNotes || "");
        setOverallDiscount(Number(data?.discount || 0));

        setisOpenordercustomer(true);
    };

    const tableActions: any[] = [
        (user) && {
            label: "عرض تقارير الطلب",
            icon: <BarChart2 size={14} />,
            onClick: (data: any) => {
                console.log("فتح تقارير الطلب رقم:", data.orderNumber);
                // منطق فتح التقارير هنا
                setorder(data);
                console.log(data)
                // فتح مودال الفاتورة
                setisOpenorder(true);
            }
        },
        canManageOrderShippingUi && {
            label: "تعديل",
            icon: <Pencil size={14} />,
            onClick: (data: any) => {
                setEditId(data?.id ?? null);
                setorder(data);
                setIsOpen(true);
            }
        },
        canManageOrderShippingUi && {
            label: "بيانات الشحن",
            icon: <Save size={14} />,
            onClick: (data: any) => openShippingModal(data)
        },
        (user) && {
            label: "مشاركة PDF",
            icon: <Download size={14} />,
            onClick: async (data: any) => {
                await shareOrderPdfToCustomerWhatsApp(data);
            }
        },
        (user && hasPermission(user, "deleteOrders")) && {
            label: "حذف",
            icon: <Trash size={14} />,
            variant: "danger",
            onClick: async (data: any) => {
                const confirm = window.confirm(`هل أنت متأكد من حذف الطلب رقم #${data.orderNumber}؟ سيتم إعادة الكميات للمخزون.`);
                if (confirm) {
                    const loading = toast.loading("جاري حذف الطلب وتحديث المخزون...");
                    try {
                        const res = await deleteOrder(data.id);
                        if (res.success) {
                            toast.success("تم حذف الطلب بنجاح");
                            if (typeof Order === 'function') Order(); // تحديث القائمة
                        } else {
                            toast.error("خطأ");
                        }
                    } catch (err) {
                        toast.error("حدث خطأ غير متوقع");
                    } finally {
                        toast.dismiss(loading);
                    }
                }
            }
        }

    ];
    const updatestatuschange = async (status: any, id: any) => {
        const loading = toast.loading("جاري تحديث حالة الطلب")
        try {
            const res = await updateStaus(status, id)
            if (res.success) {
                Order()
                toast.success("تم تحديث الحالة")
            } else {
                toast.error("فشل تحديث الحالة")
            }
        } catch (error) {
            toast.error("فشل تحديث الحالة")
        } finally {
            toast.dismiss(loading)
        }
    }
    return (
        <div className="">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة الطلبات</h1>
                <div className="flex items-center gap-2">
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportFile}
                        className="hidden"
                    />
                    <button
                        onClick={handleImportClick}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                        title="استيراد ملف"
                    >
                        <Upload size={20} />
                    </button>
                    <button
                        onClick={() => exportAllOrdersToExcel(visibleOrders)}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
                        title="تصدير الطلبات"
                    >
                        <Download size={20} />
                    </button>
                </div>
            </div>
            <SearchAndFilter
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                warehouseLocation={warehouseLocation}
                onWarehouseChange={setWarehouseLocation}
                monthFilterType={monthFilterType}
                onMonthFilterChange={(type) => setMonthFilterType(type as "all" | "previous" | "current" | "custom")}
                customMonth={customMonth}
                onCustomMonthChange={setCustomMonth}
                warehouseOptions={["سوريا", "تركيا"]}
            />
            <StatusCards
                statusOptions={statusOptions}
                statusCounts={statusCounts}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
            />
            <OrderTable
                orders={visibleOrders}
                actions={tableActions}
                onStatusChange={updatestatuschange}
                page={page}
                pageSize={PAGE_SIZE}
                totalCount={visibleOrders.length}
                onPageChange={setPage}
            />
            

            <AppModal size='full' isOpen={isOpenordercustomer} onClose={() => setisOpenordercustomer(false)} title='طلبات العميل'>
                <ViewOrderCustomer orders={ordercustomer} />
            </AppModal>

            <AppModal size='full' isOpen={isOpenorder} onClose={() => setisOpenorder(false)} title='ملخص الطلب' >
                <ViewOrder data={order} products={products} />
            </AppModal>

            <ShippingModal
                isOpen={isShippingModalOpen}
                onClose={() => {
                    if (shippingModalSaving) return;
                    setIsShippingModalOpen(false);
                    setShippingTargetOrder(null);
                }}
                shippingForm={shippingForm}
                onFormChange={setShippingForm}
                shippingCompanyOptions={shippingCompanyOptions}
                onSave={handleSaveShippingModal}
                isSaving={shippingModalSaving}
                targetOrder={shippingTargetOrder}
            />

            {/* مودال إنشاء وتعديل الطلب */}
{isOpen && (
    <OrderCustomerEdit 
      isOpenOrder={isOpen} 
      setisOpenOrder={setIsOpen}
      editId={editId}
      setEditId={setEditId}
      initialData={order} // هنا نمرر كائن الطلب بالكامل
      customers={customers}
      customerId={customerId}
      setCustomerId={setCustomerId}
      products={products}
      getData={Order} // تأكد من أن هذه الدالة تقوم بتحديث قائمة الطلبات بعد التعديل أو الإنشاء
    />
)}
        </div>
    );
};

// سعر صرف الدولار مقابل الليرة التركية (يتم تحديثه من المستخدم عند اختيار تركيا)





export default OrderLayout;
