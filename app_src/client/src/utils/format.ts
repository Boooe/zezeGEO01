/**
 * 格式化金额（分→元），返回带 ¥ 符号和两位小数的字符串
 * 例：128000 → "¥1,280.00"
 */
export function formatMoneyCents(cents: number): string {
  const yuan = cents / 100;
  return '¥' + yuan.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 仅格式化数字部分（不带 ¥ 符号）
 */
export function formatMoneyCentsRaw(cents: number): string {
  const yuan = cents / 100;
  return yuan.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 元数格式化（已经是元），返回带 ¥ 符号和两位小数的字符串
 * 例：1280 → "¥1,280.00"
 */
export function formatMoneyYuan(yuan: number): string {
  return '¥' + yuan.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 加价率格式化：0.95 → "95%"，0.5 → "50%"，四舍五入到整数
 */
export function formatMarkupRate(rate: number): string {
  return Math.round(rate * 100) + '%';
}

/**
 * 库存显示：null → 不限，0 → 0（约满），>0 → 数字
 */
export function formatStockDisplay(stock: number | null): string {
  if (stock === null || stock === undefined) return '不限';
  if (stock === 0) return '0（约满）';
  return stock.toLocaleString('zh-CN');
}

/**
 * 时效显示：null → —，>0 → N小时
 */
export function formatTurnaroundDisplay(hours: number | null): string {
  if (hours === null || hours === undefined || hours <= 0) return '—';
  return hours + '小时';
}

/**
 * 元字符串转分（取整）
 */
export function yuanToCents(yuanStr: string): number {
  const yuan = parseFloat(yuanStr);
  if (isNaN(yuan)) return 0;
  return Math.round(yuan * 100);
}
