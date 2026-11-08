import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DATA_VERSION, doneStatusFor, isDone } from './types';
import type { ThemeMode, WishItem, WishlistData } from './types';
import { createSeedData } from './data/seed';
import { loadData, nowISO, saveData, stamp, todayISO, uid } from './lib/storage';
import type { LoadResult } from './lib/storage';
import { computeStats } from './lib/selectors';
import type { Stats } from './lib/selectors';

export type NewItemInput = Partial<WishItem> & { name: string };

interface WishlistContextValue {
  data: WishlistData;
  stats: Stats;
  storageError: string | null;
  migrationNotice: string | null;
  toast: string | null;
  notify: (message: string) => void;
  dismissMigration: () => void;
  addItem: (input: NewItemInput) => WishItem;
  updateItem: (id: string, patch: Partial<WishItem>) => void;
  removeItem: (id: string) => void;
  completeItem: (id: string) => void;
  reopenItem: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  replaceData: (next: WishlistData) => void;
  resetToSeed: () => void;
  clearAll: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const initial = useRef<LoadResult | null>(null);
  if (initial.current === null) initial.current = loadData();
  const boot: LoadResult = initial.current;

  const [data, setData] = useState<WishlistData>(boot.data);
  const dataRef = useRef<WishlistData>(boot.data);
  const [storageError, setStorageError] = useState<string | null>(boot.error ?? null);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(
    boot.migrated
      ? boot.error ?? '检测到旧版本数据，已自动升级并保留原始备份。'
      : null
  );
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  /** 唯一的写入口：打时间戳 → 写 localStorage → 更新内存，避免 StrictMode 下重复副作用。 */
  const commit = useCallback((produce: (current: WishlistData) => WishlistData) => {
    const next = stamp({ ...produce(dataRef.current), version: DATA_VERSION });
    const result = saveData(next);
    setStorageError(result.ok ? null : result.error ?? '保存失败');
    dataRef.current = next;
    setData(next);
  }, []);

  const addItem = useCallback((input: NewItemInput): WishItem => {
    const now = nowISO();
    const item: WishItem = {
      id: uid(),
      name: input.name.trim(),
      brand: input.brand ?? '',
      model: input.model ?? '',
      category: input.category ?? 'tech',
      cover: input.cover ?? null,
      link: input.link ?? null,
      targetPrice: input.targetPrice ?? null,
      currentPrice: input.currentPrice ?? null,
      currency: input.currency ?? 'CNY',
      year: input.year ?? null,
      priority: input.priority ?? 'medium',
      note: input.note ?? '',
      status: input.status ?? 'want',
      completedAt: input.completedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    commit((d) => ({ ...d, items: [...d.items, item] }));
    return item;
  }, [commit]);

  const updateItem = useCallback((id: string, patch: Partial<WishItem>) => {
    commit((d) => ({
      ...d,
      items: d.items.map((it) =>
        it.id === id ? { ...it, ...patch, id: it.id, updatedAt: nowISO() } : it
      ),
    }));
  }, [commit]);

  const removeItem = useCallback((id: string) => {
    commit((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  }, [commit]);

  const completeItem = useCallback((id: string) => {
    commit((d) => ({
      ...d,
      items: d.items.map((it) => {
        if (it.id !== id || isDone(it.status)) return it;
        return {
          ...it,
          status: doneStatusFor(it.category),
          completedAt: it.completedAt ?? todayISO(),
          updatedAt: nowISO(),
        };
      }),
    }));
  }, [commit]);

  const reopenItem = useCallback((id: string) => {
    commit((d) => ({
      ...d,
      items: d.items.map((it) =>
        it.id === id ? { ...it, status: 'want', completedAt: null, updatedAt: nowISO() } : it
      ),
    }));
  }, [commit]);

  const setTheme = useCallback((theme: ThemeMode) => {
    commit((d) => ({ ...d, settings: { ...d.settings, theme } }));
  }, [commit]);

  const replaceData = useCallback((next: WishlistData) => {
    commit(() => next);
  }, [commit]);

  const resetToSeed = useCallback(() => {
    commit(() => createSeedData());
  }, [commit]);

  const clearAll = useCallback(() => {
    commit((d) => ({ ...d, items: [] }));
  }, [commit]);

  const stats = useMemo(() => computeStats(data), [data]);

  const value = useMemo<WishlistContextValue>(() => ({
    data, stats, storageError, migrationNotice, toast, notify,
    dismissMigration: () => setMigrationNotice(null),
    addItem, updateItem, removeItem, completeItem, reopenItem,
    setTheme, replaceData, resetToSeed, clearAll,
  }), [data, stats, storageError, migrationNotice, toast, notify, addItem, updateItem, removeItem, completeItem, reopenItem, setTheme, replaceData, resetToSeed, clearAll]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist 必须在 WishlistProvider 内使用');
  return ctx;
}
