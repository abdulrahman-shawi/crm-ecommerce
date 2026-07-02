import { notFound } from 'next/navigation';
import AffiliateProductLanding from '@/components/pages/affiliate/AffiliateProductLanding';
import { getPublicProductBySlug } from '@/server/product';

type ProductPageProps = {
  params: { slug: string };
  searchParams?: { ref?: string | string[] };
};

export default async function PublicProductPage({ params, searchParams }: ProductPageProps) {
  const result = await getPublicProductBySlug(params.slug);

  if (!result.success || !result.data) {
    notFound();
  }

  const product = result.data;
  const affiliateCode = Array.isArray(searchParams?.ref)
    ? String(searchParams.ref[0] || '').trim()
    : String(searchParams?.ref || '').trim();
  return <AffiliateProductLanding product={product} affiliateCode={affiliateCode} />;
}