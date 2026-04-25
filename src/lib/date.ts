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
  const end = new Date();
  const start = new Date();
  
  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start.setMonth(end.getMonth() - 1);
      break;
    case '3months':
      start.setMonth(end.getMonth() - 3);
      break;
    case '6months':
      start.setMonth(end.getMonth() - 6);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'all':
      return { start: null, end: null };
  }
  
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}
