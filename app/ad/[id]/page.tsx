import { notFound } from 'next/navigation';
import AffiliateProductLanding from '@/components/pages/affiliate/AffiliateProductLanding';
import { getPublicAdProductById } from '@/server/product';

type AdProductPageProps = {
  params: { id: string };
};

export default async function AdProductPage({ params }: AdProductPageProps) {
  const result = await getPublicAdProductById(params.id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <AffiliateProductLanding product={result.data} />;
}