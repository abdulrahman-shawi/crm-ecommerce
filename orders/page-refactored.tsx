// "use client"
// import React from 'react';
// import { AppModal } from '@/components/ui/app-modal';
// import { Button } from '@/components/ui/button';
// import { useAuth } from '@/context/AuthContext';
// import { hasPermission, isAdmin } from '@/lib/utils';
// import { deleteOrder, updateStaus, updateOrderShippingFromTable, getOrdersByUser } from '@/server/order';
// import { AnimatePresence, motion } from 'framer-motion';
// import { Plus, Printer, Download } from 'lucide-react';
// import toast from 'react-hot-toast';
// import { useReactToPrint } from 'react-to-print';

// // استيراد الـ Hooks
// import { useOrderForm, useOrderData, useOrderFilters, useOrderExport } from '@/hooks';

// // استيراد المكونات
// import { StatusCards, SearchAndFilter, ShippingModal, OrderTable } from '@/components/orders';

// // استيراد المكونات الموجودة
// import OrderCustomer from '@/components/pages/customers/orderCustomer';
// import OrderCustomerEdit from '@/components/pages/customers/orderCustomerEdit';
// import ViewOrderCustomer from '@/components/pages/customers/ViewOrderCustomer';
// import ViewOrder from '@/components/pages/customers/ViewOrder';

// interface IOrderLayoutProps {}

// const OrderLayout: React.FunctionComponent<IOrderLayoutProps> = (props) => {
//   const { user } = useAuth();
  
//   // استخدام الـ Hooks
//   const orderForm = useOrderForm(user?.id);
//   const orderData = useOrderData(user);
//   const orderFilters = useOrderFilters(
//     orderData.orders,
//     user,
//     hasPermission(user, 'view_orders'),
//     isAdmin(user),
//     hasPermission(user, 'warehouse_access'),
//     user?.warehouseLocations || []
//   );
//   const orderExport = useOrderExport();

//   // حالات إضافية للمودالات
//   const [isOpen, setIsOpen] = React.useState(false);
//   const [isOpenorder, setisOpenorder] = React.useState(false);
//   const [isOpenordercustomer, setisOpenordercustomer] = React.useState(false);
//   const [order, setorder] = React.useState<any>({});
//   const [ordercustomer, setordercustomer] = React.useState<any[]>([]);

//   // حالة الشحن
//   const [isShippingModalOpen, setIsShippingModalOpen] = React.useState(false);
//   const [shippingModalSaving, setShippingModalSaving] = React.useState(false);
//   const [shippingTargetOrder, setShippingTargetOrder] = React.useState<any>(null);
//   const [shippingForm, setShippingForm] = React.useState({
//     shippingCompanyName: "",
//     shippingPrice: "0",
//     moneyTransferCommission: "0",
//     otherCommissions: "0",
//   });

//   const importInputRef = React.useRef<HTMLInputElement | null>(null);
//   const printRef = React.useRef<HTMLDivElement>(null);

//   // استخراج خيارات شركات الشحن
//   const shippingCompanyOptions = orderData.shippingCompanies.map((s: any) => s.name || "");

//   // استخراج خيارات المستودعات
//   const warehouseOptions = Array.from(
//     new Set(orderData.orders.map((o: any) => o.warehouse?.location).filter(Boolean))
//   ) as string[];

//   // معالجات الأحداث
//   const handleViewOrder = (orderData: any) => {
//     setorder(orderData);
//     setisOpenorder(true);
//   };

//   const handleEditOrder = (orderData: any) => {
//     orderForm.loadOrderForEdit(orderData);
//     setIsOpen(true);
//   };

//   const handleDeleteOrder = async (orderId: string | number) => {
//     try {
//       const res = await deleteOrder(orderId);
//       if (res.success) {
//         toast.success("تم حذف الطلب بنجاح");
//         orderData.refreshOrders();
//       } else {
//         toast.error(res.message || "فشل حذف الطلب");
//       }
//     } catch (error) {
//       console.error("Delete error:", error);
//       toast.error("حدث خطأ في حذف الطلب");
//     }
//   };

//   const handleStatusChange = async (newStatus: string, orderId: string | number) => {
//     try {
//       const res = await updateStaus(orderId, newStatus);
//       if (res.success) {
//         toast.success("تم تحديث حالة الطلب بنجاح");
//         orderData.refreshOrders();
//       } else {
//         toast.error(res.message || "فشل تحديث الحالة");
//       }
//     } catch (error) {
//       console.error("Status update error:", error);
//       toast.error("حدث خطأ في تحديث الحالة");
//     }
//   };

