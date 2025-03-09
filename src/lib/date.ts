import { format as dateFnsFormat, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';

// Get user's locale, fallback to 'en-US' if not available
const getUserLocale = () => {
  try {
    return enUS;
  } catch {
    return enUS;
  }
};

// Format date using user's locale
export const formatDate = (date: Date | string, formatStr: string = 'MMM d, yyyy') => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormat(dateObj, formatStr, { locale: getUserLocale() });
};

// Format date range
export const formatDateRange = (startDate: Date | string, endDate: Date | string) => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const locale = getUserLocale();
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth();

  if (sameYear && sameMonth) {
    return `${dateFnsFormat(start, 'MMM d', { locale })} - ${dateFnsFormat(end, 'd, yyyy', { locale })}`;
  } else if (sameYear) {
    return `${dateFnsFormat(start, 'MMM d', { locale })} - ${dateFnsFormat(end, 'MMM d, yyyy', { locale })}`;
  } else {
    return `${dateFnsFormat(start, 'MMM d, yyyy', { locale })} - ${dateFnsFormat(end, 'MMM d, yyyy', { locale })}`;
  }
};

// Format day with weekday
export const formatDayWithWeekday = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormat(dateObj, 'EEEE, MMM d', { locale: getUserLocale() });
};

// Add days to date and format
export const addDaysAndFormat = (date: Date | string, days: number, formatStr: string = 'MMM d') => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormat(addDays(dateObj, days), formatStr, { locale: getUserLocale() });
};