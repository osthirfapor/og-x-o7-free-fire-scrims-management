export type WhatsAppCountry = 'BD' | 'NP';

export function getWhatsAppCountry(number?: string): WhatsAppCountry {
  return number?.startsWith('+977') ? 'NP' : 'BD';
}

export function getLocalWhatsAppNumber(number: string | undefined, country: WhatsAppCountry): string {
  if (!number) return '';
  const digits = number.replace(/\D/g, '');
  const countryPrefix = country === 'BD' ? '880' : '977';
  if (!digits.startsWith(countryPrefix)) return number;
  const nationalNumber = digits.slice(countryPrefix.length);
  return country === 'BD' ? `0${nationalNumber}` : nationalNumber;
}

export function normalizeWhatsAppNumber(input: string, country: WhatsAppCountry): string | null {
  let digits = input.replace(/\D/g, '');

  if (country === 'BD') {
    if (digits.startsWith('880')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (!/^1[3-9]\d{8}$/.test(digits)) return null;
    return `+880${digits}`;
  }

  if (digits.startsWith('977')) digits = digits.slice(3);
  if (!/^9[6-8]\d{8}$/.test(digits)) return null;
  return `+977${digits}`;
}

export function normalizeBangladeshWhatsAppNumber(input: string): string | null {
  return normalizeWhatsAppNumber(input, 'BD');
}
