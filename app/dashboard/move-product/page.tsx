"use client"
import React, { useState, useEffect } from "react";
import { getInventoryData, createMovementAction } from "@/server/move";
import { Package, Plus, X, MapPin, Moon, Sun, ArrowRightLeft } from "lucide-react";

export default function InventoryPage() {
  const [data, setData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // الفلاتر
  const [viewCountry, setViewCountry] = useState("الكل");
  const [modalCountry, setModalCountry] = useState("تركيا");
  const [movementType, setMovementType] = useState("IN");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");

  useEffect(() => { loadData(); }, []);
  const loadData = () => getInventoryData().then(setData);

  if (!data) return <div className="h-screen flex items-center justify-center dark:bg-slate-950 dark:text-white font-bold">جاري تحميل البيانات...</div>;

  const filteredStocks = data.stocks.filter((s:any) => viewCountry === "الكل" || s.warehouse.location === viewCountry);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await createMovementAction({
      productId: Number(formData.get("productId")),
      warehouseId: Number(formData.get("warehouseId")),
      targetWarehouseId: formData.get("targetWarehouseId") ? Number(formData.get("targetWarehouseId")) : null,
      quantity: Number(formData.get("quantity")),
      type: movementType,
      reason: formData.get("reason"),
    });
    if (res.success) { setIsModalOpen(false); loadData(); setSourceWarehouseId(""); }
    setLoading(false);
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen p-6 transition-colors duration-500 bg-slate-50 dark:bg-slate-950 text-right" dir="rtl">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <Package className="text-blue-600" size={32} /> إدارة المخزون
            </h1>
            <div className="flex gap-2 mt-4">
              {["الكل", "تركيا", "سوريا"].map(c => (
                <button key={c} onClick={() => setViewCountry(c)} className={`px-5 py-1.5 rounded-full text-sm font-bold border transition ${viewCountry === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800 dark:text-white shadow-sm transition-transform active:scale-90">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => { setMovementType("IN"); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl flex items-center gap-2 transition-all">
              <Plus size={20}/> حركة مخزنية
            </button>
          </div>
        </header>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 shadow-2xl overflow-hidden overflow-x-auto transition-colors">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs text-center">
              <tr>
                <th className="p-6 text-right">اسم المنتج</th>
                <th className="p-6 text-right">المستودع</th>
                <th className="p-6">البلد</th>
                <th className="p-6">الكمية الحالية</th>
                <th className="p-6">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredStocks.map((stock: any) => (
                <tr key={`${stock.productId}-${stock.warehouseId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition text-center">
                  <td className="p-6 text-right font-bold dark:text-slate-200">{stock.product.name}</td>
                  <td className="p-6 text-right text-slate-500 dark:text-slate-400"><MapPin size={14} className="inline ml-1 opacity-50"/> {stock.warehouse.name}</td>
                  <td className="p-6"><span className={`px-3 py-1 rounded-lg text-[10px] font-black ${stock.warehouse.location === 'سوريا' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>{stock.warehouse.location}</span></td>
                  <td className="p-6 text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">{stock.quantity}</td>
                  <td className="p-6">
                    <button onClick={() => { setMovementType("ADJUSTMENT"); setModalCountry(stock.warehouse.location); setSourceWarehouseId(stock.warehouseId.toString()); setIsModalOpen(true); }} className="text-sm font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition underline underline-offset-4">جرد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border dark:border-slate-800 overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-black text-xl dark:text-white">إضافة حركة: {modalCountry}</h3>
                <button onClick={() => setIsModalOpen(false)} className="dark:text-white hover:text-red-500"><X /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                  {["تركيا", "سوريا"].map(c => (
                    <button key={c} type="button" onClick={() => { setModalCountry(c); setSourceWarehouseId(""); }} className={`flex-1 py-3 rounded-xl font-bold transition ${modalCountry === c ? 'bg-white dark:bg-slate-700 dark:text-white shadow-md' : 'text-slate-400'}`}>{c}</button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold dark:text-slate-500 uppercase mr-2">نوع العملية</label>
                  <select className="w-full p-4 bg-slate-50 dark:bg-slate-950 dark:text-white border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                    <option value="IN">توريد بضاعة (IN)</option>
                    <option value="OUT">بيع / صرف (OUT)</option>
                    <option value="TRANSFER">تحويل مخزني (Transfer)</option>
                    <option value="ADJUSTMENT">جرد وتصحيح كمية</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold dark:text-slate-500 uppercase mr-2">المستودع (من / الحالي)</label>
                    <select 
                      name="warehouseId" 
                      value={sourceWarehouseId}
                      onChange={(e) => setSourceWarehouseId(e.target.value)}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-950 dark:text-white border dark:border-slate-800 rounded-2xl outline-none" required
                    >
                      <option value="">اختر المستودع...</option>
                      {data.warehouses.filter((w:any)=>w.location === modalCountry).map((w:any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>

                  {movementType === "TRANSFER" && (
                    <div className="space-y-2 animate-in slide-in-from-right">
                      <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mr-2">إلى مستودع (الوجهة)</label>
                      <select name="targetWarehouseId" className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 dark:text-white border border-blue-200 dark:border-blue-800 rounded-2xl outline-none" required>
                        <option value="">اختر الوجهة...</option>
                        {data.warehouses.map((w:any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold dark:text-slate-500 uppercase mr-2">المنتج</label>
                  {/* استبدل الجزء الخاص باختيار المنتج بهذا الكود */}
<select name="productId" className="w-full p-4 bg-slate-50 dark:bg-slate-950 dark:text-white border dark:border-slate-800 rounded-2xl outline-none" required>
  <option value="">اختر المنتج...</option>
  {(movementType === "IN" 
    ? data.products // في التوريد نظهر كل المنتجات المسجلة في النظام
    : Array.from(new Set(
        data.stocks
          .filter((s: any) => s.warehouse.location === modalCountry)
          .map((s: any) => s.product)
      )) // في الصرف أو التحويل نظهر فقط المنتجات التي لها رصيد في هذا البلد
  ).map((p: any) => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ))}
</select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold dark:text-slate-500 uppercase mr-2">{movementType === 'ADJUSTMENT' ? 'الكمية الفعلية' : 'الكمية'}</label>
                    <input name="quantity" type="number" step="any" className="w-full p-4 bg-slate-50 dark:bg-slate-950 dark:text-white border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold dark:text-slate-500 uppercase mr-2">ملاحظات</label>
                    <input name="reason" className="w-full p-4 bg-slate-50 dark:bg-slate-950 dark:text-white border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 ring-blue-500" />
                  </div>
                </div>

                <button disabled={loading} className="w-full bg-blue-600 dark:bg-blue-500 text-white py-5 rounded-3xl font-black text-xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
                  {loading ? "جاري الحفظ..." : "تأكيد العملية"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}