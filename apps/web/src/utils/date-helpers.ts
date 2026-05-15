import { format } from 'date-fns';

/**
 * Helper to get hour in Sydney timezone from a UTC date string
 */
export const getSydneyHour = (dateStr: string): number => {
  try {
    const date = new Date(dateStr);
    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Australia/Sydney'
    }).format(date);
    return parseInt(hourStr) % 24;
  } catch (e) {
    return NaN;
  }
};

/**
 * Standard date formatter for the UI
 */
export const formatDate = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr);
};
