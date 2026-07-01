'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { getAffiliateUsersAdminList, setAffiliateUserApproval } from '@/server/affiliate';

type AffiliateUserRow = {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  jobTitle?: string | null;
  isAffiliate: boolean;
  affiliateApproved: boolean;
  affiliateRequestedAt?: string | Date | null;
  affiliateApprovedAt?: string | Date | null;
  createdAt?: string | Date;
  affiliateLinks?: Array<{ id: string }>;
};

type AffiliateUsersPayload = {
  summary: {
    total: number;
    pending: number;
    approved: number;
  };
  users: AffiliateUserRow[];
};

const defaultPayload: AffiliateUsersPayload = {
  summary: {
    total: 0,
    pending: 0,
    approved: 0,
  },
  users: [],
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ar');
};

export default function AffiliateUsersPage() {
  const [payload, setPayload] = React.useState<AffiliateUsersPayload>(defaultPayload);
  const [loading, setLoading] = React.useState(true);
  const [savingByUser, setSavingByUser] = React.useState<Record<string, boolean>>({});

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAffiliateUsersAdminList();
      if (!result.success || !result.data) {
        toast.error(result.error || 'تعذر جلب مستخدمي الأفلييت');
        setPayload(defaultPayload);
        return;
      }
      setPayload(result.data as AffiliateUsersPayload);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprovalChange = async (userId: string, approved: boolean) => {
    setSavingByUser((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await setAffiliateUserApproval(userId, approved);
      if (!result.success) {
        toast.error(result.error || 'تعذر تحديث حالة الموافقة');
        return;
      }

      toast.success(approved ? 'تمت الموافقة على حساب الأفلييت' : 'تم إلغاء الموافقة على حساب الأفلييت');
      await loadData();
    } finally {
      setSavingByUser((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">مستخدمو الأفلييت</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">أي حساب أفلييت جديد يبقى بانتظار موافقة الأدمن قبل أن يتمكن من تسجيل الدخول أو استخدام روابط الأفلييت.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي حسابات الأفلييت</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{payload.summary.total}</div>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="text-xs font-bold text-amber-700 dark:text-amber-300">بانتظار الموافقة</div>
          <div className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{payload.summary.pending}</div>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">تمت الموافقة</div>
          <div className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{payload.summary.approved}</div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">قائمة الطلبات</h2>
          {loading ? <span className="text-sm text-slate-500">جاري التحميل...</span> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-3">المستخدم</th>
                <th className="px-3 py-3">الوظيفة</th>
                <th className="px-3 py-3">الهاتف</th>
                <th className="px-3 py-3">تاريخ الطلب</th>
                <th className="px-3 py-3">تاريخ الموافقة</th>
                <th className="px-3 py-3">عدد الروابط</th>
                <th className="px-3 py-3">الحالة</th>
                <th className="px-3 py-3">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {payload.users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="px-3 py-4">
                    <div className="font-black text-slate-900 dark:text-white">{user.username}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    {user.notes ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.notes}</div> : null}
                  </td>
                  <td className="px-3 py-4">{user.jobTitle || '-'}</td>
                  <td className="px-3 py-4">{user.phone || '-'}</td>
                  <td className="px-3 py-4">{formatDate(user.affiliateRequestedAt || user.createdAt)}</td>
                  <td className="px-3 py-4">{formatDate(user.affiliateApprovedAt)}</td>
                  <td className="px-3 py-4">{Array.isArray(user.affiliateLinks) ? user.affiliateLinks.length : 0}</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${user.affiliateApproved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                      {user.affiliateApproved ? 'موافق عليه' : 'معلق'}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprovalChange(user.id, true)}
                        disabled={savingByUser[user.id] || user.affiliateApproved}
                        className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        موافقة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprovalChange(user.id, false)}
                        disabled={savingByUser[user.id] || !user.affiliateApproved}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        إلغاء الموافقة
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && payload.users.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">لا توجد حسابات أفلييت حتى الآن.</p>
        ) : null}
      </section>
    </div>
  );
}