export const startOfDay = (date: Date | string): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date | string): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addDays = (date: Date | string, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const nightsBetween = (checkIn: Date | string, checkOut: Date | string): number => {
  const a = startOfDay(checkIn);
  const b = startOfDay(checkOut);
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

export const isDateRangeValid = (
  checkIn: Date | string,
  checkOut: Date | string
): boolean => {
  const a = startOfDay(checkIn);
  const b = startOfDay(checkOut);
  return b.getTime() > a.getTime();
};

export const datesOverlap = (
  resStart: Date | string,
  resEnd: Date | string,
  qStart: Date | string,
  qEnd: Date | string
): boolean => {
  const a = startOfDay(resStart).getTime();
  const b = startOfDay(resEnd).getTime();
  const c = startOfDay(qStart).getTime();
  const d = startOfDay(qEnd).getTime();
  return a < d && c < b;
};

export const toHotelDate = (
  date: Date | string,
  timezoneOffsetMinutes = 0
): Date => {
  const d = new Date(date);
  return startOfDay(d);
};

export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const relativeTime = (date: Date | string): string => {
  const d = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(date);
};