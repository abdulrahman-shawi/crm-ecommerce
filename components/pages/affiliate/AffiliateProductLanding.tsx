import Image from 'next/image';
import Link from 'next/link';
import AffiliateProductOrderForm from '@/components/pages/affiliate/AffiliateProductOrderForm';

type ProductView = {
  id: number;
  name: string;
  description?: string | null;
  affiliatePrice?: number | null;
  images?: Array<{ url?: string | null }>;
  reviews?: Array<{ id: string | number; name?: string | null; rating?: number | null; comment?: string | null }>;
  stocks?: Array<{ price?: number | null }>;
  landingPage?: {
    badgeText?: string | null;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    heroDescription?: string | null;
    quantityDiscountTiers?: Array<{ minQuantity?: number | null; discountPercent?: number | null }> | null;
    showGuarantee?: boolean | null;
    guaranteeTitle?: string | null;
    guaranteeText?: string | null;
    showReviews?: boolean | null;
    discountPercent?: number | null;
    ctaText?: string | null;
    features?: Array<{ title?: string | null; description?: string | null }>;
  } | null;
};

type AffiliateProductLandingProps = {
  product: ProductView;
  affiliateCode?: string;
  productLinkHref?: string;
};

export default function AffiliateProductLanding({ product, affiliateCode = '', productLinkHref }: AffiliateProductLandingProps) {
  const mainImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0]?.url : null;
  const features = Array.isArray(product.landingPage?.features) ? product.landingPage.features : [];
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7,transparent_35%),linear-gradient(180deg,#fff7ed_0%,#ffffff_45%,#f8fafc_100%)]" dir="rtl">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:py-14">
        <div className="space-y-6 rounded-[32px] border border-amber-100 bg-white/90 p-6 shadow-[0_25px_70px_rgba(245,158,11,0.12)] backdrop-blur md:p-8">
          <div className="inline-flex rounded-full bg-amber-100 px-4 py-1 text-sm font-bold text-amber-800">
            {product.landingPage?.badgeText || 'عرض خاص'}
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black leading-tight text-slate-900 md:text-5xl">
              {product.landingPage?.heroTitle || product.name}
            </h1>
            {product.landingPage?.heroSubtitle ? (
              <p className="text-lg font-bold text-amber-700">{product.landingPage.heroSubtitle}</p>
            ) : null}
            <div
              className="prose max-w-none text-right prose-p:text-slate-600 prose-headings:text-slate-900"
              dangerouslySetInnerHTML={{
                __html: product.landingPage?.heroDescription || product.description || '',
              }}
            />
          </div>

          {features.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {features.map((feature, index) => (
                <div key={`${feature.title || 'feature'}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="text-base font-black text-slate-900">{feature.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          ) : null}

          {product.landingPage?.showGuarantee ? (
            <div className="rounded-3xl bg-slate-900 p-5 text-white">
              <h2 className="text-xl font-black">{product.landingPage?.guaranteeTitle || 'ضمان الجودة'}</h2>
              <p className="mt-2 text-sm text-slate-200">{product.landingPage?.guaranteeText || 'نلتزم بتقديم منتج مطابق للمواصفات مع تجربة شراء واضحة وسهلة.'}</p>
            </div>
          ) : null}

          {product.landingPage?.showReviews && reviews.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-slate-900">آراء العملاء</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-slate-900">{review.name}</span>
                      <span className="text-sm font-bold text-amber-600">{review.rating}/5</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{review.comment || 'تجربة ممتازة.'}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-[32px] border border-amber-100 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
            {mainImage ? (
              <Image src={mainImage} alt={product.name} width={1200} height={900} className="h-[360px] w-full object-cover" />
            ) : (
              <div className="flex h-[360px] items-center justify-center bg-gradient-to-br from-amber-100 to-orange-50 text-2xl font-black text-amber-700">
                {product.name}
              </div>
            )}
            <div className="space-y-3 p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-500">السعر المعتمد للأفلييت</p>
                  <p className="text-3xl font-black text-slate-900">
                    {(Number(product.affiliatePrice || 0) > 0 ? Number(product.affiliatePrice) : Number(product.stocks?.[0]?.price || 0)).toFixed(2)}
                  </p>
                </div>
                {product.landingPage?.discountPercent ? (
                  <div className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-black text-rose-700">
                    خصم {product.landingPage.discountPercent}%
                  </div>
                ) : null}
              </div>
              <p className="text-sm text-slate-500">سيتم الطلب مباشرة من نفس الصفحة بدون تحويل رابط الإحالة.</p>
              {productLinkHref ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-slate-700">
                  <span className="font-bold text-slate-900">رابط المنتج المرتبط:</span>{' '}
                  <Link href={productLinkHref} className="break-all font-bold text-blue-700 hover:underline" dir="ltr">
                    {productLinkHref}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <AffiliateProductOrderForm product={product} affiliateCode={affiliateCode} />
        </div>
      </section>
    </main>
  );
}