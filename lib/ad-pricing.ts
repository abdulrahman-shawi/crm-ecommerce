export type QuantityDiscountTier = {
  minQuantity: number;
  discountPercent: number;
};

export function normalizeQuantityDiscountTiers(input: unknown): QuantityDiscountTier[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = input
    .map((item: any) => ({
      minQuantity: Math.max(1, Math.trunc(Number(item?.minQuantity || 0))),
      discountPercent: Math.min(100, Math.max(0, Number(item?.discountPercent || 0))),
    }))
    .filter((item) => Number.isFinite(item.minQuantity) && Number.isFinite(item.discountPercent) && item.minQuantity > 0 && item.discountPercent > 0)
    .sort((a, b) => a.minQuantity - b.minQuantity);

  const deduped = new Map<number, QuantityDiscountTier>();
  normalized.forEach((item) => {
    deduped.set(item.minQuantity, item);
  });

  return Array.from(deduped.values()).sort((a, b) => a.minQuantity - b.minQuantity);
}

export function getAppliedQuantityDiscountTier(quantity: number, tiersInput: unknown) {
  const tiers = normalizeQuantityDiscountTiers(tiersInput);
  const normalizedQuantity = Math.max(1, Math.trunc(Number(quantity || 1)));

  return tiers.reduce<QuantityDiscountTier | null>((matchedTier, tier) => {
    if (normalizedQuantity >= tier.minQuantity) {
      return tier;
    }

    return matchedTier;
  }, null);
}

export function calculateQuantityDiscountPricing(unitPriceInput: number, quantityInput: number, tiersInput: unknown) {
  const unitPrice = Math.max(0, Number(unitPriceInput || 0));
  const quantity = Math.max(1, Math.trunc(Number(quantityInput || 1)));
  const tiers = normalizeQuantityDiscountTiers(tiersInput);
  const appliedTier = getAppliedQuantityDiscountTier(quantity, tiers);
  const appliedDiscountPercent = Number(appliedTier?.discountPercent || 0);
  const unitDiscountAmount = Number(((unitPrice * appliedDiscountPercent) / 100).toFixed(2));
  const finalUnitPrice = Math.max(0, Number((unitPrice - unitDiscountAmount).toFixed(2)));
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  const totalDiscountAmount = Number((unitDiscountAmount * quantity).toFixed(2));
  const finalAmount = Math.max(0, Number((subtotal - totalDiscountAmount).toFixed(2)));

  return {
    quantity,
    unitPrice,
    tiers,
    appliedTier,
    appliedDiscountPercent,
    unitDiscountAmount,
    finalUnitPrice,
    subtotal,
    totalDiscountAmount,
    finalAmount,
  };
}