//   const handleOpenShippingModal = (orderData: any) => {
//     setShippingTargetOrder(orderData);
//     setShippingForm({
//       shippingCompanyName: orderData?.shipping?.name || "",
//       shippingPrice: String(orderData?.shippingPrice || 0),
//       moneyTransferCommission: String(orderData?.moneyTransferCommission || 0),
//       otherCommissions: String(orderData?.otherCommissions || 0),
//     });
//     setIsShippingModalOpen(true);
//   };

//   const handleSaveShippingModal = async () => {
//     if (!shippingTargetOrder) return;

//     setShippingModalSaving(true);
//     try {
//       const res = await updateOrderShippingFromTable(shippingTargetOrder.id, {
//         shippingCompanyName: shippingForm.shippingCompanyName,
//         shippingPrice: Number(shippingForm.shippingPrice),
//         moneyTransferCommission: Number(shippingForm.moneyTransferCommission),
//         otherCommissions: Number(shippingForm.otherCommissions),
//       });

//       if (res.success) {
//         toast.success("تم تحديث بيانات الشحن بنجاح");
//         setIsShippingModalOpen(false);
//         setShippingTargetOrder(null);
//         orderData.refreshOrders();
//       } else {
//         toast.error(res.message || "فشل تحديث بيانات الشحن");
//       }
//     } catch (error) {
//       console.error("Shipping update error:", error);
//       toast.error("حدث خطأ في تحديث بيانات الشحن");
//     } finally {
//       setShippingModalSaving(false);
//     }
//   };

//   const handleShowOrderCustomer = async (customerId: any) => {
//     const res = await getOrdersByUser(customerId);
//     if (res.success) {
//       setordercustomer(res.data);
//       setisOpenordercustomer(true);
//     }
//   };

//   const handleSubmitOrder = async () => {
//     const success = await orderForm.handleSubmit();
//     if (success) {
//       orderForm.resetForm();
//       setIsOpen(false);
//       orderData.refreshOrders();
//     }
//   };

//   const handleExportOrders = async () => {
//     await orderExport.exportToExcel(orderFilters.visibleOrders);
//   };

//   const handleImportClick = () => {
//     importInputRef.current?.click();
//   };

//   const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     // يمكن إضافة منطق الاستيراد هنا
//     toast.info("يرجى تطبيق منطق الاستيراد من الملف الأصلي");
//     event.target.value = "";
//   };

//   const handlePrint = useReactToPrint({
//     content: () => printRef.current,
//   });

//   // إعادة تعيين النموذج عند إغلاق المودال
//   const handleCloseOrderModal = () => {
//     setIsOpen(false);
//     orderForm.resetForm();
//   };

//   return (
//     <div className="space-y-6 p-6">
//       {/* رأس الصفحة */}
//       <div className="flex justify-between items-center mb-6">
//         <h1 className="text-3xl font-bold text-slate-900 dark:text-white">إدارة الطلبات</h1>
//         <Button
//           onClick={() => setIsOpen(true)}
//           className="flex items-center gap-2"
//         >
//           <Plus className="w-5 h-5" />
//           طلب جديد
//         </Button>
//       </div>

//       {/* بطاقات الحالات */}
//       <StatusCards
//         statusOptions={orderFilters.statusOptions}
//         statusCounts={orderFilters.statusCounts}
//         statusFilter={orderFilters.statusFilter}
//         onStatusChange={orderFilters.setStatusFilter}
//       />

//       {/* البحث والفلاتر */}
//       <SearchAndFilter
//         searchQuery={orderFilters.searchQuery}
//         onSearchChange={orderFilters.setSearchQuery}
//         warehouseLocation={orderFilters.warehouseLocation}
//         onWarehouseChange={orderFilters.setWarehouseLocation}
//         monthFilterType={orderFilters.monthFilterType}
//         onMonthFilterChange={orderFilters.setMonthFilterType}
//         customMonth={orderFilters.customMonth}
//         onCustomMonthChange={orderFilters.setCustomMonth}
//         warehouseOptions={warehouseOptions}
//         onExport={handleExportOrders}
//         onImport={handleImportClick}
//         isExporting={orderExport.isExporting}
//       />

//       {/* جدول الطلبات */}
//       <OrderTable
//         orders={orderFilters.paginatedOrders}
//         onView={handleViewOrder}
//         onEdit={handleEditOrder}
//         onDelete={handleDeleteOrder}
//         onStatusChange={handleStatusChange}
//         onShippingEdit={handleOpenShippingModal}
//         isLoading={orderData.isLoading}
//       />

