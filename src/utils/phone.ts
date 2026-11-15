export type WhatsAppCountry = 'BD' | 'NP';

export function normalizeWhatsAppNumber(input: string, country: WhatsAppCountry): string | null {
  let digits = input.replace(/\D/g, '');

  if (country === 'BD') {
    if (digits.startsWith('880')) digits = `0${digits.slice(3)}`;
    if (!/^01[3-9]\d{8}$/.test(digits)) return null;
    return `+880${digits.slice(1)}`;
  }

  if (digits.startsWith('977')) digits = digits.slice(3);
  if (!/^9[6-8]\d{8}$/.test(digits)) return null;
  return `+977${digits}`;
}

export function normalizeBangladeshWhatsAppNumber(input: string): string | null {
  return normalizeWhatsAppNumber(input, 'BD');
}
