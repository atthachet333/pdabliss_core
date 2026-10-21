const number = new Intl.NumberFormat('th-TH');
const baht = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });

export const formatNumber = (value: number) => number.format(value);
export const formatBaht = (value: number) => baht.format(value);
export const formatShortDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00`));
