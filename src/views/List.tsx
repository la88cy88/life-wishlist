import { useMemo, useState } from 'react';
import { CATEGORY_META, FILTERS } from '../types';
import type { FilterId, WishItem } from '../types';
import { filterItems, groupByCategory } from '../lib/selectors';
import { useWishlist } from '../store';
import { Icon, SectionHead, EmptyState } from '../components/UI';
import { WishCard } from '../components/WishCard';

interface Props {
  onEdit: (item: WishItem) => void;
  onDelete: (item: WishItem) => void;
  onAdd: () => void;
}

export function List({ onEdit, onDelete, onAdd }: Props) {
  const { data } = useWishlist();
  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => filterItems(data.items, filter, query), [data.items, filter, query]);
  const groups = useMemo(() => groupByCategory(shown), [shown]);

  return (
    <div className="page list-page">
      <header className="page-head compact">
        <span className="eyebrow">ALL WISHES</span>
        <h1>全部清单</h1>
        <p>共 {data.items.length} 项目标 · 当前显示 {shown.length} 项</p>
      </header>

      <div className="search-box">
        <Icon name="search" size={19} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索名称、品牌、型号、备注" aria-label="搜索目标" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="清空搜索"><Icon name="close" size={17} /></button>}
      </div>

      <div className="chips" role="group" aria-label="筛选">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? 'chip on' : 'chip'}
            aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.name}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="search" title="没有找到匹配的目标"
          hint={query ? '换个关键词，或清空筛选条件' : '试试其他分类，或新增一个目标'} />
      ) : (
        groups.map((g) => (
          <section className="list-group" key={g.id}>
            <SectionHead title={CATEGORY_META[g.id].name}
              action={<span className="group-count">{g.items.length} 项</span>} />
            <div className="card-stack">
              {g.items.map((item) => (
                <WishCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </section>
        ))
      )}

      <button type="button" className="wide-cta" onClick={onAdd}>
        <Icon name="plus" size={19} /> 添加一个新的愿望
      </button>
    </div>
  );
}
