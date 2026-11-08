import { useRef } from 'react';
import type { ThemeMode, WishlistData } from '../types';
import { DATA_VERSION } from '../types';
import { exportPayload, estimateBytes, parseImport, todayISO } from '../lib/storage';
import { formatBytes, relativeTime } from '../lib/format';
import { useWishlist } from '../store';
import { Icon, SectionHead, Segmented } from '../components/UI';

interface Props {
  onRequestImport: (data: WishlistData) => void;
  onRequestClear: () => void;
  onRequestReset: () => void;
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('文件读取失败'));
    fr.readAsText(file);
  });
}

export function Settings({ onRequestImport, onRequestClear, onRequestReset }: Props) {
  const { data, setTheme, notify, storageError } = useWishlist();
  const fileRef = useRef<HTMLInputElement>(null);

  const buildBackup = () => exportPayload(data);

  const doExport = () => {
    const blob = new Blob([buildBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-wishlist-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    notify('备份文件已生成');
  };

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildBackup());
      notify('JSON 已复制，可粘贴到别处保存');
    } catch (_) {
      notify('复制失败，请改用「导出 JSON 文件」');
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseImport(await readFileText(file));
      onRequestImport(parsed);
    } catch (e) {
      notify(e instanceof Error ? e.message : '导入失败');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const bytes = estimateBytes(data);

  return (
    <div className="page">
      <header className="page-head compact">
        <span className="eyebrow">SETTINGS</span>
        <h1>设置</h1>
        <p>外观、备份与隐私。</p>
      </header>

      <SectionHead title="外观" />
      <section className="card setting-box">
        <div className="setting-line">
          <div className="setting-icon"><Icon name="moon" size={19} /></div>
          <div className="setting-text"><b>主题</b><span>默认跟随 iOS 系统深色模式</span></div>
        </div>
        <Segmented<ThemeMode> value={data.settings.theme}
          options={[{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]}
          onChange={(v) => { setTheme(v); notify(v === 'system' ? '已跟随系统外观' : v === 'dark' ? '已切换深色' : '已切换浅色'); }} compact />
      </section>

      <SectionHead title="保存状态" />
      <section className="card setting-box">
        <div className="kv"><span>最后一次保存</span><b>{relativeTime(data.settings.lastSavedAt)}</b></div>
        <div className="kv"><span>目标条目</span><b>{data.items.length} 项</b></div>
        <div className="kv"><span>占用空间（估算）</span><b>{formatBytes(bytes)}</b></div>
        <div className="kv"><span>数据结构版本</span><b>v{DATA_VERSION}</b></div>
        {storageError && <p className="storage-error">⚠ {storageError}</p>}
        <p className="setting-hint">每次勾选、编辑都会立即写入本机 localStorage；结构升级前会自动留一份原始备份。</p>
      </section>

      <SectionHead title="数据备份" sub="换手机 / 换浏览器前请先导出" />
      <section className="card setting-box actions">
        <input ref={fileRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => void onPickFile(e.target.files?.[0])} />
        <button type="button" className="row-btn" onClick={doExport}>
          <Icon name="download" size={19} /><span><b>导出 JSON 文件</b><small>下载一份完整备份到本机</small></span><Icon name="chevronRight" size={16} />
        </button>
        <button type="button" className="row-btn" onClick={() => void doCopy()}>
          <Icon name="link" size={19} /><span><b>复制 JSON 到剪贴板</b><small>iOS 下载受限时的备用方案</small></span><Icon name="chevronRight" size={16} />
        </button>
        <button type="button" className="row-btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={19} /><span><b>导入 JSON 并恢复</b><small>会先确认，再覆盖当前 {data.items.length} 项</small></span><Icon name="chevronRight" size={16} />
        </button>
        <div className="row-sep" />
        <button type="button" className="row-btn" onClick={onRequestReset}>
          <Icon name="rotate" size={19} /><span><b>恢复初始清单</b><small>回到 35 项默认模板（需两步确认）</small></span><Icon name="chevronRight" size={16} />
        </button>
        <button type="button" className="row-btn danger-text" onClick={onRequestClear}>
          <Icon name="trash" size={19} /><span><b>清空所有数据</b><small>删除全部目标，不可撤销（需两步确认）</small></span><Icon name="chevronRight" size={16} />
        </button>
      </section>

      <SectionHead title="隐私与数据安全" />
      <section className="card privacy-box">
        <div className="privacy-icon"><Icon name="shield" size={22} /></div>
        <h3>你的数据只在这台设备上</h3>
        <ul>
          <li>所有勾选、备注、价格、图片只写入当前浏览器的 <b>localStorage</b>，应用不会向任何服务器或第三方发送数据，页面本身也没有统计、埋点或外部资源。</li>
          <li><b>GitHub 仓库只保存程序源代码</b>和你指定的 35 项初始模板，不包含你的任何个人清单、导出文件或备份。</li>
          <li><b>GitHub Pages 不会同步设备之间的数据。</b>在 iPhone 上勾选后，电脑打开同一网址看到的仍是各自设备上的独立数据；换手机、换浏览器或清除网站数据都会丢失本机记录，请自行导出 JSON 备份。</li>
          <li>本仓库为 Public（当前 Free 套餐不支持 Private 仓库启用 Pages）。别人打开链接只会看到自己设备上的初始清单，<b>看不到你的数据</b>。</li>
        </ul>
      </section>

      <SectionHead title="添加到 iPhone 主屏幕" />
      <section className="card steps-box">
        <ol>
          <li><span>1</span>用 <b>Safari</b> 打开本页面的 https 地址</li>
          <li><span>2</span>点底部「分享」按钮 → 下滑找到「添加到主屏幕」</li>
          <li><span>3</span>确认名称「人生清单」→ 点「添加」</li>
          <li><span>4</span>从主屏幕图标打开，即为全屏独立 App，断网也能用</li>
        </ol>
        <p>首次打开需联网一次，Service Worker 会把应用外壳与资源缓存到本机，之后即可离线运行。</p>
      </section>

      <SectionHead title="关于" />
      <section className="card setting-box">
        <div className="kv"><span>应用</span><b>Life Wishlist 1.0.0</b></div>
        <div className="kv"><span>技术栈</span><b>React + TypeScript + Vite</b></div>
        <div className="kv"><span>部署</span><b>GitHub Pages / Actions</b></div>
        <div className="kv"><span>运行方式</span><b>纯前端 · PWA · 离线可用</b></div>
      </section>
      <p className="home-foot">把想要的生活，一项项实现。</p>
    </div>
  );
}
