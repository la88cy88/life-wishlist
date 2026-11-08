import { useEffect, useRef, useState } from 'react';
import {
  CATEGORY_META, CATEGORY_ORDER, CURRENCIES, PRIORITY_META, PRIORITY_ORDER,
  STATUS_META, STATUS_ORDER, isDone,
} from '../types';
import type { CategoryId, Priority, Status, WishItem } from '../types';
import { todayISO } from '../lib/storage';
import { formatMoney } from '../lib/format';
import { useWishlist } from '../store';
import type { NewItemInput } from '../store';
import { Icon, Segmented, Sheet } from './UI';
import { CoverStyle } from './WishCard';

interface FormState {
  name: string;
  brand: string;
  model: string;
  category: CategoryId;
  status: Status;
  priority: Priority;
  cover: string | null;
  link: string;
  targetPrice: string;
  currentPrice: string;
  currency: string;
  year: string;
  completedAt: string;
  note: string;
}

const blank = (): FormState => ({
  name: '', brand: '', model: '', category: 'tech', status: 'want', priority: 'medium',
  cover: null, link: '', targetPrice: '', currentPrice: '', currency: 'CNY',
  year: '', completedAt: '', note: '',
});

const fromItem = (i: WishItem): FormState => ({
  name: i.name, brand: i.brand, model: i.model, category: i.category, status: i.status,
  priority: i.priority, cover: i.cover, link: i.link ?? '', targetPrice: i.targetPrice === null ? '' : String(i.targetPrice),
  currentPrice: i.currentPrice === null ? '' : String(i.currentPrice), currency: i.currency,
  year: i.year === null ? '' : String(i.year), completedAt: i.completedAt ?? '', note: i.note,
});

/** 图片压缩到最长边 900px 的 JPEG，避免 localStorage 5MB 配额被撑爆。 */
async function compressImage(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error('图片超过 15MB，请换一张');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('文件读取失败'));
    fr.readAsDataURL(file);
  });
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('浏览器不支持图片处理')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => reject(new Error('图片格式无法识别'));
    img.src = dataUrl;
  });
}

interface Props {
  open: boolean;
  /** null 表示新增 */
  item: WishItem | null;
  onClose: () => void;
  onRequestDelete: (item: WishItem) => void;
}

