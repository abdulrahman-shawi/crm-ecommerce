const AFFILIATE_BASE_URL = 'https://ecomerce-bay-xi.vercel.app';

export const AFFILIATE_COOKIE_NAME = 'affiliate-code';

export function buildAffiliateFullUrl(seoSlug?: string | null, uniqueCode?: string | null) {
  const normalizedCode = String(uniqueCode || '').trim();
  if (!normalizedCode) {
    return AFFILIATE_BASE_URL;
  }

  const normalizedSlug = String(seoSlug || '').trim();
  if (!normalizedSlug) {
    return `${AFFILIATE_BASE_URL}/ref/${normalizedCode}`;
  }

  const params = new URLSearchParams({ ref: normalizedCode });
  return `${AFFILIATE_BASE_URL}/product/${normalizedSlug}?${params.toString()}`;
}