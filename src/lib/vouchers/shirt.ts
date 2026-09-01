export const NO_SHIRT_LABEL = "Sem camisa";

export function isFreeChildAge(age: number | null | undefined): boolean {
  return (age ?? 0) < 6;
}

export function childShirtSizeLabel(opts: {
  age: number | null | undefined;
  shirtSize: string;
  hasOptionalPaidShirt: boolean;
}): string {
  if (isFreeChildAge(opts.age) && !opts.hasOptionalPaidShirt) return NO_SHIRT_LABEL;
  return opts.shirtSize;
}
