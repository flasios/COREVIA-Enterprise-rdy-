export const formatCurrency = (amount?: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!num) return 'N/A';
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatDate = (date?: string | Date): string => {
  if (!date) return 'Not set';
  return new Date(date).toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
};

export const calculateDuration = (startDate?: string, endDate?: string): number | null => {
  if (!startDate || !endDate) return null;
  return Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
};
