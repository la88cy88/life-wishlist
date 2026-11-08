/** 全局数据契约。新增字段时请同步 bump DATA_VERSION 并在 lib/storage.ts 补迁移。 */

/** 当前数据结构版本。改动 WishItem / WishlistData 形状时必须 +1 并写迁移逻辑。 */
export const DATA_VERSION = 2;

export type CategoryId = 'tech' | 'home' | 'auto' | 'life';
export type Status = 'want' | 'planned' | 'owned' | 'achieved' | 'paused';
export type Priority = 'high' | 'medium' | 'low';
export type ThemeMode = 'system' | 'light' | 'dark';

export interface WishItem {
  id: string;
  /** 目标名称 */
  name: string;
  /** 品牌（人生体验类可留空） */
  brand: string;
  /** 产品型号或目标描述，随时可换 */
  model: string;
  category: CategoryId;
  /** 视觉封面：本地压缩后的 data URL 或用户自行填写的图片 URL，null = 用分类渐变占位 */
  cover: string | null;
  /** 官方产品链接或资料链接 */
  link: string | null;
  /** 目标价格。未经核实一律留空 */
  targetPrice: number | null;
  /** 当前参考价格。未经核实一律留空 */
  currentPrice: number | null;
  /** ISO 4217，默认 CNY */
  currency: string;
  /** 计划实现年份 */
  year: number | null;
  priority: Priority;
  note: string;
  status: Status;
  /** 完成日期，YYYY-MM-DD；勾选时自动写入，可手动修改 */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
  /** 最近一次成功写入 localStorage 的时间 ISO 字符串 */
  lastSavedAt: string | null;
}

export interface WishlistData {
  /** 数据结构版本，用于未来升级迁移 */
  version: number;
  items: WishItem[];
  settings: AppSettings;
}

export interface CategoryMeta {
  name: string;
  short: string;
  glyph: string;
  /** 低饱和度分类渐变，浅色/深色两套 */
  light: string;
  dark: string;
}

export const CATEGORY_ORDER: CategoryId[] = ['tech', 'home', 'auto', 'life'];

export const CATEGORY_META: Record<CategoryId, CategoryMeta> = {
  tech: {
    name: '科技数码', short: '数码', glyph: '◈',
    light: 'linear-gradient(145deg,#c8d0da 0%,#8f9aa8 55%,#6d7887 100%)',
    dark: 'linear-gradient(145deg,#3c4654 0%,#252c36 55%,#171c24 100%)',
  },
  home: {
    name: '家居生活', short: '家居', glyph: '◇',
    light: 'linear-gradient(145deg,#ddd5c9 0%,#b9ac9a 55%,#978a79 100%)',
    dark: 'linear-gradient(145deg,#4a4238 0%,#302a23 55%,#1e1a16 100%)',
  },
  auto: {
    name: '汽车与个人品位', short: '品位', glyph: '▣',
    light: 'linear-gradient(145deg,#b9bfc6 0%,#8c949d 55%,#606871 100%)',
    dark: 'linear-gradient(145deg,#3a4048 0%,#242a30 55%,#151a1f 100%)',
  },
  life: {
    name: '人生体验', short: '体验', glyph: '✳',
    light: 'linear-gradient(145deg,#c6d2cb 0%,#9aaba0 55%,#74877c 100%)',
    dark: 'linear-gradient(145deg,#37473d 0%,#232f28 55%,#151e19 100%)',
  },
};

export const STATUS_META: Record<Status, { name: string; short: string }> = {
  want: { name: '想拥有', short: '想拥有' },
  planned: { name: '计划中', short: '计划中' },
  owned: { name: '已拥有', short: '已拥有' },
  achieved: { name: '已实现', short: '已实现' },
  paused: { name: '暂缓', short: '暂缓' },
};

export const STATUS_ORDER: Status[] = ['want', 'planned', 'owned', 'achieved', 'paused'];

export const PRIORITY_META: Record<Priority, { name: string; weight: number }> = {
  high: { name: '高', weight: 3 },
  medium: { name: '中', weight: 2 },
  low: { name: '低', weight: 1 },
};

export const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];

export const CURRENCIES = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD', 'SGD', 'AUD', 'CAD'];

export const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥', HKD: 'HK$', TWD: 'NT$', SGD: 'S$', AUD: 'A$', CAD: 'C$',
};

/** 已拥有 / 已实现都算完成；暂缓、想拥有、计划中算未完成 */
export const isDone = (status: Status): boolean => status === 'owned' || status === 'achieved';

/** 勾选完成时：人生体验 → 已实现，其余 → 已拥有 */
export const doneStatusFor = (category: CategoryId): Status => (category === 'life' ? 'achieved' : 'owned');

export type FilterId =
  | 'all' | 'tech' | 'home' | 'auto' | 'life'
  | 'done' | 'pending' | 'high' | 'paused';

export const FILTERS: { id: FilterId; name: string }[] = [
  { id: 'all', name: '全部目标' },
  { id: 'tech', name: '科技数码' },
  { id: 'home', name: '家居生活' },
  { id: 'auto', name: '汽车与个人品位' },
  { id: 'life', name: '人生体验' },
  { id: 'done', name: '已实现' },
  { id: 'pending', name: '未实现' },
  { id: 'high', name: '高优先级' },
  { id: 'paused', name: '暂缓' },
];
