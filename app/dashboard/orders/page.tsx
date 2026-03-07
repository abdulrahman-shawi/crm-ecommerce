"use client"
import { DataTable } from '@/components/shared/DataTable';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { formatPhoneForDisplay, hasPermission, isAdmin } from '@/lib/utils';
import { getCustomer } from '@/server/customer';
import { createOrder, deleteOrder, getOrders, getOrdersByUser, updateOrder, updateOrderShippingFromTable, updateStaus } from '@/server/order';
import { getProduct } from '@/server/product';
import { getshipping } from '@/server/shipping';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart2, ChevronDown, ChevronUp, Download, Eye, Mail, Package, Pencil, Plus, Printer, Save, Search, Trash, Trash2, X } from 'lucide-react';
import * as React from 'react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { TableAction } from '../../../components/shared/DataTable';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PhoneInput from 'react-phone-number-input';
import { useOrderStore } from '@/store/customer';
import OrderCustomer from '@/components/pages/customers/orderCustomer';
import OrderCustomerEdit from '@/components/pages/customers/orderCustomerEdit';
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

const getOrderCurrencySymbol = (orderLike: any) => String(orderLike?.warehouse?.location || "").trim() === "تركيا" ? "₺" : "$";
const getOrderShippingName = (orderLike: any) => String(orderLike?.shipping?.name || "").trim() || "غير محدد";
const getOrderShippingPrice = (orderLike: any) => {
    return Number((orderLike?.shippingPrice ?? orderLike?.shipping?.price) || 0);
};
const getOrderShippingCommissions = (orderLike: any) => {
    const moneyTransferCommission = Number(orderLike?.moneyTransferCommission || 0);
    const otherCommissions = Number(orderLike?.otherCommissions || 0);
    return {
        moneyTransferCommission,
        otherCommissions,
    };
};
const getOrderTotalShippingExpenses = (orderLike: any) => {
    const shippingPrice = getOrderShippingPrice(orderLike);
    const { moneyTransferCommission, otherCommissions } = getOrderShippingCommissions(orderLike);
    return shippingPrice + moneyTransferCommission + otherCommissions;
};
const getOrderDeliveryMethod = (orderLike: any) => String(orderLike?.deliveryMethod || "").trim() || "غير محدد";


const getMonthKey = (dateValue: Date | string | number) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
};

const getCurrentMonthKey = () => getMonthKey(new Date());

const getPreviousMonthKey = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return getMonthKey(date);
};

const formatPhoneForInvoice = (phoneValue?: string | null) => {
    const raw = String(phoneValue || "").trim();
    if (!raw) return "";

    if (raw.startsWith("+")) {
        const plusMatch = raw.match(/^\+(\d{1,4})(.*)$/);
        if (plusMatch) {
            const countryCode = plusMatch[1];
            const remaining = plusMatch[2].replace(/^[\s-]+/, "") || "-";
            return `+${countryCode} - ${remaining}`;
        }
    }

    if (raw.startsWith("00")) {
        const normalized = `+${raw.slice(2)}`;
        const zeroMatch = normalized.match(/^\+(\d{1,4})(.*)$/);
        if (zeroMatch) {
            const countryCode = zeroMatch[1];
            const remaining = zeroMatch[2].replace(/^[\s-]+/, "") || "-";
            return `+${countryCode} - ${remaining}`;
        }
    }

    return raw.replace(/\s+/g, " ");
};

