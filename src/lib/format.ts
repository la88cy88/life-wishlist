import { CURRENCY_SYMBOL } from '../types';

export function formatMoney(amount: number | null | undefined, currency = 'CNY'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  const n = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(amount);
  return `${symbol}${n}`;
}

/** YYYY-MM-DD → 2024 年 1 月 30 日；其它字符串原样返回 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '尚未保存';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '尚未保存';
  const diff = Date.now() - t;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function pctLabel(n: number): string {
  return `${Math.round(n * 100)}%`;
}
