export const STOREFRONT_BASE_URL = 'https://www.skynova-tr.com';

export const AFFILIATE_COOKIE_NAME = 'affiliate-code';
export const AD_VISITOR_COOKIE_NAME = 'ad-visitor-id';

export function normalizeAccountType(accountType?: string | null) {
  return String(accountType || '').trim().toUpperCase();
}

export function isAffiliateAccount(accountType?: string | null, isAffiliate?: boolean | null) {
  const normalizedAccountType = normalizeAccountType(accountType);

  if (normalizedAccountType === 'STAFF') {
    return false;
  }

  return normalizedAccountType === 'AFFILIATE' || Boolean(isAffiliate);
}

export function buildAffiliateFullUrl(
  seoSlug?: string | null,
  uniqueCode?: string | null,
  productId?: number | null
) {
  const normalizedCode = String(uniqueCode || '').trim();
  if (!normalizedCode) {
    return STOREFRONT_BASE_URL;
  }

  void seoSlug;
  void productId;
  return `${STOREFRONT_BASE_URL}/ref/${normalizedCode}`;
}

export function buildAdFullUrl(productId?: number | string | null) {
  const normalizedProductId = Number(productId || 0);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    return STOREFRONT_BASE_URL;
  }

  return `${STOREFRONT_BASE_URL}/ad/${normalizedProductId}`;
}