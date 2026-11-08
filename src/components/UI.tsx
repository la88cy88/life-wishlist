import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';

/* ---------------- 线性图标（纯 SVG，无第三方依赖、无网络请求） ---------------- */
const ICONS: Record<string, string[]> = {
  home: ['M3 10.6 12 3.2l9 7.4V20a1 1 0 0 1-1 1h-5.2v-6.2H9.2V21H4a1 1 0 0 1-1-1z'],
  list: ['M9 6h12', 'M9 12h12', 'M9 18h12', 'M3.6 6h.01', 'M3.6 12h.01', 'M3.6 18h.01'],
  checkCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm8.3 12.2 2.5 2.5 4.9-5.2'],
  chart: ['M3 20h18', 'M6.5 17V11', 'M11.5 17V5', 'M16.5 17v-7'],
  settings: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9', 'M15 4v6', 'M8 14v6'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm17 17 4 4'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 6 6 6-6 6'],
  link: ['M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.3 1.3', 'M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.3-1.3'],
  edit: ['M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z', 'M14.5 6.5l3 3'],
  trash: ['M4 7h16', 'M9 7V4.5h6V7', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  camera: ['M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z', 'M12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 19h16'],
  upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 19h16'],
  sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z'],
  check: ['m5 12.5 4.5 4.5L19 7'],
  rotate: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  shield: ['M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6z', 'm9 12 2 2 4-4'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5', 'M12 7.6h.01'],
  sparkle: ['M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4z', 'M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'],
  calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5'],
};

export function Icon({ name, size = 22, strokeWidth = 1.7 }: { name: string; size?: number; strokeWidth?: number }) {
  const paths = ICONS[name] ?? ICONS.info;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ---------------- 环形进度 ---------------- */
export function ProgressRing({
  value, size = 188, stroke = 15, children,
}: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2 - 3;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ring-a)" />
            <stop offset="55%" stopColor="var(--ring-b)" />
            <stop offset="100%" stopColor="var(--ring-c)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle className="ring-fg" cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#g-${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/* ---------------- 分段落选择器 ---------------- */
export function Segmented<T extends string>({
  value, options, onChange, compact = false,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; compact?: boolean }) {
  return (
    <div className={compact ? 'seg seg-compact' : 'seg'} role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'on' : ''}
          aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- 进度条 ---------------- */
export function Bar({ value, label, right }: { value: number; label?: string; right?: string }) {
  const p = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="bar-row">
      {(label || right) && (
        <div className="bar-label"><span>{label}</span><span>{right ?? `${p}%`}</span></div>
      )}
      <div className="bar"><i style={{ width: `${p}%` }} /></div>
    </div>
  );
}

/* ---------------- 区块标题 ---------------- */
export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      {action}
    </div>
  );
}

/* ---------------- 底部弹出面板 ---------------- */
export function Sheet({
  open, title, onClose, action, children,
}: { open: boolean; title: string; onClose: () => void; action?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <button type="button" className="sheet-btn" onClick={onClose}>取消</button>
          <strong>{title}</strong>
          <div className="sheet-action">{action}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- 二次确认面板 ----------------
 * keyword 存在时走两步：先说明 → 再手动输入关键词，避免误触删除/清空。 */
export function ConfirmSheet({
  open, title, message, keyword, confirmLabel = '确认', danger = false, onCancel, onConfirm,
}: {
  open: boolean; title: string; message: string; keyword?: string;
  confirmLabel?: string; danger?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) { setStep(1); setTyped(''); } }, [open]);
  if (!open) return null;

  const finish = () => { onConfirm(); setStep(1); setTyped(''); };
  const cancel = () => { onCancel(); setStep(1); setTyped(''); };

  return (
    <div className="overlay overlay-center" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="confirm" role="alertdialog" aria-modal="true">
        <div className={danger ? 'confirm-icon danger' : 'confirm-icon'}><Icon name={danger ? 'trash' : 'info'} size={24} /></div>
        <h3>{title}</h3>
        <p>{step === 1 ? message : `此操作不可撤销。请输入「${keyword}」以确认。`}</p>
        {step === 2 && keyword && (
          <input className="confirm-input" value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder={`请输入 ${keyword}`} autoComplete="off" autoCapitalize="off" />
        )}
        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={cancel}>取消</button>
          {step === 1 ? (
            <button type="button" className={danger ? 'btn danger' : 'btn primary'}
              onClick={() => (keyword ? setStep(2) : finish())}>
              {keyword ? '继续' : confirmLabel}
            </button>
          ) : (
            <button type="button" className="btn danger" disabled={typed.trim() !== keyword} onClick={finish}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 轻提示 ---------------- */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast" role="status"><Icon name="check" size={16} />{message}</div>;
}

/* ---------------- 底部导航 ---------------- */
export type ViewId = 'home' | 'list' | 'achieved' | 'stats' | 'settings';

const TABS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'list', label: '全部清单', icon: 'list' },
  { id: 'achieved', label: '已实现', icon: 'checkCircle' },
  { id: 'stats', label: '我的统计', icon: 'chart' },
  { id: 'settings', label: '设置', icon: 'settings' },
];

export function BottomNav({ view, onChange }: { view: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <nav className="tabbar" aria-label="主导航">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={view === t.id ? 'tab on' : 'tab'}
            aria-current={view === t.id ? 'page' : undefined} onClick={() => onChange(t.id)}>
            <Icon name={t.icon} size={23} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function EmptyState({ icon = 'sparkle', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}