//       {/* الترقيم */}
//       <div className="flex justify-center gap-2 mt-6">
//         {Array.from({ length: orderFilters.totalPages }, (_, i) => i + 1).map((pageNum) => (
//           <button
//             key={pageNum}
//             onClick={() => orderFilters.setPage(pageNum)}
//             className={`px-3 py-2 rounded-lg border ${
//               orderFilters.page === pageNum
//                 ? "bg-blue-600 text-white border-blue-600"
//                 : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
//             }`}
//           >
//             {pageNum}
//           </button>
//         ))}
//       </div>

//       {/* مودال الطلب الجديد/التعديل */}
//       <AppModal
//         size="full"
//         isOpen={isOpen}
//         onClose={handleCloseOrderModal}
//         title={orderForm.editId ? "تعديل الطلب" : "طلب جديد"}
//       >
//         <OrderCustomerEdit
//           items={orderForm.items}
//           setItems={orderForm.setItems}
//           customers={orderData.customers}
//           customerId={orderForm.customerId}
//           setCustomerId={orderForm.setCustomerId}
//           products={orderData.products}
//           isOpenOrder={isOpen}
//           setisOpenOrder={setIsOpen}
//           editId={orderForm.editId}
//           setEditId={orderForm.setEditId}
//           getData={orderData.refreshOrders}
//           receiverName={orderForm.receiverName}
//           setReceiverName={orderForm.setReceiverName}
//           receiverPhone={orderForm.receiverPhone}
//           setReceiverPhone={orderForm.setReceiverPhone}
//           country={orderForm.country}
//           setCountry={orderForm.setCountry}
//           city={orderForm.city}
//           setCity={orderForm.setCity}
//           municipality={orderForm.municipality}
//           setMunicipality={orderForm.setMunicipality}
//           fullAddress={orderForm.fullAddress}
//           setFullAddress={orderForm.setFullAddress}
//           paymentMethod={orderForm.paymentMethod}
//           setPaymentMethod={orderForm.setPaymentMethod}
//           amount={orderForm.amount}
//           setAmount={orderForm.setAmount}
//           overallDiscount={orderForm.overallDiscount}
//           setOverallDiscount={orderForm.setOverallDiscount}
//           status={orderForm.status}
//           setStatus={orderForm.setStatus}
//           deliveryNotes={orderForm.deliveryNotes}
//           setDeliveryNotes={orderForm.setDeliveryNotes}
//           additionalNotes={orderForm.additionalNotes}
//           setAdditionalNotes={orderForm.setAdditionalNotes}
//           googleMapsLink={orderForm.googleMapsLink}
//           setGoogleMapsLink={orderForm.setGoogleMapsLink}
//           isSubmitting={orderForm.isSubmitting}
//           handleSubmit={handleSubmitOrder}
//         />
//       </AppModal>

//       {/* مودال عرض طلبات العميل */}
//       <AppModal
//         size="full"
//         isOpen={isOpenordercustomer}
//         onClose={() => setisOpenordercustomer(false)}
//         title="طلبات العميل"
//       >
//         <ViewOrderCustomer orders={ordercustomer} />
//       </AppModal>

//       {/* مودال عرض الطلب */}
//       <AppModal
//         size="full"
//         isOpen={isOpenorder}
//         onClose={() => setisOpenorder(false)}
//         title="ملخص الطلب"
//       >
//         <div ref={printRef}>
//           <ViewOrder data={order} products={orderData.products} onSharePdf={() => {}} />
//         </div>
//         <div className="mt-4 flex gap-2">
//           <Button onClick={handlePrint} className="flex items-center gap-2">
//             <Printer className="w-4 h-4" />
//             طباعة
//           </Button>
//         </div>
//       </AppModal>

//       {/* مودال بيانات الشحن */}
//       <ShippingModal
//         isOpen={isShippingModalOpen}
//         onClose={() => {
//           if (shippingModalSaving) return;
//           setIsShippingModalOpen(false);
//           setShippingTargetOrder(null);
//         }}
//         shippingForm={shippingForm}
//         onFormChange={setShippingForm}
//         shippingCompanyOptions={shippingCompanyOptions}
//         onSave={handleSaveShippingModal}
//         isSaving={shippingModalSaving}
//         targetOrder={shippingTargetOrder}
//       />

//       {/* حقل الاستيراد المخفي */}
//       <input
//         ref={importInputRef}
//         type="file"
//         accept=".xlsx,.xls,.csv"
//         onChange={handleImportFile}
//         className="hidden"
//       />
//     </div>
//   );
// };

// export default OrderLayout;
