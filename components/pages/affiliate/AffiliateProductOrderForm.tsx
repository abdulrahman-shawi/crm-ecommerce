'use client';

import * as React from 'react';
import toast from 'react-hot-toast';

type ProductLike = {
  id: number;
  name: string;
  affiliatePrice?: number;
  stocks?: Array<{
    price?: number;
    discount?: number;
    quantity?: number;
    warehouse?: { location?: string };
  }>;
  landingPage?: {
    ctaText?: string | null;
  } | null;
};

const countries = ['سوريا', 'لبنان', 'العراق', 'تركيا', 'ليبيا'];

export default function AffiliateProductOrderForm({ product, affiliateCode = '' }: { product: ProductLike; affiliateCode?: string }) {
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({
    customerName: '',
    phone: '',
    receiverName: '',
    country: 'سوريا',
    city: '',
    municipality: '',
    fullAddress: '',
    deliveryNotes: '',
    quantity: 1,
    stockCountry: 'سوريا',
    paymentMethod: 'عند الاستلام',
  });

  const fallbackPrice = Number(product.stocks?.[0]?.price || 0);
  const unitPrice = Number(product.affiliatePrice || 0) > 0 ? Number(product.affiliatePrice) : fallbackPrice;
  const finalAmount = Number((unitPrice * Number(form.quantity || 1)).toFixed(2));

  React.useEffect(() => {
    const normalizedCode = String(affiliateCode || '').trim();
    if (!normalizedCode || typeof window === 'undefined') {
      return;
    }

    const trackingKey = `affiliate-track:${product.id}:${normalizedCode}`;
    if (window.sessionStorage.getItem(trackingKey) === '1') {
      return;
    }

    window.sessionStorage.setItem(trackingKey, '1');

    void fetch('/api/affiliate/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: normalizedCode,
        productId: product.id,
      }),
      credentials: 'same-origin',
    }).catch(() => {
      window.sessionStorage.removeItem(trackingKey);
    });
  }, [affiliateCode, product.id]);

  const updateField = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim() || !form.receiverName.trim()) {
      toast.error('يرجى تعبئة الاسم ورقم الهاتف واسم المستلم');
      return;
    }

    if (!form.city.trim() || !form.municipality.trim() || !form.fullAddress.trim()) {
      toast.error('يرجى تعبئة بيانات العنوان كاملة');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/affiliate/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: Number(form.quantity || 1),
          customerName: form.customerName,
          phone: form.phone,
          receiverName: form.receiverName,
          country: form.country,
          city: form.city,
          municipality: form.municipality,
          fullAddress: form.fullAddress,
          deliveryNotes: form.deliveryNotes,
          stockCountry: form.stockCountry,
          paymentMethod: form.paymentMethod,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'تعذر إتمام الطلب');
        return;
      }

      toast.success('تم إرسال الطلب بنجاح');
      setForm({
        customerName: '',
        phone: '',
        receiverName: '',
        country: 'سوريا',
        city: '',
        municipality: '',
        fullAddress: '',
        deliveryNotes: '',
        quantity: 1,
        stockCountry: 'سوريا',
        paymentMethod: 'عند الاستلام',
      });
    } catch {
      toast.error('حدث خطأ غير متوقع أثناء إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">اطلب الآن</h2>
          <p className="text-sm text-slate-500">{product.landingPage?.ctaText || 'املأ النموذج وسيتم تأكيد الطلب معك.'}</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-2 text-right">
          <div className="text-xs font-bold text-amber-700">الإجمالي</div>
          <div className="text-2xl font-black text-amber-900">{finalAmount.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>اسم العميل</span>
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.customerName} onChange={(e) => updateField('customerName', e.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>رقم الهاتف</span>
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>اسم المستلم</span>
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.receiverName} onChange={(e) => updateField('receiverName', e.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>الكمية</span>
          <input type="number" min={1} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.quantity} onChange={(e) => updateField('quantity', Number(e.target.value || 1))} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>الدولة</span>
          <select className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.country} onChange={(e) => updateField('country', e.target.value)}>
            {countries.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>بلد المخزون</span>
          <select className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.stockCountry} onChange={(e) => updateField('stockCountry', e.target.value)}>
            <option value="سوريا">سوريا</option>
            <option value="تركيا">تركيا</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>المدينة</span>
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>المنطقة / البلدية</span>
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.municipality} onChange={(e) => updateField('municipality', e.target.value)} />
        </label>
      </div>

      <label className="mt-4 block space-y-2 text-sm font-bold text-slate-700">
        <span>العنوان الكامل</span>
        <textarea className="min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.fullAddress} onChange={(e) => updateField('fullAddress', e.target.value)} />
      </label>

      <label className="mt-4 block space-y-2 text-sm font-bold text-slate-700">
        <span>ملاحظات التوصيل</span>
        <textarea className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-400" value={form.deliveryNotes} onChange={(e) => updateField('deliveryNotes', e.target.value)} />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-4 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'جاري إرسال الطلب...' : 'تأكيد الطلب'}
      </button>
    </form>
  );
}