const OrderLayout: React.FunctionComponent<IOrderLayoutProps> = (props) => {
    const [products, setProduct] = React.useState<any[]>([])
    const [customers, setCustomers] = React.useState<any[]>([])
    const [orders, setorders] = React.useState<any[]>([])
    const [shippingCompanies, setShippingCompanies] = React.useState<any[]>([])
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
    const [statusFilter, setStatusFilter] = React.useState("طلب جديد");

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

    const [page, setPage] = React.useState(1);
    const PAGE_SIZE = 10;

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
    const subTotal = items.reduce((sum, i) => sum + i.total, 0);
    const grandTotal = subTotal - overallDiscount;
    const remainingAmount = Math.max(0, Number(grandTotal) - Number(amount || 0));

    const citiesByCountry: Record<string, string[]> = {
        "سوريا": ["دمشق", "ريف دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "إدلب", "درعا", "السويداء", "القنيطرة", "دير الزور", "الرقة", "الحسكة"],
        "لبنان": ["بيروت", "طرابلس", "صيدا", "صور", "زحلة", "بعلبك", "جونية", "جبيل", "البترون", "النبطية"],
        "العراق": ["بغداد", "البصرة", "الموصل", "أربيل", "النجف", "كربلاء", "كركوك", "السليمانية", "دهوك", "الرمادي", "الفلوجة", "سامراء", "الحلة", "الديوانية", "الناصرية", "الكوت", "العمارة"],
        "تركيا": ["إسطنبول", "أنقرة", "إزمير", "بورصة", "أنطاليا", "أضنة", "غازي عنتاب", "قونية", "مرسين", "قيصري", "أسكي شهير", "طرابزون", "سامسون", "ديار بكر", "شانلي أورفا", "فان"],
        "ليبيا": ["طرابلس", "بنغازي", "مصراتة", "الزاوية", "سبها", "سرت", "طبرق", "درنة", "زليتن", "أجدابيا", "البيضاء", "غريان", "الكفرة", "مرزق"],
    };

    const getEffectivePrice = (price: number, discount: number) => {
        return Math.max(0, Number(price || 0) - Number(discount || 0));
    };

    const openWhatsAppByPhone = (rawPhone?: string | null) => {
        const phone = String(rawPhone || "").trim();
        const normalized = phone.replace(/\D/g, "");
        if (!normalized) {
            toast.error("لا يوجد رقم هاتف لهذا الموظف");
            return;
        }
        window.open(`https://wa.me/${normalized}`, "_blank");
    };

    const buildOrderPdfFile = async (data: any) => {
        const currencySymbol = getOrderCurrencySymbol(data);
        const invoiceNo = data?.orderNumber || '-';
        const createdAt = data?.createdAt ? new Date(data.createdAt).toLocaleDateString('en-US') : '-';
        const customerName = data?.customer?.name || 'غير محدد';
        const paymentMethodText = data?.paymentMethod || '-';
        const deliveryMethodText = getOrderDeliveryMethod(data);
        const shippingName = getOrderShippingName(data);
        const shippingPrice = getOrderShippingPrice(data);
        const { moneyTransferCommission, otherCommissions } = getOrderShippingCommissions(data);
        const shippingTotalExpenses = getOrderTotalShippingExpenses(data);
        const receiverName = data?.receiverName || 'غير محدد';
        const receiverPhone = Array.isArray(data?.receiverPhone)
            ? data.receiverPhone.filter(Boolean).map((phone: string) => formatPhoneForInvoice(phone)).join(' - ')
            : (formatPhoneForInvoice(data?.receiverPhone) || 'لم يسجل');
        const country = data?.country || '-';
        const city = data?.city || 'لم يسجل';
        const municipality = data?.municipality || 'لم يسجل';
        const fullAddress = data?.fullAddress || 'لم يسجل';
        const mapLink = data?.googleMapsLink || '';
        const items = Array.isArray(data?.items) ? data.items : [];

        const formatMoney = (value: any) => Number(value || 0).toLocaleString('en-US');
        const totalDiscount = Number(data?.discount || 0);
        const finalAmount = Number(data?.finalAmount || 0);
        const invoiceGrandTotal = finalAmount + shippingTotalExpenses;
        const subtotal = finalAmount + totalDiscount;
        const amountBank = Number(data?.amountBank || 0);
        const amount = Number(data?.amount || 0);

        const logoUrl = `${window.location.origin}/skynova-light.png`;

        const rowsHtml = items.length
            ? items.map((item: any, idx: number) => {
                const name = item?.product?.name || item?.name || `منتج ${idx + 1}`;
                const quantity = Number(item?.quantity || 0);
                const price = Number(item?.price || 0);
                const discount = Number(item?.discount || 0);
                const effectivePrice = Math.max(0, price - discount);
                const total = effectivePrice * quantity;
                return `
                    <tr>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
                            <div style="font-weight:800;color:#0f172a;">${name}</div>
                            ${discount > 0 ? `<div style="font-size:11px;color:#ef4444;">خصم: ${formatMoney(discount)} ${currencySymbol}</div>` : ''}
                        </td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#475569;">x${quantity}</td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#475569;">${formatMoney(effectivePrice)} ${currencySymbol}</td>
                        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-weight:900;color:#0f172a;">${formatMoney(total)} ${currencySymbol}</td>
                    </tr>
                `;
            }).join('')
            : `
                <tr>
                    <td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;">لا توجد منتجات</td>
                </tr>
            `;

        const wrapper = document.createElement('div');
        wrapper.setAttribute('dir', 'rtl');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '-99999px';
        wrapper.style.top = '0';
        wrapper.style.width = '900px';
        wrapper.style.background = '#ffffff';
        wrapper.style.color = '#0f172a';
        wrapper.style.padding = '28px';
        wrapper.style.fontFamily = 'Tahoma, Arial, sans-serif';
        wrapper.style.lineHeight = '1.7';

        wrapper.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:18px;">
                <div style="display:flex;gap:12px;align-items:center;">
                    <img src="${logoUrl}" alt="SKYNOVA" style="height:48px;object-fit:contain;" />
                    <div style="font-size:18px;font-weight:800;color:#94a3b8;">فاتورة مبيعات</div>
                </div>
                <div style="text-align:left;font-size:12px;color:#64748b;font-weight:700;">
                    <div>رقم الفاتورة: <span style="color:#0f172a;font-weight:900;">#${invoiceNo}</span></div>
                    <div>تاريخ الإصدار: <span style="color:#0f172a;">${createdAt}</span></div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:18px;">
                <div style="background:#eff6ff;border:1px solid #dbeafe;border-radius:18px;padding:16px;">
                    <div style="font-size:18px;font-weight:900;color:#0f172a;">${customerName}</div>
                    <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:6px;">طريقة الدفع: ${paymentMethodText}</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:16px;">
                    <div style="font-size:12px;font-weight:900;color:#94a3b8;letter-spacing:1px;">تفاصيل العنوان والتوصيل</div>
                    <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:6px;">المستلم: ${receiverName}</div>
                    <div style="font-size:12px;font-weight:700;color:#64748b;margin-top:6px;line-height:1.7;">
                        <div>البلد: ${country}</div>
                        <div>المحافظة: ${city}</div>
                        <div>المنظقة: ${municipality}</div>
                        <div>العنوان: ${fullAddress}</div>
                        <div>رقم التواصل: <span dir="rtl">${receiverPhone}</span></div>
                        ${mapLink ? `<div>رابط الخريطة: ${mapLink}</div>` : ''}
                    </div>
                </div>
            </div>

            <div style="border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;margin-bottom:18px;">
                <table style="width:100%;border-collapse:collapse;text-align:right;">
                    <thead>
                        <tr style="background:#0f172a;color:#ffffff;">
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;">المنتج</th>
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;text-align:center;">الكمية</th>
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;text-align:center;">السعر</th>
                            <th style="padding:10px 12px;font-size:12px;font-weight:900;text-align:left;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>

            <div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-end;">
                <div style="flex:1;font-size:11px;font-weight:700;color:#94a3b8;">
                    * هذه الفاتورة صدرت إلكترونياً وهي وثيقة رسمية.<br />
                    * شكراً لتعاملك معنا.
                </div>
                <div style="width:280px;display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#64748b;">
                        <span>المجموع الفرعي:</span>
                        <span>${formatMoney(subtotal)} ${currencySymbol}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#0f172a;">
                        <span>شركة الشحن:</span>
                        <span>${shippingName}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#64748b;">
                        <span>سعر الشحنة:</span>
                        <span>${formatMoney(shippingPrice)} ${currencySymbol}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#64748b;">
                        <span>عمولة تحويل الأموال:</span>
                        <span>${formatMoney(moneyTransferCommission)} ${currencySymbol}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#64748b;">
                        <span>عمولات أخرى:</span>
                        <span>${formatMoney(otherCommissions)} ${currencySymbol}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#0f172a;">
                        <span>إجمالي مصاريف الشحن:</span>
                        <span>${formatMoney(shippingTotalExpenses)} ${currencySymbol}</span>
                    </div>
                    ${totalDiscount > 0 ? `
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#f43f5e;">
                        <span>الخصم الممنوح:</span>
                        <span>-${formatMoney(totalDiscount)} ${currencySymbol}</span>
                    </div>
                    ` : ''}
                    ${paymentMethodText === 'مختلطة' ? `
                    <div style="border-top:1px dashed #e2e8f0;border-bottom:1px dashed #e2e8f0;padding:8px 0;display:flex;flex-direction:column;gap:6px;">
                        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#2563eb;">
                            <span>القيمة المستلمة (حوالة):</span>
                            <span>${formatMoney(amount)} ${currencySymbol}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#7c3aed;">
                            <span>القيمة المتبقية (عند الباب):</span>
                            <span>${formatMoney(amountBank)} ${currencySymbol}</span>
                        </div>
                    </div>
                    ` : ''}
                    <div style="display:flex;justify-content:space-between;align-items:center;background:#2563eb;color:#ffffff;border-radius:18px;padding:14px 16px;box-shadow:0 12px 24px rgba(37,99,235,0.2);">
                        <span style="font-size:14px;font-weight:900;">الإجمالي النهائي</span>
                        <span style="font-size:22px;font-weight:900;">${formatMoney(invoiceGrandTotal)} <span style="font-size:12px;">${currencySymbol}</span></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#475569;">
                        <span>طريقة الدفع:</span>
                        <span> ${paymentMethodText}</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(wrapper);
        const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
        });
        document.body.removeChild(wrapper);

        const imgData = canvas.toDataURL('image/png');
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imageHeight = (canvas.height * pageWidth) / canvas.width;

        let heightLeft = imageHeight;
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, pageWidth, imageHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - imageHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, pageWidth, imageHeight);
            heightLeft -= pageHeight;
        }

        const blob = doc.output('blob');
        return new File([blob], `order-${invoiceNo}.pdf`, { type: 'application/pdf' });
    };

    const shareOrderPdfToCustomerWhatsApp = async (data: any) => {
        const loadingToast = toast.loading('جاري إنشاء ملف PDF...');

        try {
            const pdfFile = await buildOrderPdfFile(data);
            const shareTitle = `فاتورة الطلب #${data?.orderNumber || ''}`;
            const shareText = `Invoice #${data?.orderNumber || ''} - ${data?.customer?.name || ''}`;

            if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
                toast.dismiss(loadingToast);
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    files: [pdfFile],
                });
                toast.success('تم فتح قائمة مشاركة الملف');
                return;
            }

            const downloadUrl = URL.createObjectURL(pdfFile);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = pdfFile.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);

            toast.success('تم إنشاء الملف، هذا المتصفح لا يدعم مشاركة الملفات مباشرة');
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                toast('تم إلغاء المشاركة');
            } else {
                toast.error(error?.message || 'تعذر إنشاء أو مشاركة ملف PDF');
            }
        } finally {
            toast.dismiss(loadingToast);
        }
    };


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

    const { user } = useAuth()

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

            return {
                "رقم المرجع": order.orderNumber,
                "تاريخ الإنشاء": new Date(order.createdAt).toLocaleString('ar-EG'),
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
                "رابط الخريطة": order.googleMapsLink,
                "طريقة التوصيل": getOrderDeliveryMethod(order),
                "شركة الشحن": getOrderShippingName(order),
                "سعر الشحن": getOrderShippingPrice(order),
                "عمولة تحويل الأموال": Number(order.moneyTransferCommission || 0),
                "عمولات أخرى": Number(order.otherCommissions || 0),
                "إجمالي مصاريف الشحن": getOrderTotalShippingExpenses(order),
                "المجموع الكلي مع الشحن": Number(order.finalAmount || 0) + getOrderTotalShippingExpenses(order),
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

    const getAlluser = async () => {
        const res = await getCustomer();
        if (res.success) {
            const allCustomers = res.data;

            // منطق الفلترة بناءً على الرتبة
            setCustomers(allCustomers);
        }
    }

    const Order = async () => {
        const res = await getOrders()
        if (res.success) {
            console.log(res.data)
            setorders(res.data || [])
        }
    }

    const loadShippingCompanies = async () => {
        const res = await getshipping();
        if (res.success) {
            setShippingCompanies(Array.isArray(res.data) ? res.data : []);
        }
    }

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

    // أضف هذه الأسطر إذا كانت غير موجودة
const [warehouseLocation, setWarehouseLocation] = React.useState(""); 
const [searchQuery, setSearchQuery] = React.useState("");
    const [monthFilterType, setMonthFilterType] = React.useState<"all" | "previous" | "current" | "custom">("current");
    const [customMonth, setCustomMonth] = React.useState<string>("");
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
                const isOwner = order.userId === user.id;
                if (!isOwner) return false;
            }
        }

        // --- فلتر البحث النصي ---
        const query = searchQuery.trim().toLowerCase();
        const matchesText = !query ||
            (order.customer?.name && order.customer.name.toLowerCase().includes(query)) ||
            (order.user?.username && order.user.username.toLowerCase().includes(query)) ||
            (order.orderNumber && String(order.orderNumber).includes(query)) ||
            (order.city && order.city.toLowerCase().includes(query));

        if (!matchesText) return false;

        // --- فلتر المستودع المختار من الواجهة (Dropdown) ---
        const matchesLocation = !warehouseLocation || order.warehouse?.location === warehouseLocation;
        if (!matchesLocation) return false;

        if (monthFilterType !== "all") {
            const activeMonth = monthFilterType === "current"
                ? getCurrentMonthKey()
                : monthFilterType === "previous"
                    ? getPreviousMonthKey()
                    : (customMonth || getCurrentMonthKey());

            const orderMonth = getMonthKey(order.createdAt);
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

    const statusCardColors: Record<string, string> = {
        "الكل": "bg-slate-900 text-white border-slate-900",
        "طلب جديد": "bg-sky-200 text-sky-900 border-sky-300",
        "تم استلام الطلب": "bg-blue-200 text-blue-900 border-blue-300",
        "تم ارسال الطلب": "bg-amber-200 text-amber-900 border-amber-300",
        "تم تسليم الطلب": "bg-emerald-200 text-emerald-900 border-emerald-300",
        "فشل التسليم مرتجع": "bg-red-600 text-white border-red-700",
        "تم الغاء الطلب": "bg-rose-200 text-rose-900 border-rose-300",
        "معلق / نقص معلومات": "bg-gray-200 text-gray-900 border-gray-300",
    };

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

    // 1. تأكد من وجود حالة للتحميل في المكون الخاص بك
    // const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    React.useEffect(() => {
        setPage(1);
    }, [statusFilter]);
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
    React.useEffect(() => {
        getAlluser();
        Order();
        loadShippingCompanies();
        getProduct().then((products) => {
            setProduct(products);
        }).catch(console.error);

    }, []);

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
        (user && isAdmin(user)) && {
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

                <button
                    onClick={() => exportAllOrdersToExcel(orders)} // نمرر مصفوفة الطلبات التي لديك بالفعل
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
                >
                    <Download size={20} />
                </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
    <div className="relative w-full md:w-96">
        <span className="absolute inset-y-0 right-3 flex items-center pr-2 pointer-events-none">
            {/* أيقونة بحث بسيطة */}
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </span>
        <input
            type="text"
            placeholder="بحث باسم العميل، الموظف، أو المدينة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-950 rounded-lg bg-white dark:bg-slate-950 dark:text-slate-100 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
    </div>

    {/* فلتر المستودع (الدولة) */}
    <select
        value={warehouseLocation}
        onChange={(e) => setWarehouseLocation(e.target.value)}
        className="w-full md:w-48 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
    >
        <option value="">كل المستودعات</option>
        <option value="سوريا">سوريا</option>
        <option value="تركيا">تركيا</option>
    </select>

    <div className="w-full md:w-auto flex items-center gap-2">
        <select
            value={monthFilterType}
            onChange={(e) => setMonthFilterType(e.target.value as "all" | "previous" | "current" | "custom")}
            className="w-full md:w-44 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
        >
            <option value="all">إظهار الكل</option>
            <option value="previous">الشهر الماضي</option>
            <option value="current">هذا الشهر</option>
            <option value="custom">مخصص</option>
        </select>

        {monthFilterType === "custom" && (
            <input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="w-full md:w-44 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
            />
        )}
    </div>
</div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
                {statusOptions.map((status) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`p-3 rounded-2xl border text-right transition-all ${statusFilter === status
                            ? `${statusCardColors[status]} shadow-md`
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-400"}
                        `}
                    >
                        <p className="text-[10px] font-bold uppercase">{status}</p>
                        <p className="text-lg font-black">{statusCounts[status] ?? 0}</p>
                    </button>
                ))}
            </div>
            <DataTable data={visibleOrders}
                actindir={true}
                totalCount={visibleOrders.length} // لنفترض وجود 150 عميل في الداتا بيز
                pageSize={PAGE_SIZE}
                currentPage={page}
                onPageChange={(newPage) => setPage(newPage)}
                actions={tableActions} columns={[
                    {
                        header: "رقم الطلب",
                        accessor: "orderNumber"
                    },
                    {
                        header: "العميل",
                        accessor: (e: any) => (
                            <div className="flex flex-col">
                                <button
                                    onClick={() => {
                                        const rawPhone = e.customer?.phone?.[0] || "";
                                        const phoneNumber = rawPhone.replace(/\D/g, "");
                                        const countryCode = (e.customer?.countryCode || "").replace(/\D/g, "");
                                        if (phoneNumber) {
                                            window.open(`https://wa.me/${countryCode}${phoneNumber}`, "_blank");
                                        }
                                    }}
                                    className="text-right font-bold text-blue-600 hover:text-blue-700"
                                >
                                    {e.customer?.name}
                                </button>
                            </div>
                        )
                    },
                    {
                        header: "بيعت من قبل",
                        accessor: (e: any) => {
                            const employeeName = e.user?.username || e.user?.name || "-";
                            const employeePhone = e.user?.phone || "";
                            const hasPhone = String(employeePhone).trim().length > 0;

                            return (
                                <button
                                    type="button"
                                    onClick={() => openWhatsAppByPhone(employeePhone)}
                                    className={`font-bold ${hasPhone ? "text-emerald-600 hover:text-emerald-700" : "text-slate-400 cursor-not-allowed"}`}
                                    disabled={!hasPhone}
                                    title={hasPhone ? "فتح واتساب" : "لا يوجد رقم هاتف"}
                                >
                                    {employeeName}
                                </button>
                            );
                        }
                    },
                    {
                        header: "المجموع الكلي",
                        accessor: (e: any) => (
                            <span className="font-black text-blue-600">
                                {(Number(e.finalAmount || 0) + getOrderTotalShippingExpenses(e)).toLocaleString()} {getOrderCurrencySymbol(e)}
                            </span>
                        )
                    },
                    {
                        header: "شركة الشحن",
                        accessor: (e: any) => (
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                {getOrderShippingName(e)}
                            </span>
                        )
                    },
                    {
                        header: "مصاريف الشحن",
                        accessor: (e: any) => (
                            <span className="font-black text-amber-600">
                                {getOrderTotalShippingExpenses(e).toLocaleString()} {getOrderCurrencySymbol(e)}
                            </span>
                        )
                    },
                    {
                        header: "المدينة",
                        accessor: (e: any) => (
                            <span className="font-bold text-gray-600 dark:text-gray-300">
                                {e.city || "-"}
                            </span>
                        )
                    },
                    {
                        header: "حالة الطلب",
                        accessor: (c: any) => {
                            // تعريف الألوان بناءً على طلبك
                            const statusColors: Record<string, string> = {
                                "طلب جديد": "bg-sky-200 text-sky-900 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
                                "تم استلام الطلب": "bg-blue-200 text-blue-900 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800", // أزرق
                                "تم ارسال الطلب": "bg-yellow-200 text-yellow-900 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800", // أصفر
                                "تم تسليم الطلب": "bg-green-200 text-green-900 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800", // أخضر
                                "فشل التسليم مرتجع": "bg-red-600 text-white border-red-700 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800", // أحمر غامق
                                "تم الغاء الطلب": "bg-red-200 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800", // أحمر فاتح
                                "معلق / نقص معلومات": "bg-gray-200 text-gray-900 border-gray-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700", // رمادي
                            };

                            // دالة لجلب اللون الحالي بناءً على القيمة
                            const currentColor = statusColors[c.status] || "bg-slate-50 text-slate-500 border-slate-200";

                            return (
                                <div className="min-w-[150px]">
                                    <select
                                        className={`${currentColor} w-full p-2.5 rounded-xl border font-bold transition-all cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400`}
                                        value={c.status}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            updatestatuschange(newValue, c.id);
                                        }}
                                        name="order-status"
                                    >
                                        <option value="" disabled>اختر الحالة</option>
                                        <option value="طلب جديد" className="bg-white text-black">طلب جديد</option>
                                        <option value="تم استلام الطلب" className="bg-white text-black">تم استلام الطلب</option>
                                        <option value="تم ارسال الطلب" className="bg-white text-black">تم ارسال الطلب</option>
                                        <option value="تم تسليم الطلب" className="bg-white text-black">تم تسليم الطلب</option>
                                        <option value="فشل التسليم مرتجع" className="bg-white text-black">فشل التسليم مرتجع</option>
                                        <option value="تم الغاء الطلب" className="bg-white text-black">تم الغاء الطلب</option>
                                        <option value="معلق / نقص معلومات" className="bg-white text-black">معلق / نقص معلومات</option>
                                    </select>
                                </div>
                            );
                        }
                    },
                    {
                        header: "تاريخ الإنشاء",
                        accessor: (e: any) => new Date(e.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })
                    },
                ]} />
            

            <AppModal size='full' isOpen={isOpenordercustomer} onClose={() => setisOpenordercustomer(false)} title='طلبات العميل'>
                <ViewOrderCustomer orders={ordercustomer} />
            </AppModal>

            <AppModal size='full' isOpen={isOpenorder} onClose={() => setisOpenorder(false)} title='ملخص الطلب' >
                <ViewOrder data={order} products={products} onSharePdf={shareOrderPdfToCustomerWhatsApp} />
            </AppModal>

            <AppModal
                size='md'
                isOpen={isShippingModalOpen}
                onClose={() => {
                    if (shippingModalSaving) return;
                    setIsShippingModalOpen(false);
                    setShippingTargetOrder(null);
                }}
                title='بيانات الشحن والعمولات'
                description={shippingTargetOrder ? `الطلب #${shippingTargetOrder.orderNumber}` : undefined}
                footer={(
                    <>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => {
                                setIsShippingModalOpen(false);
                                setShippingTargetOrder(null);
                            }}
                            disabled={shippingModalSaving}
                        >
                            إلغاء
                        </Button>
                        <Button
                            type='button'
                            onClick={handleSaveShippingModal}
                            disabled={shippingModalSaving}
                        >
                            {shippingModalSaving ? "جاري الحفظ..." : "حفظ"}
                        </Button>
                    </>
                )}
            >
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">اسم شركة الشحن</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2"
                            value={shippingForm.shippingCompanyName}
                            onChange={(e) => setShippingForm((prev) => ({ ...prev, shippingCompanyName: e.target.value }))}
                            disabled={shippingModalSaving}
                        >
                            <option value="">اختر شركة الشحن</option>
                            {shippingCompanyOptions.map((name: string) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">سعر الشحنة</label>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                            value={shippingForm.shippingPrice}
                            onChange={(e) => setShippingForm((prev) => ({ ...prev, shippingPrice: e.target.value }))}
                            disabled={shippingModalSaving}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">عمولة تحويل الأموال</label>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                            value={shippingForm.moneyTransferCommission}
                            onChange={(e) => setShippingForm((prev) => ({ ...prev, moneyTransferCommission: e.target.value }))}
                            disabled={shippingModalSaving}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">عمولات أخرى</label>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                            value={shippingForm.otherCommissions}
                            onChange={(e) => setShippingForm((prev) => ({ ...prev, otherCommissions: e.target.value }))}
                            disabled={shippingModalSaving}
                        />
                    </div>
                </div>
            </AppModal>

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

function ViewOrder({ data, products, onSharePdf }: { data: any, products: any, onSharePdf?: (order: any) => void | Promise<void> }) {
    const componentRef = React.useRef<HTMLDivElement>(null);
    const currencySymbol = getOrderCurrencySymbol(data);

    const getEffectivePrice = (price: number, discount: number) => {
        return Math.max(0, Number(price || 0) - Number(discount || 0));
    };

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `فاتورة-${data.orderNumber}`,
        onAfterPrint: () => console.log("تمت الطباعة بنجاح"),
    });

    const totalDiscount = Number(data.discount) || 0;
    const finalAmount = Number(data.finalAmount) || 0;
    const subtotal = finalAmount + totalDiscount;
    const shippingPrice = getOrderShippingPrice(data);
    const { moneyTransferCommission, otherCommissions } = getOrderShippingCommissions(data);
    const totalShippingExpenses = getOrderTotalShippingExpenses(data);
    const invoiceGrandTotal = Number(finalAmount) + Number(totalShippingExpenses);

    const getProductName = (productId: any) => {
        const product = products?.find((p: any) => p.id === productId);
        return product ? product.name : `منتج رقم #${productId}`;
    };

    return (
        <div className="p-4 md:p-10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 min-h-screen">

            {/* زر الطباعة */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 p-4 bg-white dark:bg-slate-900 no-print">
                <button
                    type="button"
                    onClick={() => onSharePdf?.(data)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                    <Mail size={20} />
                    مشاركة PDF
                </button>
                <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                    <Printer size={20} />
                    طباعة الفاتورة
                </button>
            </div>

            <div ref={componentRef} className="p-4 md:p-10 bg-white dark:bg-slate-900" dir="rtl">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page { size: auto; margin: 10mm; }
                        body { -webkit-print-color-adjust: exact; background-color: white !important; }
                        .no-print { display: none !important; }
                    }
                `}} />

                <div id="printable-area">
                    {/* الهيدر العلوي مع إضافة "فاتورة" */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-8 md:mb-10 pb-6 md:pb-8 border-b-2 border-slate-100">
                        <div className="flex flex-wrap items-baseline gap-3">
                            <h1 className="text-3xl md:text-5xl font-black text-blue-600 tracking-tighter italic">SKYNOVA</h1>
                            <span className="text-base md:text-2xl font-bold text-slate-400">| فاتورة مبيعات</span>
                        </div>
                        <div className="text-left space-y-1 text-xs md:text-sm text-slate-500 font-bold">
                            <p>رقم الفاتورة: <span className="text-slate-900 dark:text-white font-mono">#{data.orderNumber}</span></p>
                            <p>تاريخ الإصدار: <span className="text-slate-900 dark:text-white">{data.createdAt instanceof Date ? data.createdAt.toLocaleDateString('ar-EG') : String(data.createdAt)}</span></p>
                        </div>
                    </div>

                    {/* تفاصيل العميل والمستلم والعنوان */}
                    <div className="grid grid-cols-1 gap-6 md:gap-8 mb-8 md:mb-12">
                        <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100/50">
                            <p className="text-xl font-black text-slate-900 dark:text-white">{data.customer?.name}</p>
                            <p className="text-sm font-bold text-slate-500 mt-2">طريقة الدفع: {data.paymentMethod}</p>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100">
                            <h3 className="text-slate-400 font-black text-sm mb-3 uppercase tracking-wider">تفاصيل العنوان والتوصيل</h3>
                            <p className="text-lg font-black text-slate-800 dark:text-white">المستلم: {data.receiverName || 'غير محدد'}</p>

                            {/* عرض العنوان التفصيلي */}
                            <div className="text-sm font-bold text-slate-500 mt-2 space-y-1">
                                <p>البلد: {data.country} </p>
                                <p>المحافظة:{data.city ? ` - ${data.city}` : 'لم يسجل'}</p>
                                <p>المنظقة: {data.municipality ? ` - ${data.municipality}` : 'لم يسجل'}</p>
                                <p>العنوان: {data.fullAddress || 'لم يسجل'}</p>
                                <p>
                                    رقم التواصل: <span dir="ltr">{
                                        Array.isArray(data?.receiverPhone)
                                            ? (data.receiverPhone.filter(Boolean).map((phone: string) => formatPhoneForDisplay(phone)).join(" - ") || 'لم يسجل')
                                            : (formatPhoneForDisplay(data?.receiverPhone) || 'لم يسجل')
                                    }</span>
                                </p>
                                <p>شركة الشحن: {getOrderShippingName(data)}</p>
                                <p>سعر الشحنة: {shippingPrice.toLocaleString()} {currencySymbol}</p>
                                <p>عمولة تحويل الأموال: {moneyTransferCommission.toLocaleString()} {currencySymbol}</p>
                                <p>عمولات أخرى: {otherCommissions.toLocaleString()} {currencySymbol}</p>
                                <p>إجمالي مصاريف الشحن: {totalShippingExpenses.toLocaleString()} {currencySymbol}</p>
                                {
                                    data.googleMapsLink && (
                                        <div className="">
                                            <a target='_blank' href={`${data.googleMapsLink}`}>رابط الخريطة</a>
                                        </div>
                                    )
                                }

                            </div>
                        </div>
                    </div>

                    {/* جدول المنتجات */}
                    <div className="overflow-x-auto rounded-[2rem] border border-slate-100 mb-6 md:mb-8">
                        <table className="w-full text-right">
                            <thead className='border border-slate-600'>
                                <tr className="bg-slate-900 text-white">
                                    <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm">المنتج</th>
                                    <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm text-center">الكمية</th>
                                    <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm text-center">السعر</th>
                                    <th className="px-4 md:px-8 py-2 font-black text-xs md:text-sm text-left">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.items?.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-4 md:px-8 py-2">
                                            <p className="font-black text-slate-800 dark:text-slate-100">{getProductName(item.productId)}</p>
                                        </td>
                                        <td className="px-4 md:px-8 py-2 text-center font-bold text-slate-600 italic">x{item.quantity}</td>
                                        <td className="px-4 md:px-8 py-2 text-center font-bold text-slate-600">{getEffectivePrice(item.price, item.discount || 0).toLocaleString()} {currencySymbol}</td>
                                        <td className="px-4 md:px-8 py-2 text-left font-black text-slate-900 dark:text-white">{(getEffectivePrice(item.price, item.discount || 0) * item.quantity).toLocaleString()} {currencySymbol}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-end md:gap-10">
                        {/* ملاحظات قانونية */}
                        <div className="text-slate-400 text-xs font-bold leading-relaxed flex-1">
                            * هذه الفاتورة صدرت إلكترونياً وهي وثيقة رسمية.
                            <br />
                            * شكراً لتعاملك مع SKYNOVA.
                        </div>

                        {/* ملخص الحسابات */}
                        <div className="w-full md:w-96 space-y-3">
                            <div className="flex justify-between px-4 md:px-6 text-slate-500 font-bold text-sm">
                                <span>المجموع الفرعي:</span>
                                <span>{subtotal.toLocaleString()} {currencySymbol}</span>
                            </div>

                            <div className="flex justify-between px-4 md:px-6 text-slate-500 font-bold text-sm">
                                <span>سعر الشحنة:</span>
                                <span>{shippingPrice.toLocaleString()} {currencySymbol}</span>
                            </div>

                            <div className="flex justify-between px-4 md:px-6 text-slate-500 font-bold text-sm">
                                <span>عمولة تحويل الأموال:</span>
                                <span>{moneyTransferCommission.toLocaleString()} {currencySymbol}</span>
                            </div>

                            <div className="flex justify-between px-4 md:px-6 text-slate-500 font-bold text-sm">
                                <span>عمولات أخرى:</span>
                                <span>{otherCommissions.toLocaleString()} {currencySymbol}</span>
                            </div>

                            <div className="flex justify-between px-4 md:px-6 text-slate-700 dark:text-slate-200 font-bold text-sm">
                                <span>إجمالي مصاريف الشحن:</span>
                                <span>{totalShippingExpenses.toLocaleString()} {currencySymbol}</span>
                            </div>

                            {totalDiscount > 0 && (
                                <div className="flex justify-between px-4 md:px-6 text-rose-500 font-bold text-sm">
                                    <span>الخصم الممنوح:</span>
                                    <span>-{totalDiscount.toLocaleString()} {currencySymbol}</span>
                                </div>
                            )}

                            {/* عرض تفاصيل الدفع المختلط */}
                            {data.paymentMethod === "مختلطة" && (
                                <div className="border-t border-b border-dashed border-slate-200 py-3 space-y-2">
                                    <div className="flex justify-between px-4 md:px-6 text-blue-600 font-bold text-sm">
                                        <span>القيمة المستلمة (حوالة):</span>
                                        <span>{Number(data.amount).toLocaleString()} {currencySymbol}</span>
                                    </div>
                                    <div className="flex justify-between px-4 md:px-6 text-purple-600 font-bold text-sm">
                                        <span>القيمة المتبقية (عند الباب):</span>
                                        <span>{Number(data.amountBank).toLocaleString()} {currencySymbol}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center p-4 md:p-6 bg-blue-600 rounded-[2rem] text-white shadow-xl">
                                <span className="text-lg md:text-xl font-black">الإجمالي النهائي</span>
                                <div className="text-right">
                                    <span className="text-2xl md:text-3xl font-black italic tracking-tighter">
                                        {invoiceGrandTotal.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-bold mr-1"> {currencySymbol}</span>
                                </div>
                            </div>
                            <div className="flex justify-between px-4 md:px-6 text-slate-700 dark:text-slate-200 font-bold text-sm">
                                <span>طريقة الدفع:</span>
                                <span>{data.paymentMethod}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ViewOrderCustomer({ orders }: { orders: any[] }) {
    // حالة لتخزين معرف الطلب المفتوح حالياً لعرض منتجاته
    const [expandedOrderId, setExpandedOrderId] = React.useState<number | null>(null);

    if (!orders || orders.length === 0) return <div className="p-10 text-center font-bold">لا يوجد طلبات سابقة لهذا العميل</div>;

    const clientName = orders[0].customer?.name || "العميل";

    // دالة لتبديل حالة العرض (فتح/إغلاق)
    const toggleOrder = (id: number) => {
        setExpandedOrderId(expandedOrderId === id ? null : id);
    };

    return (
        <div className="space-y-6 p-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    طلبات العميل: {clientName}
                    <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                        {orders.length} فواتير
                    </span>
                </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 max-h-[70vh] overflow-y-auto pr-2">
                {orders.map((order: any) => (
                    <div key={order.id} className="flex flex-col gap-2">
                        {/* بطاقة الطلب الرئيسية */}
                        <div
                            onClick={() => toggleOrder(order.id)}
                            className={`flex justify-between items-center p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] hover:shadow-lg transition-all cursor-pointer border-r-4 ${expandedOrderId === order.id ? 'border-r-blue-600 shadow-md' : 'border-r-blue-500'
                                }`}
                        >
                            <div className="space-y-1">
                                <p className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    رقم المرجع: <span className="font-mono text-blue-600">#{order.orderNumber}</span>
                                    {expandedOrderId === order.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </p>
                                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                                    <span className="flex items-center gap-1">📅 {new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                                    <span className="flex items-center gap-1">👤 بواسطة: {order.user?.name || 'Admin'}</span>
                                </div>
                            </div>

                            <div className="text-left space-y-1">
                                <p className="font-black text-lg text-slate-900 dark:text-white italic">
                                    {Number(order.finalAmount).toLocaleString()} <span className="text-xs">{getOrderCurrencySymbol(order)}</span>
                                </p>
                                <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block font-bold ${order.status === 'مدفوعة' || order.status === 'تم التسليم'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-amber-100 text-amber-600'
                                    }`}>
                                    {order.status}
                                </div>
                            </div>
                        </div>

                        {/* قسم المنتجات (يظهر فقط عند الضغط) */}
                        {expandedOrderId === order.id && (
                            <div className="mx-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-[1.5rem] border-x border-b border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                                <h4 className="text-[11px] font-black text-slate-400 mb-3 flex items-center gap-2">
                                    <Package size={12} /> محتويات الطلب:
                                </h4>
                                <div className="space-y-2">

                                    {order.items?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                                    {item.product?.name || item.name || "منتج غير مسمى"}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono italic">
                                                    {item.product?.modelNumber || item.modelNumber || "بدون موديل"}
                                                </span>
                                            </div>
                                            <div className="text-left font-bold">
                                                <span className="text-blue-600">{item.quantity}</span>
                                                <span className="text-[10px] text-slate-400 mr-1">×</span>
                                                <span className="text-xs text-slate-600 dark:text-slate-400 ml-2">
                                                    {Number(item.price).toLocaleString()} {getOrderCurrencySymbol(order)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!order.items || order.items.length === 0) && (
                                        <div className="text-xs text-center text-slate-400 italic">لا توجد منتجات مسجلة لهذا الطلب</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// سعر صرف الدولار مقابل الليرة التركية (يتم تحديثه من المستخدم عند اختيار تركيا)





export default OrderLayout;
