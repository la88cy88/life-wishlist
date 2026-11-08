import { useState } from 'react';
import type { CSSProperties } from 'react';
import { CATEGORY_META, PRIORITY_META, STATUS_META, isDone } from '../types';
import type { WishItem } from '../types';
import { formatDate, formatMoney } from '../lib/format';
import { useWishlist } from '../store';
import { Icon } from './UI';

export function safeHref(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch (_) {
    return null;
  }
}

export function CoverStyle(category: WishItem['category']): CSSProperties {
  const meta = CATEGORY_META[category];
  return { '--cat-light': meta.light, '--cat-dark': meta.dark } as CSSProperties;
}

interface Props {
  item: WishItem;
  onEdit: (item: WishItem) => void;
  onDelete: (item: WishItem) => void;
}

export function WishCard({ item, onEdit, onDelete }: Props) {
  const { completeItem, reopenItem, notify } = useWishlist();
  const [open, setOpen] = useState(false);
  const [anim, setAnim] = useState(false);
  const done = isDone(item.status);
  const meta = CATEGORY_META[item.category];
  const price = formatMoney(item.currentPrice ?? item.targetPrice, item.currency);
  const href = safeHref(item.link);

  const toggleDone = () => {
    if (done) {
      reopenItem(item.id);
      notify('已恢复为「想拥有」');
    } else {
      completeItem(item.id);
      notify(`已完成 · ${item.name}`);
      setAnim(true);
      window.setTimeout(() => setAnim(false), 460);
    }
    if (navigator.vibrate) navigator.vibrate(9);
  };

  const detail: [string, string][] = [
    ['品牌', item.brand || '—'],
    ['型号 / 描述', item.model || '—'],
    ['分类', meta.name],
    ['当前状态', STATUS_META[item.status].name],
    ['优先级', PRIORITY_META[item.priority].name],
    ['计划年份', item.year ? `${item.year} 年` : '未设定'],
    ['目标价格', formatMoney(item.targetPrice, item.currency) || '未填写'],
    ['当前参考价', formatMoney(item.currentPrice, item.currency) || '未填写'],
    ['货币', item.currency],
    ['完成日期', formatDate(item.completedAt) || '—'],
  ];

  return (
    <article className={`wish-card${done ? ' is-done' : ''}`} data-item-id={item.id}>
      <button type="button" className="card-main" onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-label={`${item.name}，展开详情`}>
        <span className="cover" style={CoverStyle(item.category)}>
          {item.cover
            ? <img src={item.cover} alt="" loading="lazy" />
            : <span className="cover-glyph">{meta.glyph}</span>}
          <span className="cover-cat">{meta.short}</span>
        </span>
        <span className="card-info">
          <span className="card-title">{item.name}</span>
          <span className="card-sub">{[item.brand, item.model].filter(Boolean).join(' · ') || '未填写型号 / 描述'}</span>
          <span className="card-meta">
            <span className={`pill st-${item.status}`}>{STATUS_META[item.status].short}</span>
            {item.priority === 'high' && <span className="pill hot">高优先</span>}
            {price && <span className="pill">{price}</span>}
            {item.year && <span className="pill">{item.year}</span>}
          </span>
        </span>
        <span className={open ? 'card-chevron open' : 'card-chevron'}><Icon name="chevronDown" size={17} /></span>
      </button>

      <button type="button" className={`check-btn${done ? ' done' : ''}${anim ? ' just-done' : ''}`}
        onClick={toggleDone} aria-label={done ? `将 ${item.name} 恢复为想拥有` : `完成 ${item.name}`}>
        <Icon name="check" size={19} strokeWidth={2.4} />
      </button>

      {open && (
        <div className="card-detail">
          <div className="detail-grid">
            {detail.map(([k, v]) => (
              <div className="detail-line" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
          {item.note && <div className="detail-note"><span>备注</span><p>{item.note}</p></div>}
          {href && (
            <a className="detail-link" href={href} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={17} /> 打开资料链接
            </a>
          )}
          <div className="detail-actions">
            <button type="button" className="btn ghost" onClick={() => onEdit(item)}>
              <Icon name="edit" size={17} /> 编辑
            </button>
            {done && (
              <button type="button" className="btn ghost" onClick={toggleDone}>
                <Icon name="rotate" size={17} /> 恢复
              </button>
            )}
            <button type="button" className="btn ghost danger-text" onClick={() => onDelete(item)}>
              <Icon name="trash" size={17} /> 删除
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
