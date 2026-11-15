export function normalizeBangladeshWhatsAppNumber(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let localNumber = digits;

  if (localNumber.startsWith('880')) localNumber = `0${localNumber.slice(3)}`;
  if (!/^01[3-9]\d{8}$/.test(localNumber)) return null;

  return `+880${localNumber.slice(1)}`;
}
