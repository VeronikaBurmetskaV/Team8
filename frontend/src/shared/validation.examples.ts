// One list of valid/invalid inputs for the card form. The backend validation
// tests must use the same examples (R-T17), so keep this file plain data.

export interface ValidationExample {
  value: string;
  valid: boolean;
}

export const cardNameExamples: ValidationExample[] = [
  { value: "", valid: false },
  { value: "   ", valid: false },
  { value: "Лляна сукня міді", valid: true },
  { value: "a".repeat(100), valid: true },
  { value: "a".repeat(101), valid: false },
];

export const cardPriceExamples: ValidationExample[] = [
  { value: "2400", valid: true },
  { value: "1", valid: true },
  { value: "1000000", valid: true },
  { value: "", valid: false },
  { value: "-500", valid: false },
  { value: "0", valid: false },
  { value: "abc", valid: false },
  { value: "12.5", valid: false },
  { value: "1000001", valid: false },
];

/** Photo given as an external URL (no uploaded file). */
export const cardPhotoUrlExamples: ValidationExample[] = [
  { value: "https://cdn.brand-site.ua/shirt.webp", valid: true },
  { value: "http://cdn.brand-site.ua/shirt.webp", valid: false },
  { value: "cdn.brand-site.ua/shirt.webp", valid: false },
  { value: "data:image/png;base64,AAAA", valid: false },
  { value: "", valid: false },
];

export const cardProductUrlExamples: ValidationExample[] = [
  { value: "https://brand-site.ua/linen-dress", valid: true },
  { value: "https://brand-site.ua/product?id=42", valid: true },
  { value: "http://x.ua", valid: true },
  { value: "", valid: false },
  { value: "сукня", valid: false },
  { value: "brand.ua/x", valid: false },
  { value: "https://", valid: false },
  { value: "ftp://brand.ua/x", valid: false },
  { value: "javascript:alert(1)", valid: false },
];