export function Editor({ open, item, onClose, onRequestDelete }: Props) {
  const { addItem, updateItem, notify } = useWishlist();
  const [form, setForm] = useState<FormState>(blank);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setForm(item ? fromItem(item) : blank());
  }, [open, item]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      patch('cover', compressed);
      notify('封面已更新（已压缩以节省本机空间）');
    } catch (e) {
      notify(e instanceof Error ? e.message : '图片处理失败');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) { notify('请填写目标名称'); return; }
    const num = (v: string) => {
      const t = v.trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const y = num(form.year);
    const payload: NewItemInput = {
      name,
      brand: form.brand.trim(),
      model: form.model.trim(),
      category: form.category,
      status: form.status,
      priority: form.priority,
      cover: form.cover,
      link: form.link.trim() || null,
      targetPrice: num(form.targetPrice),
      currentPrice: num(form.currentPrice),
      currency: form.currency,
      year: y && y >= 1900 && y <= 2200 ? Math.round(y) : null,
      completedAt: isDone(form.status) ? (form.completedAt || todayISO()) : null,
      note: form.note.trim(),
    };
    if (item) {
      updateItem(item.id, payload);
      notify('已保存修改');
    } else {
      addItem(payload);
      notify('已加入我的人生清单');
    }
    onClose();
  };

  return (
    <Sheet open={open} title={item ? '编辑目标' : '新增目标'} onClose={onClose}
      action={<button type="button" className="btn primary small" onClick={save}>保存</button>}>
      <div className="form-note">
        价格、年份、链接默认留空，未核实的信息不会自动填写；型号随时可以改。
      </div>

      <div className="form-group">
        <h4>基本信息</h4>
        <label className="field">
          <span>目标名称 <em>*</em></span>
          <input value={form.name} onChange={(e) => patch('name', e.target.value)} placeholder="例如：理想住宅" />
        </label>
        <label className="field">
          <span>品牌</span>
          <input value={form.brand} onChange={(e) => patch('brand', e.target.value)} placeholder="可留空" />
        </label>
        <label className="field">
          <span>产品型号 / 目标描述</span>
          <input value={form.model} onChange={(e) => patch('model', e.target.value)} placeholder="型号换代后可随时修改" />
        </label>
      </div>

      <div className="form-group">
        <h4>视觉封面</h4>
        <div className="cover-editor">
          <div className="cover-preview" style={CoverStyle(form.category)}>
            {form.cover ? <img src={form.cover} alt="封面预览" /> : <span>{CATEGORY_META[form.category].glyph}</span>}
          </div>
          <div className="cover-editor-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => void onPickImage(e.target.files?.[0])} />
            <button type="button" className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon name="camera" size={17} /> {busy ? '处理中…' : '上传 / 更换图片'}
            </button>
            <button type="button" className="btn ghost" onClick={() => patch('cover', null)}>移除封面</button>
            <p>图片会压缩后仅保存在本机，不会上传。</p>
          </div>
        </div>
        <label className="field">
          <span>或填写图片链接（可选）</span>
          <input value={form.cover?.startsWith('http') ? form.cover : ''}
            onChange={(e) => patch('cover', e.target.value.trim() || null)} placeholder="https://…" />
        </label>
      </div>

      <div className="form-group">
        <h4>分类</h4>
        <Segmented value={form.category}
          options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_META[c].short }))}
          onChange={(v) => patch('category', v)} compact />
      </div>

      <div className="form-group">
        <h4>当前状态</h4>
        <Segmented value={form.status}
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].name }))}
          onChange={(v) => patch('status', v)} compact />
      </div>

      <div className="form-group">
        <h4>优先级</h4>
        <Segmented value={form.priority}
          options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_META[p].name }))}
          onChange={(v) => patch('priority', v)} compact />
      </div>

      <div className="form-group">
        <h4>预算</h4>
        <div className="field-row">
          <label className="field">
            <span>目标价格</span>
            <input inputMode="decimal" value={form.targetPrice}
              onChange={(e) => patch('targetPrice', e.target.value)} placeholder="留空" />
          </label>
          <label className="field">
            <span>当前参考价格</span>
            <input inputMode="decimal" value={form.currentPrice}
              onChange={(e) => patch('currentPrice', e.target.value)} placeholder="留空" />
          </label>
        </div>
        <label className="field">
          <span>货币</span>
          <select value={form.currency} onChange={(e) => patch('currency', e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {(form.targetPrice || form.currentPrice) && (
          <p className="field-hint">参考显示：{formatMoney(Number(form.currentPrice || form.targetPrice) || 0, form.currency)}</p>
        )}
      </div>

      <div className="form-group">
        <h4>时间与链接</h4>
        <div className="field-row">
          <label className="field">
            <span>计划实现年份</span>
            <input inputMode="numeric" value={form.year} onChange={(e) => patch('year', e.target.value)} placeholder="例如 2028" />
          </label>
          <label className="field">
            <span>完成日期</span>
            <input type="date" value={form.completedAt} onChange={(e) => patch('completedAt', e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>官方产品链接 / 资料链接</span>
          <input inputMode="url" value={form.link} onChange={(e) => patch('link', e.target.value)} placeholder="https://…（可留空）" />
        </label>
      </div>

      <div className="form-group">
        <h4>个人备注</h4>
        <label className="field">
          <textarea rows={4} value={form.note} onChange={(e) => patch('note', e.target.value)}
            placeholder="想为什么实现、型号对比、预算来源……" />
        </label>
      </div>

      {item && (
        <div className="form-group">
          <h4>危险操作</h4>
          <button type="button" className="btn ghost danger-text full" onClick={() => onRequestDelete(item)}>
            <Icon name="trash" size={17} /> 删除这个目标
          </button>
          <p className="field-hint">创建于 {item.createdAt.slice(0, 10)} · 删除需要两步确认</p>
        </div>
      )}
      <div className="form-tail">所有内容只保存在这台设备的浏览器里。</div>
    </Sheet>
  );
}
