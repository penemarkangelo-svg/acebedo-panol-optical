export const PRODUCT_LABEL_OPTIONS = [
  { value: "best_seller", label: "Best Seller" },
  { value: "featured", label: "Featured" },
];

export function getProductLabels(product) {
  return [
    ...(product?.is_new ? ["New Arrival"] : []),
    ...PRODUCT_LABEL_OPTIONS.filter(({ value }) => product?.product_labels?.includes(value)).map(({ label }) => label),
  ];
}
