import { useEffect, useState } from 'react';
import type { WishItem, WishlistData } from './types';
import { useWishlist } from './store';
import { BottomNav, ConfirmSheet, Icon, Toast } from './components/UI';
import type { ViewId } from './components/UI';
import { Editor } from './components/Editor';
import { Home } from './views/Home';
import { List } from './views/List';
import { Achieved } from './views/Achieved';
import { Stats } from './views/Stats';
import { Settings } from './views/Settings';

type ConfirmState =
  | { kind: 'delete'; item: WishItem }
  | { kind: 'clear' }
  | { kind: 'reset' }
  | { kind: 'import'; data: WishlistData };

export default function App() {
  const w = useWishlist();
  const [view, setView] = useState<ViewId>('home');
  const [editor, setEditor] = useState<{ open: boolean; item: WishItem | null }>({ open: false, item: null });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  /* 主题：跟随系统或手动覆盖，并同步 iOS 状态栏颜色 */
  useEffect(() => {
    const apply = () => {
      const mode = w.data.settings.theme;
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = mode === 'dark' || (mode === 'system' && systemDark);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const color = dark ? '#000000' : '#f2f2f5';
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => { m.content = color; });
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', apply);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', apply); };
  }, [w.data.settings.theme]);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const openAdd = () => setEditor({ open: true, item: null });
  const openEdit = (item: WishItem) => setEditor({ open: true, item });
  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));

  const requestDelete = (item: WishItem) => setConfirm({ kind: 'delete', item });

  const confirmProps = (() => {
    if (!confirm) return null;
    switch (confirm.kind) {
      case 'delete':
        return {
          title: `删除「${confirm.item.name}」？`,
          message: '这个目标及其备注、价格、封面图片会一并移除，不会进入已实现列表。',
          keyword: '删除', confirmLabel: '确认删除', danger: true,
        };
      case 'clear':
        return {
          title: '清空所有数据？',
          message: `将删除全部 ${w.data.items.length} 项目标，只保留空白应用。建议先导出 JSON 备份。`,
          keyword: '清空', confirmLabel: '确认清空', danger: true,
        };
      case 'reset':
        return {
          title: '恢复初始清单？',
          message: `当前的 ${w.data.items.length} 项目标会被 35 项默认模板替换，所有勾选与备注将丢失。`,
          keyword: '恢复', confirmLabel: '确认恢复', danger: true,
        };
      case 'import':
        return {
          title: '导入并覆盖？',
          message: `备份含 ${confirm.data.items.length} 项目标，将完整替换当前的 ${w.data.items.length} 项。建议先导出当前数据。`,
          confirmLabel: '覆盖并导入', danger: true,
        };
    }
  })();

  const onConfirm = () => {
    if (!confirm) return;
    switch (confirm.kind) {
      case 'delete':
        w.removeItem(confirm.item.id);
        w.notify('已删除目标');
        closeEditor();
        break;
      case 'clear':
        w.clearAll();
        w.notify('所有数据已清空');
        break;
      case 'reset':
        w.resetToSeed();
        w.notify('已恢复初始清单');
        break;
      case 'import':
        w.replaceData(confirm.data);
        w.notify(`已导入 ${confirm.data.items.length} 项目标`);
        break;
    }
    setConfirm(null);
  };

  const showFab = view !== 'settings' && !editor.open && !confirm;

  return (
    <>
      <div className="app">
        {w.migrationNotice && (
          <div className="migration-banner">
            <Icon name="info" size={18} />
            <span>{w.migrationNotice}</span>
            <button type="button" onClick={w.dismissMigration} aria-label="关闭提示"><Icon name="close" size={16} /></button>
          </div>
        )}

        <main key={view} className="view">
          {view === 'home' && <Home onNavigate={setView} onEdit={openEdit} onAdd={openAdd} />}
          {view === 'list' && <List onEdit={openEdit} onDelete={requestDelete} onAdd={openAdd} />}
          {view === 'achieved' && <Achieved onEdit={openEdit} onDelete={requestDelete} onNavigate={setView} />}
          {view === 'stats' && <Stats />}
          {view === 'settings' && (
            <Settings
              onRequestImport={(data) => setConfirm({ kind: 'import', data })}
              onRequestClear={() => setConfirm({ kind: 'clear' })}
              onRequestReset={() => setConfirm({ kind: 'reset' })}
            />
          )}
        </main>
      </div>

      {showFab && (
        <button type="button" className="fab" onClick={openAdd} aria-label="新增目标">
          <Icon name="plus" size={26} strokeWidth={2} />
        </button>
      )}

      <BottomNav view={view} onChange={setView} />

      <Editor open={editor.open} item={editor.item} onClose={closeEditor} onRequestDelete={requestDelete} />

      <ConfirmSheet
        open={confirm !== null}
        title={confirmProps?.title ?? ''}
        message={confirmProps?.message ?? ''}
        keyword={confirmProps?.keyword}
        confirmLabel={confirmProps?.confirmLabel}
        danger={confirmProps?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirm}
      />

      <Toast message={w.toast} />
    </>
  );
}
