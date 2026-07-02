import { notFound } from 'next/navigation';
import AffiliateProductLanding from '@/components/pages/affiliate/AffiliateProductLanding';
import { getPublicAffiliateProductByCode } from '@/server/product';

type AffiliateRefPageProps = {
  params: { code: string };
};

export default async function AffiliateRefPage({ params }: AffiliateRefPageProps) {
  const result = await getPublicAffiliateProductByCode(params.code);

  if (!result.success || !result.data) {
    notFound();
  }

  const { affiliateCode, product } = result.data;
  const productPathSegment = String(product.seoSlug || product.id || '').trim();
  const productLinkHref = productPathSegment ? `/product/${productPathSegment}?ref=${affiliateCode}` : undefined;

  return (
    <AffiliateProductLanding
      product={product}
      affiliateCode={affiliateCode}
      productLinkHref={productLinkHref}
    />
  );
}