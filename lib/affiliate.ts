const AFFILIATE_BASE_URL = 'https://ecomerce-bay-xi.vercel.app';

export const AFFILIATE_COOKIE_NAME = 'affiliate-code';

export function buildAffiliateFullUrl(
  seoSlug?: string | null,
  uniqueCode?: string | null,
  productId?: number | null
) {
  const normalizedCode = String(uniqueCode || '').trim();
  if (!normalizedCode) {
    return AFFILIATE_BASE_URL;
  }

  void seoSlug;
  void productId;
  return `${AFFILIATE_BASE_URL}/ref/${normalizedCode}`;
}