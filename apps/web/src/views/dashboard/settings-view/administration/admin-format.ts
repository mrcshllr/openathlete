import { getLocale } from '@/paraglide/runtime';
import { getDateLocale } from '@/utils/locales';

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];

/** "12.4 MB": sizes as the administrator reads them */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0,
  }).format(value)} ${UNITS[unit]}`;
}

export const dayFormat = () =>
  new Intl.DateTimeFormat(getDateLocale(getLocale()), { dateStyle: 'medium' });

export const momentFormat = () =>
  new Intl.DateTimeFormat(getDateLocale(getLocale()), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
