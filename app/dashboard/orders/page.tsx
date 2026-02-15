"use client"
import { DataTable } from '@/components/shared/DataTable';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { hasPermission, isAdmin } from '@/lib/utils';
import { getCustomer } from '@/server/customer';
import { createOrder, deleteOrder, getOrders, getOrdersByUser, updateOrder, updateStaus } from '@/server/order';
import { getProduct } from '@/server/product';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart2, ChevronDown, ChevronUp, Download, Eye, Mail, Package, Plus, Printer, Save, Search, Trash, Trash2, X } from 'lucide-react';
import * as React from 'react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { TableAction } from '../../../components/shared/DataTable';
import * as XLSX from 'xlsx';
import { permission } from 'process';
interface IOrderLayoutProps {
}

const OrderLayout: React.FunctionComponent<IOrderLayoutProps> = (props) => {
    const [products, setProduct] = React.useState<any[]>([])
    const [customers, setCustomers] = React.useState<any[]>([])
    const [orders, setorders] = React.useState<any[]>([])
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

    // بيانات المستلم والعنوان
    const [receiverName, setReceiverName] = React.useState("");
    const [receiverPhone, setReceiverPhone] = React.useState("");
    const [country, setCountry] = React.useState("ليبيا"); // افتراضي حسب الصورة
    const [city, setCity] = React.useState("");
    const [municipality, setMunicipality] = React.useState("");
    const [fullAddress, setFullAddress] = React.useState("");

    // تفاصيل الشحن
    const [deliveryMethod, setDeliveryMethod] = React.useState("توصيل الى المنزل");
    const [shippingCompany, setShippingCompany] = React.useState("");
    const [trackingCode, setTrackingCode] = React.useState("");
    const [googleMapsLink, setGoogleMapsLink] = React.useState("");

    const [page, setPage] = React.useState(1);
    const PAGE_SIZE = 10;

    const [customerSearchQuery, setCustomerSearchQuery] = React.useState("");
    const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
    const [deliveryNotes, setDeliveryNotes] = React.useState("");
    const [additionalNotes, setAdditionalNotes] = React.useState("");
    const subTotal = items.reduce((sum, i) => sum + i.total, 0);
    const grandTotal = subTotal - overallDiscount;


    const updateItem = (index: number, field: string, value: any, products: any[]) => {
        const newItems = [...items];
        const item = newItems[index];

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

    const { user } = useAuth()

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
                "هاتف العميل": order.customer?.phone,
                "المبلغ الإجمالي": order.totalAmount,
                "الخصم": order.discount,
                "المبلغ النهائي": order.finalAmount,
                "طريقة الدفع": order.paymentMethod,
                "المنتجات المشتراة": itemsSummary,
                "اسم المستلم": order.receiverName || "نفس العميل",
                "هاتف المستلم": order.receiverPhone,
                "الدولة": order.country,
                "المدينة": order.city,
                "البلدية": order.municipality,
                "العنوان الكامل": order.fullAddress,
                "رابط الخريطة": order.googleMapsLink,
                "طريقة التوصيل": order.deliveryMethod,
                "شركة الشحن": order.shippingCompany,
                "كود التتبع": order.trackingCode,
                "ملاحظات التوصيل": order.deliveryNotes,
                "ملاحظات إضافية": order.additionalNotes,
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
            setorders(res.data)
        }
    }

    const filterOrder = React.useMemo(() => {
        if (!user) return []; // إذا لم يتم تحميل المستخدم بعد، ارجع مصفوفة فارغة

        return orders.filter((order: any) => {
            // 1. إذا كان أدمن، يرى كل الطلبات
            const isAdminUser = isAdmin(user) || hasPermission(user, "viewOrders");

            if (isAdminUser) return orders;

            // 2. إذا كان موظف، يرى فقط الطلبات التي قام بإنشائها هو
            // ملاحظة: تأكد أن الحقل في الـ Schema هو userId
            return order.userId === user.id;
        });
    }, [orders, user]);

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
            shippingCompany,
            trackingCode,
            deliveryMethod,
            deliveryNotes,
            paymentMethod,
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

        // إعادة بيانات المستلم والعنوان
        setReceiverName("");
        setReceiverPhone("");
        setCountry("ليبيا");
        setCity("");
        setMunicipality("");
        setFullAddress("");

        // إعادة تفاصيل الشحن والملاحظات
        setDeliveryMethod("توصيل الى المنزل");
        setShippingCompany("");
        setTrackingCode("");
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

    const tableActions: any[] = [
        (user && hasPermission(user, "viewOrders")) && {
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
        (user && hasPermission(user, "editOrders")) && {
            label: "تعديل",
            icon: <Mail size={14} />,
            onClick: (data: any) => {
                // 1. تعيين المعرف الأساسي لحالة التعديل
                setEditId(data.id);

                // 2. تعيين بيانات العميل والحالة الأساسية
                setCustomerId(data.customerId); // تأكد أنه ID وليس الكائن كاملاً
                setStatus(data.status);
                setPaymentMethod(data.paymentMethod);

                // 3. تعيين بيانات المستلم
                setReceiverName(data.receiverName || "");
                setReceiverPhone(data.receiverPhone || "");
                setCountry(data.country || "ليبيا");
                setCity(data.city || "");
                setMunicipality(data.municipality || "");
                setFullAddress(data.fullAddress || "");

                // 4. تعيين بيانات الشحن
                setDeliveryMethod(data.deliveryMethod || "توصيل الى المنزل");
                setShippingCompany(data.shippingCompany || "");
                setTrackingCode(data.trackingCode || "");
                setGoogleMapsLink(data.googleMapsLink || "");
                setDeliveryNotes(data.deliveryNotes || "");
                setAdditionalNotes(data.additionalNotes || "");

                // 5. تعيين المبالغ المالية
                setOverallDiscount(data.overallDiscount || 0);
                // المبالغ الأخرى (subTotal, grandTotal) يتم حسابها تلقائياً من الـ items


                // 6. تعيين المنتجات (Items) 
                // ملاحظة: تأكد أن العلاقة في Prisma تسمى items أو OrderItems
                if (data.items && data.items.length > 0) {
                    const formattedItems = data.items.map((item: any) => ({
                        productId: item.productId.toString(),
                        name: item.product?.name || item.name,
                        price: item.price,
                        quantity: item.quantity,
                        discount: item.discount || 0,
                        note: item.note || "",
                        total: (item.price * item.quantity) - (item.discount || 0),
                        modelNumber: item.product?.modelNumber || ""
                    }));
                    setItems(formattedItems);

                    // تحديث مصفوفة البحث السريع لضمان ظهور أسماء المنتجات في الحقول
                    const searches: Record<number, string> = {};
                    formattedItems.forEach((item: any, idx: any) => {
                        searches[idx] = item.name;
                    });
                    setSearchQueries(searches);
                } else {
                    // إذا لم توجد منتجات، نضع سطراً فارغاً
                    setItems([{ productId: "", name: "", price: 0, quantity: 1, discount: 0, note: "", total: 0, modelNumber: "" }]);
                }

                // 7. فتح المودال
                setIsOpen(true);
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

                <button
                    onClick={() => exportAllOrdersToExcel(orders)} // نمرر مصفوفة الطلبات التي لديك بالفعل
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
                >
                    <Download size={20} />
                </button>
            </div>
            <DataTable data={filterOrder}
                actindir={true}
                totalCount={filterOrder.length} // لنفترض وجود 150 عميل في الداتا بيز
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
                            <div onClick={() => showordercustomer(e.customer?.id)} className="cursor-pointer flex flex-col">
                                <span className="font-bold">{e.customer?.name}</span>
                            </div>
                        )
                    },
                    { header: "بيعت من قبل", accessor: (e: any) => e.user.username },
                    {
                        header: "قيمة الفاتورة",
                        accessor: (e: any) => (
                            <span className="font-black text-blue-600">
                                {e.finalAmount?.toLocaleString()}  $
                            </span>
                        )
                    },
                    {
                        header: "حالة الطلب",
                        accessor: (c: any) => {
                            // تعريف الألوان بناءً على طلبك
                            const statusColors: Record<string, string> = {
                                "طلب جديد": "bg-sky-100 text-sky-700 border-sky-200",
                                "تم استلام الطلب": "bg-blue-100 text-blue-700 border-blue-200", // أزرق
                                "تم ارسال الطلب": "bg-yellow-100 text-yellow-700 border-yellow-200", // أصفر
                                "تم تسليم الطلب": "bg-green-100 text-green-700 border-green-200", // أخضر
                                "فشل التسليم مرتجع": "bg-red-600 text-white border-red-700", // أحمر غامق
                                "تم الغاء الطلب": "bg-red-100 text-red-700 border-red-200", // أحمر فاتح
                                "معلق / نقص معلومات": "bg-gray-100 text-gray-700 border-gray-200", // رمادي
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
            <AppModal footer={
                <div className="pt-6 w-full flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex gap-6 items-center">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-red-500 uppercase px-1">خصم إضافي (كلي)</label>
                            <div className="relative">
                                <input type="number" value={overallDiscount} onChange={(e) => setOverallDiscount(Number(e.target.value))} className="w-32 bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 dark:border-red-900/20 outline-none font-bold text-red-600 text-center" placeholder="0" />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400"> $</span>
                            </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-8 py-4 rounded-3xl">
                            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">الإجمالي النهائي</p>
                            <h3 className="text-3xl font-black font-sans text-blue-600 italic"> ${grandTotal.toLocaleString()}</h3>
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
            } size='full' isOpen={isOpen} onClose={resetForm} title='اضافة طلب'>
                <div>
                    <div className="space-y-4 mb-4">
                        {items.map((item: any, index: number) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 items-center">
                                <div className="md:col-span-3 relative"> {/* تم إضافة relative هنا لضبط القائمة المنسدلة */}
                                    <label className="text-[10px] font-bold text-slate-400 mb-1">المنتج</label>
                                    <input
                                        type="text"
                                        value={searchQueries[index] || item.name || item.modelNumber}
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
                                                {products?.filter((p: any) =>
                                                    // البحث في الاسم
                                                    p.name.toLowerCase().includes((searchQueries[index] || "").toLowerCase()) ||
                                                    // البحث في رقم الموديل
                                                    (p.modelNumber && p.modelNumber.toLowerCase().includes((searchQueries[index] || "").toLowerCase()))
                                                ).map((product: any) => (
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
                                                        <div className="text-blue-500 text-xs mt-1"> $ {product.price}</div>
                                                    </div>
                                                ))}
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
                                    <div className="p-3 text-sm font-bold"> ${item.price}</div>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="text-[10px] font-bold text-red-400 mb-1">الخصم</label>
                                    <input type="number" value={item.discount} onChange={(e) => updateItem(index, "discount", e.target.value, products)} className="w-full bg-red-50 dark:bg-red-900/10 p-3 rounded-xl text-center font-bold text-red-600 outline-none text-sm border border-red-100 dark:border-red-900/20" />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="text-[10px] font-bold text-slate-400 mb-1">ملاحظات المنتج</label>
                                    <input type="text" value={item.note} onChange={(e) => updateItem(index, "note", e.target.value, products)} className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl outline-none text-xs shadow-sm" placeholder="إضافة ملاحظة..." />
                                </div>
                                <div className="md:col-span-1 text-center font-black text-blue-600 italic"> ${item.total}</div>
                                <div className="md:col-span-1 flex justify-center">
                                    <button onClick={() => setItems(items.filter((_: any, i: number) => i !== index))} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                        <button onClick={addNewItem} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold text-xs hover:border-blue-500 hover:text-blue-500 transition-all">+ إضافة بند جديد</button>
                    </div>
                    <div className="space-y-8" dir="rtl">
                        {/* القسم الأول: بيانات العميل والطلب */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                            {/* العميل / المورد مع قائمة منسدلة للبحث */}
                            <div className="space-y-2 md:col-span-2 relative">
                                <label className="text-xs font-bold text-slate-500 mr-2">العميل / المورد</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        // يعرض اسم العميل المختار حالياً أو نص البحث
                                        value={customerSearchQuery || customers?.find(c => c.id === customerId)?.name || ""}
                                        placeholder="ابحث عن عميل..."
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        onChange={(e) => {
                                            setCustomerSearchQuery(e.target.value);
                                            setShowCustomerDropdown(true);
                                        }}
                                        className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                    />

                                    {/* أيقونة سهم أو بحث صغيرة للجمالية */}
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        <Search size={18} />
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {showCustomerDropdown && (
                                        <>
                                            {/* طبقة شفافة لإغلاق القائمة عند الضغط خارجها */}
                                            <div
                                                className="fixed inset-0 z-[200]"
                                                onClick={() => setShowCustomerDropdown(false)}
                                            />

                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="absolute z-[210] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
                                            >
                                                {customers?.filter((c: any) =>
                                                    c.name.toLowerCase().includes((customerSearchQuery || "").toLowerCase()) ||
                                                    c.phone?.includes(customerSearchQuery || "")
                                                ).length > 0 ? (
                                                    customers
                                                        ?.filter((c: any) =>
                                                            c.name.toLowerCase().includes((customerSearchQuery || "").toLowerCase())
                                                        )
                                                        .map((customer: any) => (
                                                            <div
                                                                key={customer.id}
                                                                onClick={() => {
                                                                    setCustomerId(customer.id);
                                                                    setCustomerSearchQuery(customer.name);
                                                                    setShowCustomerDropdown(false);
                                                                }}
                                                                className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors"
                                                            >
                                                                <div className="font-bold text-slate-800 dark:text-slate-100">{customer.name}</div>
                                                                {customer.phone && (
                                                                    <div className="text-xs text-slate-500 mt-0.5">{customer.phone}</div>
                                                                )}
                                                            </div>
                                                        ))
                                                ) : (
                                                    <div className="p-4 text-center text-slate-400 text-sm italic">
                                                        لا يوجد نتائج مطابقة...
                                                    </div>
                                                )}
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">اسم الشخص المستلم</label>
                                <input type="text" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="اسم المستلم" className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">رقم هاتف المستلم</label>
                                <input type="text" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="09XXXXXXXX" className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left" dir="ltr" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">طريقة الدفع</label>
                                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                                    <option value="عند الاستلام">عند الاستلام</option>
                                    <option value="تحويل بنكي">تحويل بنكي</option>
                                    <option value="مختلطة">مختلطة</option>
                                </select>
                            </div>
                        </div>

                        {/* القسم الثاني: تفاصيل العنوان والشحن */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">الدولة</label>
                                <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all">
                                    <option value="">اختر الدولة</option>
                                    <option value="تركيا">تركيا</option>
                                    <option value="سوريا">سوريا</option>
                                    <option value="العراق">العراق</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">المدينة / المنطقة</label>
                                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">البلدية</label>
                                <input type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                            </div>
                        </div>

                        {/* القسم الثالث: الشحن والملاحظات */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">عنوان التسليم التفصيلي</label>
                                <input type="text" value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">شركة الشحن</label>
                                <input type="text" value={shippingCompany} onChange={(e) => setShippingCompany(e.target.value)} placeholder="اسم الشركة..." className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-2">كود التتبع (Tracking)</label>
                                <input type="text" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="رقم الشحنة..." className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left" dir="ltr" />
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

            <AppModal size='full' isOpen={isOpenordercustomer} onClose={() => setisOpenordercustomer(false)} title='طلبات العميل'>
                <ViewOrderCustomer orders={ordercustomer} />
            </AppModal>

            <AppModal size='full' isOpen={isOpenorder} onClose={() => setisOpenorder(false)} title='ملخص الطلب' >
                <ViewOrder data={order} products={products} />
            </AppModal>
        </div>
    );
};

function ViewOrder({ data, products }: { data: any, products: any }) {
    const componentRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `فاتورة-${data.orderNumber}`,
        onAfterPrint: () => console.log("تمت الطباعة بنجاح"),
    });

    const totalDiscount = Number(data.discount) || 0;
    const finalAmount = Number(data.finalAmount) || 0;
    const subtotal = finalAmount + totalDiscount;

    const getProductName = (productId: any) => {
        const product = products?.find((p: any) => p.id === productId);
        return product ? product.name : `منتج رقم #${productId}`;
    };

    return (
        <div className="p-10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-50 min-h-screen">

            {/* زر الطباعة */}
            <div className="flex justify-end p-4 bg-white dark:bg-slate-900 no-print">
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                    <Printer size={20} />
                    طباعة الفاتورة
                </button>
            </div>

            <div ref={componentRef} className="p-10 bg-white dark:bg-slate-900" dir="rtl">
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
                    <div className="flex justify-between items-start mb-10 pb-8 border-b-2 border-slate-100">
                        <div className="flex items-baseline gap-4">
                            <h1 className="text-5xl font-black text-blue-600 tracking-tighter italic">SKYNOVA</h1>
                            <span className="text-2xl font-bold text-slate-400">| فاتورة مبيعات</span>
                        </div>
                        <div className="text-left space-y-1 text-sm text-slate-500 font-bold">
                            <p>رقم الفاتورة: <span className="text-slate-900 dark:text-white font-mono">#{data.orderNumber}</span></p>
                            <p>تاريخ الإصدار: <span className="text-slate-900 dark:text-white">{data.createdAt instanceof Date ? data.createdAt.toLocaleDateString('ar-EG') : String(data.createdAt)}</span></p>
                        </div>
                    </div>

                    {/* تفاصيل العميل والمستلم والعنوان */}
                    <div className="grid grid-cols-1 gap-8 mb-12">
                        <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100/50">
                            <h3 className="text-blue-600 font-black text-sm mb-3 uppercase tracking-wider">العميل المحاسب</h3>
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
                                <p>رقم التواصل: {data.receiverPhone.join(" - ") || 'لم يسجل'}</p>
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
                    <div className="overflow-x-auto rounded-[2rem] border border-slate-100 mb-8">
                        <table className="w-full text-right">
                            <thead className='border border-slate-600'>
                                <tr className="bg-slate-900 text-white">
                                    <th className="px-8 py-2 font-black text-sm">المنتج</th>
                                    <th className="px-8 py-2 font-black text-sm text-center">الكمية</th>
                                    <th className="px-8 py-2 font-black text-sm text-center">السعر</th>
                                    <th className="px-8 py-2 font-black text-sm text-left">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.items?.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-8 py-2">
                                            <p className="font-black text-slate-800 dark:text-slate-100">{getProductName(item.productId)}</p>
                                        </td>
                                        <td className="px-8 py-2 text-center font-bold text-slate-600 italic">x{item.quantity}</td>
                                        <td className="px-8 py-2 text-center font-bold text-slate-600">{Number(item.price).toLocaleString()} $</td>
                                        <td className="px-8 py-2 text-left font-black text-slate-900 dark:text-white">{(item.price * item.quantity).toLocaleString()} $</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-end gap-10">
                        {/* ملاحظات قانونية */}
                        <div className="text-slate-400 text-xs font-bold leading-relaxed flex-1">
                            * هذه الفاتورة صدرت إلكترونياً وهي وثيقة رسمية.
                            <br />
                            * شكراً لتعاملك مع SKYNOVA.
                        </div>

                        {/* ملخص الحسابات */}
                        <div className="w-96 space-y-3">
                            <div className="flex justify-between px-6 text-slate-500 font-bold text-sm">
                                <span>المجموع الفرعي:</span>
                                <span>{subtotal.toLocaleString()} $</span>
                            </div>

                            {totalDiscount > 0 && (
                                <div className="flex justify-between px-6 text-rose-500 font-bold text-sm">
                                    <span>الخصم الممنوح:</span>
                                    <span>-{totalDiscount.toLocaleString()} $</span>
                                </div>
                            )}

                            {/* عرض تفاصيل الدفع المختلط */}
                            {data.paymentMethod === "مختلطة" && (
                                <div className="border-t border-b border-dashed border-slate-200 py-3 space-y-2">
                                    <div className="flex justify-between px-6 text-blue-600 font-bold text-sm">
                                        <span>القيمة المستلمة (حوالة):</span>
                                        <span>{Number(data.amount).toLocaleString()} $</span>
                                    </div>
                                    <div className="flex justify-between px-6 text-purple-600 font-bold text-sm">
                                        <span>القيمة المتبقية (عند الباب):</span>
                                        <span>{Number(data.amountBank).toLocaleString()} $</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center p-6 bg-blue-600 rounded-[2rem] text-white shadow-xl">
                                <span className="text-xl font-black">الإجمالي النهائي</span>
                                <div className="text-right">
                                    <span className="text-3xl font-black italic tracking-tighter">
                                        {finalAmount.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-bold mr-1"> $</span>
                                </div>
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
                                    {Number(order.finalAmount).toLocaleString()} <span className="text-xs">ل.س</span>
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
                                                    {Number(item.price).toLocaleString()} ل.س
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
export default OrderLayout;
