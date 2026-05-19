export function appBrandName(): string {
  return process.env.APP_BRAND_NAME || "AI E2E";
}

export function appProductName(): string {
  return process.env.APP_PRODUCT_NAME || `${appBrandName()} Test`;
}
