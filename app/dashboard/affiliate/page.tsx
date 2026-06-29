'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { createAffiliateLinkByAdmin, getAffiliateAdminDashboard } from '@/server/affiliate';

type DashboardData = {
  users: Array<{ id: string; username: string; email: string }>;
  products: Array<{ id: number; name: string; affiliatePrice: number; affiliateCommissionRate: number | null }>;
  totalClicks: number;
  totalConversions: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  links: any[];
  commissions: any[];
};

const defaultData: DashboardData = {
  users: [],
  products: [],
  totalClicks: 0,
  totalConversions: 0,
  totalCommissions: 0,
  pendingCommissions: 0,
  paidCommissions: 0,
  links: [],
  commissions: [],
};

export default function AffiliateDashboardPage() {
  const [data, setData] = React.useState<DashboardData>(defaultData);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ userId: '', productId: '', commissionRate: '10' });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAffiliateAdminDashboard();
      if (!result.success || !result.data) {
        toast.error(result.error || 'تعذر جلب بيانات الأفلييت');
        return;
      }
      setData(result.data as DashboardData);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedProduct = data.products.find((item) => String(item.id) === form.productId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.userId || !form.productId) {
      toast.error('اختر المستخدم والمنتج أولاً');
      return;
    }

    const result = await createAffiliateLinkByAdmin({
      userId: form.userId,
      productId: Number(form.productId),
      commissionRate: Number(form.commissionRate || 0),
    });

    if (!result.success) {
      toast.error(result.error || 'تعذر إنشاء الرابط');
      return;
    }

    toast.success('تم إنشاء رابط الإحالة');
    if (result.data?.fullUrl && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(result.data.fullUrl);
      toast.success('تم نسخ الرابط الكامل');
    }
    setForm({ userId: '', productId: '', commissionRate: '10' });
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Affiliate Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">إدارة روابط الإحالة والعمولات من نفس الـ Workflow الحالي.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['إجمالي النقرات', data.totalClicks],
          ['إجمالي التحويلات', data.totalConversions],
          ['إجمالي العمولات', data.totalCommissions.toFixed(2)],
          ['العمولات المعلقة', data.pendingCommissions.toFixed(2)],
          ['العمولات المدفوعة', data.paidCommissions.toFixed(2)],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">المستخدم</label>
          <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950" value={form.userId} onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}>
            <option value="">اختر المستخدم</option>
            {data.users.map((user) => (
              <option key={user.id} value={user.id}>{user.username} - {user.email}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">المنتج</label>
          <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950" value={form.productId} onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value, commissionRate: String(data.products.find((item) => String(item.id) === e.target.value)?.affiliateCommissionRate ?? prev.commissionRate) }))}>
            <option value="">اختر المنتج</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">نسبة العمولة</label>
          <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950" value={form.commissionRate} onChange={(e) => setForm((prev) => ({ ...prev, commissionRate: e.target.value }))} />
          {selectedProduct?.affiliateCommissionRate != null ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">سيتم استخدام نسبة المنتج عند إنشاء العمولة إن كانت موجودة.</p>
          ) : null}
        </div>

        <div className="flex items-end">
          <button type="submit" className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">
            إنشاء الرابط ونسخه
          </button>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">قائمة الروابط</h2>
            {loading ? <span className="text-sm text-slate-500">جاري التحميل...</span> : null}
          </div>
          <div className="space-y-3">
            {data.links.map((link) => (
              <div key={link.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">{link.product?.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{link.user?.username} - {link.uniqueCode}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(link.fullUrl);
                      toast.success('تم نسخ الرابط');
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    نسخ الرابط
                  </button>
                </div>
                <div className="mt-3 break-all rounded-xl bg-white px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{link.fullUrl}</div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  <div className="rounded-xl bg-white p-2 dark:bg-slate-900">Clicks: {link.clicks}</div>
                  <div className="rounded-xl bg-white p-2 dark:bg-slate-900">Conversions: {link.conversions}</div>
                  <div className="rounded-xl bg-white p-2 dark:bg-slate-900">Rate: {Number(link.commissionRate || 0).toFixed(2)}%</div>
                </div>
              </div>
            ))}
            {data.links.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد روابط حتى الآن.</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">قائمة العمولات</h2>
          </div>
          <div className="space-y-3">
            {data.commissions.map((commission) => (
              <div key={commission.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">{commission.affiliateLink?.product?.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{commission.order?.orderNumber} - {commission.affiliateLink?.user?.username}</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-emerald-700 dark:bg-slate-900">{Number(commission.amount || 0).toFixed(2)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>{commission.status}</span>
                  <span>{new Date(commission.createdAt).toLocaleDateString('ar')}</span>
                </div>
              </div>
            ))}
            {data.commissions.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد عمولات حتى الآن.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}