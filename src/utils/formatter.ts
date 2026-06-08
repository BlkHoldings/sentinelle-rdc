export const formatNumber = (number: number) =>
  new Intl.NumberFormat().format(number);

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString();