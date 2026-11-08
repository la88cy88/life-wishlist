import { CATEGORY_META } from '../types';
import { formatDate } from '../lib/format';
import { useWishlist } from '../store';
import { Bar, EmptyState, Icon, ProgressRing, SectionHead } from '../components/UI';
import { CoverStyle } from '../components/WishCard';
import type { ViewId } from '../components/UI';
import type { WishItem } from '../types';

interface Props {
  onNavigate: (v: ViewId) => void;
  onEdit: (item: WishItem) => void;
  onAdd: () => void;
}

export function Home({ onNavigate, onEdit, onAdd }: Props) {
  const { stats, completeItem, notify } = useWishlist();
  const today = new Date();
  const dateLine = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;

  return (
    <div className="page home">
      <header className="page-head">
        <span className="eyebrow">LIFE WISHLIST · {dateLine}</span>
        <h1>我的人生清单</h1>
        <p>把想要的生活，一项项实现。</p>
      </header>

      <section className="hero card" aria-label="人生目标完成进度">
        <div className="hero-glow" />
        <div className="hero-ring">
          <ProgressRing value={stats.pct} size={196} stroke={16}>
            <span className="ring-num" data-testid="overall-pct">{Math.round(stats.pct * 100)}<i>%</i></span>
            <span className="ring-cap">已完成</span>
          </ProgressRing>
        </div>
        <div className="hero-stats">
          <div><b data-testid="stat-total">{stats.total}</b><span>总目标</span></div>
          <div><b data-testid="stat-done">{stats.done}</b><span>已实现</span></div>
          <div><b data-testid="stat-pending">{stats.pending}</b><span>待实现</span></div>
        </div>
      </section>

      <SectionHead title="当前最想实现" sub="按高优先级排序，可在编辑里调整"
        action={<button type="button" className="text-btn" onClick={() => onNavigate('list')}>查看全部 <Icon name="chevronRight" size={15} /></button>} />
      {stats.top3.length > 0 ? (
        <div className="feature-list">
          {stats.top3.map((item, index) => {
            const meta = CATEGORY_META[item.category];
            return (
              <div className="feature" key={item.id} style={CoverStyle(item.category)}>
                <button type="button" className="feature-main" onClick={() => onEdit(item)}>
                  <span className="feature-top">
                    <span>{meta.short}</span>
                    <span className="feature-rank">0{index + 1}</span>
                  </span>
                  <span className="feature-glyph">{item.cover ? <img src={item.cover} alt="" /> : meta.glyph}</span>
                  <span className="feature-bottom">
                    <b>{item.name}</b>
                    <small>{[item.brand, item.model].filter(Boolean).join(' · ') || '待补充型号 / 描述'}</small>
                  </span>
                </button>
                <button type="button" className="feature-check" aria-label={`完成 ${item.name}`}
                  onClick={() => { completeItem(item.id); notify(`已完成 · ${item.name}`); }}>
                  <Icon name="check" size={18} strokeWidth={2.4} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="还没有未完成的目标" hint="点右下角 + 添加一个新的愿望" />
      )}

      <SectionHead title="各分类进度" sub="每一项都算数" />
      <section className="card category-box">
        {stats.categories.map((c) => (
          <div className="category-row" key={c.id}>
            <div className="category-head">
              <span className="cat-dot" style={CoverStyle(c.id)} />
              <span>{CATEGORY_META[c.id].name}</span>
              <b>{c.done} / {c.total}</b>
            </div>
            <Bar value={c.pct} />
          </div>
        ))}
      </section>

      <SectionHead title="最近完成" sub="值得记住的每一次实现"
        action={<button type="button" className="text-btn" onClick={() => onNavigate('achieved')}>全部 <Icon name="chevronRight" size={15} /></button>} />
      {stats.recent.length > 0 ? (
        <section className="card recent-box">
          {stats.recent.slice(0, 4).map((item) => (
            <button type="button" className="recent-row" key={item.id} onClick={() => onEdit(item)}>
              <span className="recent-check"><Icon name="check" size={15} strokeWidth={2.4} /></span>
              <span className="recent-body"><b>{item.name}</b><small>{CATEGORY_META[item.category].short} · {formatDate(item.completedAt) || '日期未记录'}</small></span>
              <Icon name="chevronRight" size={16} />
            </button>
          ))}
        </section>
      ) : (
        <EmptyState icon="checkCircle" title="还没有已实现的目标" hint="在清单里点一下圆圈，就记录下第一次实现" />
      )}

      <button type="button" className="wide-cta" onClick={onAdd}>
        <Icon name="plus" size={19} /> 添加一个新的愿望
      </button>
      <p className="home-foot">数据仅保存在这台设备 · 不上传 · 不联网也能打开</p>
    </div>
  );
}
