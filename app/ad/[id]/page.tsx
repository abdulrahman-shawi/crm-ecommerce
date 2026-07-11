import { notFound } from 'next/navigation';
import AffiliateProductLanding from '@/components/pages/affiliate/AffiliateProductLanding';
import AdPageTracker from '@/components/pages/affiliate/AdPageTracker';
import { getPublicAdProductById } from '@/server/product';

type AdProductPageProps = {
  params: { id: string };
};

export default async function AdProductPage({ params }: AdProductPageProps) {
  const result = await getPublicAdProductById(params.id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <>
      <AdPageTracker productId={result.data.id} />
      <AffiliateProductLanding product={result.data} />
    </>
  );
}