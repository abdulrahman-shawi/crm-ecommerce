'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { createAffiliateLinkByAdmin, getAffiliateAdminDashboard, updateAffiliateCommissionStatus } from '@/server/affiliate';

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

  const handleCommissionStatusChange = async (commissionId: string, status: 'PENDING' | 'PAID' | 'CANCELLED') => {
    const result = await updateAffiliateCommissionStatus(commissionId, status);
    if (!result.success) {
      toast.error(result.error || 'تعذر تحديث حالة العمولة');
      return;
    }

    toast.success('تم تحديث حالة العمولة');
    await loadData();
  };

  const getCommissionStatusLabel = (status: string) => {
    if (status === 'PAID') return 'مدفوعة';
    if (status === 'CANCELLED') return 'ملغاة';
    return 'معلقة';
  };

  const affiliateOrders = React.useMemo(() => {
    return data.commissions.map((commission) => ({
      id: String(commission.id),
      orderNumber: commission.order?.orderNumber || '-',
      orderStatus: commission.order?.status || '-',
      customerName: commission.order?.customer?.name || '-',
      productName: commission.affiliateLink?.product?.name || '-',
      affiliateUser: commission.affiliateLink?.user?.username || '-',
      linkCode: commission.affiliateLink?.uniqueCode || '-',
      finalAmount: Number(commission.order?.finalAmount || 0),
      commissionAmount: Number(commission.amount || 0),
      commissionStatus: String(commission.status || 'PENDING'),
      createdAt: commission.order?.createdAt || commission.createdAt,
    }));
  }, [data.commissions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Affiliate Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">إدارة روابط الإحالة والعمولات من نفس الـ Workflow الحالي.</p>
        </div>
        <Link
          href="/dashboard/affiliate/users"
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          إدارة مستخدمي الأفلييت
        </Link>
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
          <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950" value={form.productId} onChange={(e) => setForm((prev) => {
            const selectedRate = Number(data.products.find((item) => String(item.id) === e.target.value)?.affiliateCommissionRate || 0);

            return {
              ...prev,
              productId: e.target.value,
              commissionRate: selectedRate > 0 ? String(selectedRate) : prev.commissionRate,
            };
          })}>
            <option value="">اختر المنتج</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">نسبة العمولة</label>
          <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950" value={form.commissionRate} onChange={(e) => setForm((prev) => ({ ...prev, commissionRate: e.target.value }))} />
          {selectedProduct ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {Number(selectedProduct.affiliateCommissionRate || 0) > 0
                ? 'سيتم استخدام نسبة المنتج عند إنشاء العمولة.'
                : 'إذا كانت نسبة المنتج فارغة أو 0 فسيتم استخدام نسبة الرابط.'}
            </p>
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
                  <span>{getCommissionStatusLabel(String(commission.status || 'PENDING'))}</span>
                  <span>{commission.order?.status || '-'}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  العميل: {commission.order?.customer?.name || '-'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCommissionStatusChange(String(commission.id), 'PENDING')}
                    className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50"
                  >
                    جعلها معلقة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCommissionStatusChange(String(commission.id), 'PAID')}
                    className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                  >
                    اعتماد كمدفوعة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCommissionStatusChange(String(commission.id), 'CANCELLED')}
                    className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    إلغاء العمولة
                  </button>
                </div>
              </div>
            ))}
            {data.commissions.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد عمولات حتى الآن.</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">الطلبات المرتبطة بروابط الأفلييت</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">الطلب الذي تصبح حالته تم التسليم أو تم البيع يتحول تلقائياً إلى عمولة مدفوعة.</p>
          </div>
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{affiliateOrders.length} طلب</div>
        </div>

        {affiliateOrders.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد طلبات مرتبطة بروابط الأفلييت حتى الآن.</p>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[1100px] text-right text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3">رقم الطلب</th>
                  <th className="px-3 py-3">الحالة</th>
                  <th className="px-3 py-3">العمولة</th>
                  <th className="px-3 py-3">المنتج</th>
                  <th className="px-3 py-3">الأفلييت</th>
                  <th className="px-3 py-3">العميل</th>
                  <th className="px-3 py-3">الإجمالي</th>
                  <th className="px-3 py-3">الكود</th>
                  <th className="px-3 py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {affiliateOrders.map((order) => (
                  <tr key={order.id} className="odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-950 dark:even:bg-slate-900/30">
                    <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{order.orderNumber}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-700 dark:text-slate-200">{order.orderStatus}</div>
                      <div className={`text-xs font-bold ${order.commissionStatus === 'PAID' ? 'text-emerald-600' : order.commissionStatus === 'CANCELLED' ? 'text-rose-600' : 'text-amber-600'}`}>
                        {getCommissionStatusLabel(order.commissionStatus)}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-bold text-emerald-600">{order.commissionAmount.toFixed(2)}</td>
                    <td className="px-3 py-3">{order.productName}</td>
                    <td className="px-3 py-3">{order.affiliateUser}</td>
                    <td className="px-3 py-3">{order.customerName}</td>
                    <td className="px-3 py-3">{order.finalAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-600 dark:text-slate-300">{order.linkCode}</td>
                    <td className="px-3 py-3">{new Date(order.createdAt).toLocaleDateString('ar')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}