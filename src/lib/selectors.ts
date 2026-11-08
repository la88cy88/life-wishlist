/** 纯函数：统计与筛选。不依赖 React / DOM，方便单独测试与未来扩展。 */
import {
  CATEGORY_ORDER, PRIORITY_META, PRIORITY_ORDER, STATUS_ORDER, isDone,
} from '../types';
import type { CategoryId, FilterId, Priority, Status, WishItem, WishlistData } from '../types';

export interface CategoryStat {
  id: CategoryId;
  total: number;
  done: number;
  pending: number;
  pct: number;
}

export interface Stats {
  total: number;
  done: number;
  pending: number;
  pct: number;
  categories: CategoryStat[];
  /** 已完成，按完成日期倒序 */
  recent: WishItem[];
  /** 未完成且高优先级，按优先级 + 计划年份 + 创建顺序 */
  top3: WishItem[];
  statusCounts: Record<Status, number>;
  pendingPriority: Record<Priority, number>;
  /** 未完成目标中已填写价格的合计（币种混合时仅作参考） */
  budgetSum: number;
  budgetFilled: number;
  budgetMissing: number;
  byYear: { year: number; count: number }[];
}

const prioritySort = (a: WishItem, b: WishItem): number => {
  const w = PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight;
  if (w !== 0) return w;
  if (a.year !== b.year) return (a.year ?? 9999) - (b.year ?? 9999);
  return a.createdAt.localeCompare(b.createdAt);
};

export function computeStats(data: WishlistData): Stats {
  const items = data.items;
  const total = items.length;
  const doneItems = items.filter((i) => isDone(i.status));
  const done = doneItems.length;

  const categories: CategoryStat[] = CATEGORY_ORDER.map((id) => {
    const group = items.filter((i) => i.category === id);
    const d = group.filter((i) => isDone(i.status)).length;
    return { id, total: group.length, done: d, pending: group.length - d, pct: group.length ? d / group.length : 0 };
  });

  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = items.filter((i) => i.status === s).length;
    return acc;
  }, {} as Record<Status, number>);

  const pendingItems = items.filter((i) => !isDone(i.status));
  const pendingPriority = PRIORITY_ORDER.reduce((acc, p) => {
    acc[p] = pendingItems.filter((i) => i.priority === p).length;
    return acc;
  }, {} as Record<Priority, number>);

  let budgetSum = 0;
  let budgetFilled = 0;
  pendingItems.forEach((i) => {
    const v = i.currentPrice ?? i.targetPrice;
    if (v !== null) { budgetSum += v; budgetFilled += 1; }
  });

  const yearMap = new Map<number, number>();
  pendingItems.forEach((i) => {
    if (i.year) yearMap.set(i.year, (yearMap.get(i.year) ?? 0) + 1);
  });
  const byYear = [...yearMap.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }));

  return {
    total,
    done,
    pending: total - done,
    pct: total ? done / total : 0,
    categories,
    recent: [...doneItems].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || b.updatedAt.localeCompare(a.updatedAt)),
    top3: [...pendingItems].sort(prioritySort).slice(0, 3),
    statusCounts,
    pendingPriority,
    budgetSum,
    budgetFilled,
    budgetMissing: pendingItems.length - budgetFilled,
    byYear,
  };
}

export function filterItems(items: WishItem[], filter: FilterId, query: string): WishItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    switch (filter) {
      case 'tech': case 'home': case 'auto': case 'life':
        if (item.category !== filter) return false;
        break;
      case 'done':
        if (!isDone(item.status)) return false;
        break;
      case 'pending':
        if (isDone(item.status)) return false;
        break;
      case 'high':
        if (item.priority !== 'high' || isDone(item.status)) return false;
        break;
      case 'paused':
        if (item.status !== 'paused') return false;
        break;
      case 'all':
      default:
        break;
    }
    if (!q) return true;
    return [item.name, item.brand, item.model, item.note, item.link ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

export function groupByCategory(items: WishItem[]): { id: CategoryId; items: WishItem[] }[] {
  return CATEGORY_ORDER.map((id) => ({ id, items: items.filter((i) => i.category === id) }))
    .filter((g) => g.items.length > 0);
}
