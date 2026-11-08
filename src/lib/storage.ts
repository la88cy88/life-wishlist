/**
 * 版本化本地存储层。
 *
 * 设计原则：
 *  - 唯一持久化位置是 localStorage；不发起任何网络请求。
 *  - 任何读入的数据都经过 normalizeData 补齐缺失字段，因此旧版本备份可以直接导入。
 *  - 迁移或解析失败前，先把原始字符串备份到 BACKUP_KEY，避免升级导致数据丢失。
 *  - 未来若修改结构，只要 DATA_VERSION +1 并在 normalizeItem 中补默认值/别名即可。
 */
import {
  CATEGORY_ORDER, CURRENCIES, DATA_VERSION, PRIORITY_ORDER, STATUS_ORDER,
  doneStatusFor,
} from '../types';
import type { CategoryId, Priority, Status, ThemeMode, WishItem, WishlistData } from '../types';
import { createSeedData } from '../data/seed';

export const STORAGE_KEY = 'life-wishlist:data';
export const BACKUP_KEY = 'life-wishlist:backup';
export const APP_TAG = 'life-wishlist';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function dateOrNull(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function todayISO(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** 把任意来源的一条记录规范化为完整的 WishItem；无法识别则返回 null。 */
export function normalizeItem(raw: unknown, index: number): WishItem | null {
  if (!isRecord(raw)) return null;
  // v1 曾用 title / desc / done 字段，这里保留别名以兼容备份
  const name = str(raw.name ?? raw.title).trim();
  if (!name) return null;

  const category: CategoryId = CATEGORY_ORDER.includes(raw.category as CategoryId)
    ? (raw.category as CategoryId)
    : 'life';
  const status: Status = STATUS_ORDER.includes(raw.status as Status)
    ? (raw.status as Status)
    : raw.done === true
      ? doneStatusFor(category)
      : 'want';
  const priority: Priority = PRIORITY_ORDER.includes(raw.priority as Priority)
    ? (raw.priority as Priority)
    : 'medium';
  const currency = CURRENCIES.includes(str(raw.currency)) ? str(raw.currency) : 'CNY';
  const now = nowISO();

  return {
    id: str(raw.id) || `restored-${index}-${uid()}`,
    name,
    brand: str(raw.brand),
    model: str(raw.model ?? raw.desc),
    category,
    cover: typeof raw.cover === 'string' && raw.cover ? raw.cover : null,
    link: typeof raw.link === 'string' && raw.link ? raw.link : null,
    targetPrice: numOrNull(raw.targetPrice ?? raw.price),
    currentPrice: numOrNull(raw.currentPrice),
    currency,
    year: (() => {
      const y = numOrNull(raw.year);
      return y && y >= 1900 && y <= 2200 ? Math.round(y) : null;
    })(),
    priority,
    note: str(raw.note),
    status,
    completedAt: dateOrNull(raw.completedAt) ?? (status === 'owned' || status === 'achieved' ? todayISO() : null),
    createdAt: str(raw.createdAt) || now,
    updatedAt: str(raw.updatedAt) || now,
  };
}

/** 规范化整份数据；兼容 v1（无 version / goals / done 布尔）与未来更高版本。 */
export function normalizeData(raw: unknown): WishlistData | null {
  if (!isRecord(raw)) return null;
  let source: unknown[] = Array.isArray(raw.items) ? raw.items : [];
  if (source.length === 0 && Array.isArray(raw.goals)) source = raw.goals; // v1 别名

  const seen = new Set<string>();
  const items: WishItem[] = [];
  source.forEach((r, i) => {
    const item = normalizeItem(r, i);
    if (!item) return;
    let id = item.id;
    while (seen.has(id)) id = uid();
    seen.add(id);
    items.push({ ...item, id });
  });

  const s = isRecord(raw.settings) ? raw.settings : {};
  const theme: ThemeMode = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system';
  const lastSavedAt = typeof s.lastSavedAt === 'string' ? s.lastSavedAt : null;
  return { version: DATA_VERSION, items, settings: { theme, lastSavedAt } };
}

export function stamp(data: WishlistData): WishlistData {
  return {
    ...data,
    version: DATA_VERSION,
    settings: { ...data.settings, lastSavedAt: nowISO() },
  };
}

export interface SaveResult { ok: boolean; error?: string }

export function saveData(data: WishlistData): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (e) {
    const err = e as { name?: string };
    const quota = err?.name === 'QuotaExceededError' || err?.name === 'NSQuotaExceededError';
    return {
      ok: false,
      error: quota
        ? '本机存储空间不足，请先删除部分封面图片或导出备份'
        : '无法写入本地存储，请检查 Safari 隐私设置或是否处于无痕模式',
    };
  }
}

export interface LoadResult {
  data: WishlistData;
  migrated: boolean;
  error?: string;
}

export function loadData(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    return { data: createSeedData(), migrated: false, error: '无法读取本地存储（可能处于无痕模式）' };
  }

  if (raw === null) {
    const seed = stamp(createSeedData());
    const res = saveData(seed);
    return { data: seed, migrated: false, error: res.ok ? undefined : res.error };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const incomingVersion = isRecord(parsed) && typeof parsed.version === 'number' ? parsed.version : 0;
    const normalized = normalizeData(parsed);
    if (!normalized) throw new Error('结构无法识别');

    if (incomingVersion !== DATA_VERSION) {
      // 升级前留一份原始快照，绝不静默丢弃
      try { localStorage.setItem(BACKUP_KEY, raw); } catch (_) { /* 配额不足时忽略 */ }
      const next = stamp(normalized);
      const res = saveData(next);
      return { data: next, migrated: true, error: res.ok ? undefined : res.error };
    }
    return { data: normalized, migrated: false };
  } catch (_) {
    try { localStorage.setItem(BACKUP_KEY, raw); } catch (_) { /* 忽略 */ }
    const seed = stamp(createSeedData());
    const res = saveData(seed);
    return {
      data: seed,
      migrated: true,
      error: res.error ?? '本地数据无法解析，已将原始内容备份并恢复初始清单',
    };
  }
}

/** 导出：只包含用户自己的数据，任何设备之间靠这个文件手动迁移。 */
export function exportPayload(data: WishlistData): string {
  return JSON.stringify(
    {
      app: APP_TAG,
      version: DATA_VERSION,
      exportedAt: nowISO(),
      items: data.items,
      settings: data.settings,
    },
    null,
    2
  );
}

/** 导入：严格校验后再交由调用方二次确认覆盖。失败时抛中文错误。 */
export function parseImport(text: string): WishlistData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw new Error('文件不是有效的 JSON');
  }
  if (!isRecord(parsed)) throw new Error('JSON 顶层必须是对象');
  if (typeof parsed.app === 'string' && parsed.app !== APP_TAG) {
    throw new Error('这不是 Life Wishlist 导出的备份文件');
  }
  const normalized = normalizeData(parsed);
  if (!normalized) throw new Error('无法识别清单数据');
  if (normalized.items.length === 0) {
    throw new Error('备份中没有任何目标，已取消导入以免覆盖现有数据');
  }
  return normalized;
}

export function estimateBytes(data: WishlistData): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch (_) {
    return JSON.stringify(data).length;
  }
}
