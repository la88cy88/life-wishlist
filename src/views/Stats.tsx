import {
  CATEGORY_META, PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER,
} from '../types';
import { formatMoney } from '../lib/format';
import { useWishlist } from '../store';
import { Bar, ProgressRing, SectionHead } from '../components/UI';
import { CoverStyle } from '../components/WishCard';

export function Stats() {
  const { stats, data } = useWishlist();
  const maxStatus = Math.max(1, ...STATUS_ORDER.map((s) => stats.statusCounts[s]));
  const maxPriority = Math.max(1, ...PRIORITY_ORDER.map((p) => stats.pendingPriority[p]));

  return (
    <div className="page">
      <header className="page-head compact">
        <span className="eyebrow">INSIGHTS</span>
        <h1>我的统计</h1>
        <p>只做记录，不设排行榜。</p>
      </header>

      <section className="card stats-hero">
        <ProgressRing value={stats.pct} size={140} stroke={13}>
          <span className="ring-num mid">{Math.round(stats.pct * 100)}<i>%</i></span>
          <span className="ring-cap">人生完成度</span>
        </ProgressRing>
        <div className="stats-numbers">
          <div><b>{stats.total}</b><span>总目标</span></div>
          <div><b>{stats.done}</b><span>已实现</span></div>
          <div><b>{stats.pending}</b><span>待实现</span></div>
        </div>
      </section>

      <SectionHead title="各分类完成度" sub="选中分类可在全部清单里筛选" />
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

      <SectionHead title="状态分布" />
      <section className="card bar-box">
        {STATUS_ORDER.map((s) => (
          <Bar key={s} value={stats.statusCounts[s] / maxStatus}
            label={STATUS_META[s].name} right={`${stats.statusCounts[s]} 项`} />
        ))}
      </section>

      <SectionHead title="待实现目标优先级" />
      <section className="card bar-box">
        {PRIORITY_ORDER.map((p) => (
          <Bar key={p} value={stats.pendingPriority[p] / maxPriority}
            label={`${PRIORITY_META[p].name}优先级`} right={`${stats.pendingPriority[p]} 项`} />
        ))}
      </section>

      <SectionHead title="预算概览" sub="只统计你亲自填写过价格的目标" />
      <section className="card budget-box">
        <div className="budget-main">
          <span>待实现目标参考合计</span>
          <b>{stats.budgetFilled ? formatMoney(stats.budgetSum, 'CNY') : '—'}</b>
          <small>可能混合多种货币，仅作量级参考。未核实的价格默认留空，不参与统计。</small>
        </div>
        <div className="budget-grid">
          <div><b>{stats.budgetFilled}</b><span>已填价格</span></div>
          <div><b>{stats.budgetMissing}</b><span>未填价格</span></div>
          <div><b>{data.items.filter((i) => i.year).length}</b><span>已定年份</span></div>
        </div>
      </section>

      {stats.byYear.length > 0 && (
        <>
          <SectionHead title="按计划年份" />
          <section className="card bar-box">
            {stats.byYear.map((y) => (
              <Bar key={y.year} value={y.count / Math.max(...stats.byYear.map((x) => x.count))}
                label={`${y.year} 年`} right={`${y.count} 项`} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
