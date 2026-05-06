import dayjs from 'dayjs';

export type StandardTimeRange = 'today' | 'week' | 'month' | '3months' | '6months' | 'year' | 'all';

export const TIME_RANGES: { key: StandardTimeRange; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: '3months', label: '近3个月' },
  { key: '6months', label: '近半年' },
  { key: 'year', label: '近1年' },
  { key: 'all', label: '全部' },
];

export function getRangeDates(range: StandardTimeRange) {
  const end = dayjs();
  let start = dayjs();
  
  switch (range) {
    case 'today':
      start = end.startOf('day');
      break;
    case 'week':
      start = end.subtract(end.day() === 0 ? 6 : end.day() - 1, 'day').startOf('day');
      break;
    case 'month':
      start = end.startOf('month');
      break;
    case '3months':
      start = end.subtract(3, 'month');
      break;
    case '6months':
      start = end.subtract(6, 'month');
      break;
    case 'year':
      start = end.subtract(1, 'year');
      break;
    case 'all':
      return { start: null, end: null };
  }
  
  return {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD')
  };
}
