const HOTEL_CODE = 'HTL';

export const generateConfirmationNumber = (sequence: number, year: number): string =>
  `${HOTEL_CODE}-${year}-${String(sequence).padStart(6, '0')}`;

export const generateInvoiceNumber = (sequence: number, year: number): string =>
  `INV-${year}-${String(sequence).padStart(6, '0')}`;

export const generateRequestNumber = (sequence: number, year: number, prefix = 'MT'): string =>
  `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;

const SEQUENCES = new Map<string, number>();

export const nextSequence = (key: string): number => {
  const current = SEQUENCES.get(key) ?? 0;
  SEQUENCES.set(key, current + 1);
  return current + 1;
};

export const nextRefNumber = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100).toString(36).toUpperCase()}`;

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);