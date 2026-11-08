import { useMemo } from 'react';
import { CATEGORY_META, isDone } from '../types';
import type { WishItem } from '../types';
import { formatDate } from '../lib/format';
import { useWishlist } from '../store';
import { EmptyState, Icon, ProgressRing, SectionHead } from '../components/UI';
import { WishCard } from '../components/WishCard';
import type { ViewId } from '../components/UI';

interface Props {
  onEdit: (item: WishItem) => void;
  onDelete: (item: WishItem) => void;
  onNavigate: (v: ViewId) => void;
}

export function Achieved({ onEdit, onDelete, onNavigate }: Props) {
  const { data, stats } = useWishlist();
  const done = useMemo(
    () => data.items.filter((i) => isDone(i.status))
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    [data.items]
  );

  const groups = useMemo(() => {
    const map = new Map<string, WishItem[]>();
    done.forEach((i) => {
      const key = i.completedAt ? i.completedAt.slice(0, 4) + ' 年' : '日期未记录';
      map.set(key, [...(map.get(key) ?? []), i]);
    });
    return [...map.entries()];
  }, [done]);

  return (
    <div className="page">
      <header className="page-head compact">
        <span className="eyebrow">ACHIEVED</span>
        <h1>已实现</h1>
        <p>已经拥有的，不会被清单悄悄抹掉。</p>
      </header>

      <section className="card achieved-hero">
        <ProgressRing value={stats.pct} size={104} stroke={10}>
          <span className="ring-num small">{Math.round(stats.pct * 100)}<i>%</i></span>
        </ProgressRing>
        <div>
          <b>{stats.done}</b>
          <span>项目标已实现</span>
          <small>共 {stats.total} 项 · 还有 {stats.pending} 项在路上</small>
        </div>
      </section>

      {done.length === 0 ? (
        <EmptyState icon="checkCircle" title="还没有已实现的目标" hint="去全部清单里点一下圆圈，记录第一次实现" />
      ) : (
        groups.map(([year, items]) => (
          <section className="list-group" key={year}>
            <SectionHead title={year} action={<span className="group-count">{items.length} 项</span>} />
            <div className="card-stack">
              {items.map((item) => (
                <WishCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
            <p className="group-hint">{CATEGORY_META[items[0].category].name}等 · 完成日期 {formatDate(items[0].completedAt) || '未记录'}</p>
          </section>
        ))
      )}

      <button type="button" className="wide-cta" onClick={() => onNavigate('list')}>
        <Icon name="list" size={19} /> 回到全部清单
      </button>
    </div>
  );
}
