/* 本地验收脚本：npm run verify
 *  1. 静态检查：构建产物、PWA 清单/图标、Service Worker、安全（无令牌、无外联请求）
 *  2. 逻辑测试：真实打包 TS 数据层，在 Node 里跑 CRUD / 统计 / 筛选 / 迁移 / 导入导出
 *  3. 浏览器测试：启动本机静态服务 + 无头 Chrome(CDP)，以 iPhone 390x844 视口真实点击
 *     —— 渲染、勾选、刷新持久化、增删改、主题、触控区、离线重载
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const results = [];
const note = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ==================== 1. 静态检查 ==================== */
function staticChecks() {
  console.log('\n[1/3] 构建产物与 PWA 静态检查');
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.webmanifest'), 'utf8'));
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');

  note('构建产物齐全', ['index.html', 'manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']
    .every((f) => fs.existsSync(path.join(DIST, f))));
  note('iOS 全屏 / 安全区 meta', /viewport-fit=cover/.test(html) && /apple-mobile-web-app-capable/.test(html) && /apple-touch-icon/.test(html));
  note('PWA manifest 可安装', manifest.display === 'standalone' && manifest.icons.length >= 2 && !!manifest.start_url);

  const iconsOK = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]].every(([f, size]) => {
    const b = fs.readFileSync(path.join(DIST, 'icons', f));
    return b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.readUInt32BE(16) === size && b.readUInt32BE(20) === size;
  });
  note('图标为合法 PNG 且尺寸正确（192/512/180）', iconsOK);

  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => u.includes('/assets/'));
  const refsExist = refs.length > 0 && refs.every((u) => fs.existsSync(path.join(DIST, u.replace('/life-wishlist/', ''))));
  note('index.html 引用的 JS/CSS 均存在且带 base 路径', refsExist, `${refs.length} 个资源`);

  note('Service Worker 具备离线三段逻辑', /addEventListener\('install'/.test(sw) && /addEventListener\('activate'/.test(sw) && /addEventListener\('fetch'/.test(sw) && /caches/.test(sw));
  note('Service Worker 只处理同源请求', /url\.origin !== self\.location\.origin/.test(sw));

  const jsFiles = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js'));
  const js = jsFiles.map((f) => fs.readFileSync(path.join(DIST, 'assets', f), 'utf8')).join('\n');
  // Vite 会注入一段同源 modulepreload polyfill（fetch(link.href)），这是唯一的 fetch。
  const fetchCalls = (js.match(/\bfetch\s*\(/g) || []).length;
  const externalOrTracking = /fetch\s*\(\s*["'`]https?:|sendBeacon|XMLHttpRequest|google-analytics|googletagmanager|mixpanel|segment\.io/.test(js);
  note('无第三方上报 / 无外联 fetch（仅 Vite 同源预加载）', !externalOrTracking && fetchCalls <= 1,
    `fetch 调用 ${fetchCalls} 处`);
  note('构建包体积适合移动网络', fs.statSync(path.join(DIST, 'assets', jsFiles[0])).size < 260_000,
    `${(fs.statSync(path.join(DIST, 'assets', jsFiles[0])).size / 1024).toFixed(0)} KB JS`);

  const walk = (dir, acc = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', '.tmp-chrome'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc); else acc.push(p);
    }
    return acc;
  };
  const sources = walk(ROOT).filter((p) => /\.(ts|tsx|js|mjs|json|yml|html|css|md)$/.test(p));
  // 动态拼装，避免检测脚本自身的模式串被当成「疑似令牌」
  const SECRET_RE = new RegExp('gh[pousr]_' + '[A-Za-z0-9]{20,}|' + 'github' + '_pat_', 'i');
  const leaked = sources.filter((p) => SECRET_RE.test(fs.readFileSync(p, 'utf8')));
  note('源码与配置中无 GitHub Token', leaked.length === 0, leaked.length ? leaked.join(', ') : `${sources.length} 个文件已扫描`);
}

/* ==================== 2. 数据层逻辑测试 ==================== */
async function logicTests() {
  console.log('\n[2/3] 数据层逻辑测试（真实打包 TS 后运行）');
  const tmp = path.join(ROOT, 'scripts', '.tmp-logic.mjs');
  await esbuild.build({
    stdin: {
      contents: `export * from '../src/types.ts';
export * from '../src/lib/storage.ts';
export * from '../src/lib/selectors.ts';
export * from '../src/lib/format.ts';
export * from '../src/data/seed.ts';`,
      resolveDir: path.join(ROOT, 'scripts'),
      loader: 'ts',
    },
    bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'silent',
  });

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const M = await import(pathToFileURL(tmp).href + '?t=' + Date.now());

  const seed = M.createSeedData();
  note('初始清单 35 项 / 4 分类', seed.items.length === 35 && seed.items.length === M.SEED_ITEM_COUNT,
    `实际 ${seed.items.length} 项`);
  note('Tesla Model 3 已拥有且购入日期 2024-01-30', (() => {
    const t = seed.items.find((i) => i.name === '已拥有汽车');
    return !!t && t.brand === 'Tesla' && t.model === 'Model 3' && t.status === 'owned' && t.completedAt === '2024-01-30';
  })());
  note('价格 / 链接 / 年份默认留空，货币默认 CNY', seed.items.every((i) =>
    i.targetPrice === null && i.currentPrice === null && i.link === null && i.year === null && i.currency === 'CNY'));
  note('除 Tesla 外全部未勾选', seed.items.filter((i) => M.isDone(i.status)).length === 1);

  const s = M.computeStats(seed);
  note('统计：总 35 / 已完成 1 / 待实现 34', s.total === 35 && s.done === 1 && s.pending === 34 && Math.abs(s.pct - 1 / 35) < 1e-9);
  note('分类计数 7 / 9 / 7 / 12', s.categories.map((c) => c.total).join(',') === '7,9,7,12');
  note('首页取到 3 个高优先级目标', s.top3.length === 3 && s.top3.every((i) => i.priority === 'high'));
  note('最近完成包含 Tesla', s.recent[0]?.name === '已拥有汽车');

  const f = (id) => M.filterItems(seed.items, id, '').length;
  note('筛选：全部35 / 数码7 / 家居9 / 品位7 / 体验12',
    f('all') === 35 && f('tech') === 7 && f('home') === 9 && f('auto') === 7 && f('life') === 12);
  note('筛选：已实现1 / 未实现34 / 高优先8 / 暂缓0',
    f('done') === 1 && f('pending') === 34 && f('high') === 8 && f('paused') === 0, `高优先=${f('high')}`);
  note('关键词搜索 Dyson→2 / Leica→1 / 无结果→0',
    M.filterItems(seed.items, 'all', 'Dyson').length === 2 && M.filterItems(seed.items, 'all', 'Leica').length === 1 && M.filterItems(seed.items, 'all', 'zzzz').length === 0);

  M.saveData(seed);
  const roundtrip = M.loadData();
  note('localStorage 保存 / 读取往返一致', roundtrip.data.items.length === 35 && !roundtrip.migrated
    && roundtrip.data.items.find((i) => i.name === '已拥有汽车')?.status === 'owned');

  store.set(M.STORAGE_KEY, JSON.stringify({ goals: [{ title: '旧版目标', desc: '兼容测试', done: true, price: 1200 }], settings: {} }));
  const migrated = M.loadData();
  note('v1 旧结构自动迁移并保留原始备份', migrated.migrated && migrated.data.version === M.DATA_VERSION
    && migrated.data.items[0].name === '旧版目标' && M.isDone(migrated.data.items[0].status)
    && migrated.data.items[0].targetPrice === 1200 && store.has(M.BACKUP_KEY));

  const payload = M.exportPayload(seed);
  const parsed = M.parseImport(payload);
  note('JSON 导出 → 导入往返一致', parsed.items.length === 35 && parsed.items[0].name === seed.items[0].name);
  let badJson = false, emptyGuard = false, wrongApp = false;
  try { M.parseImport('{坏}'); } catch (_) { badJson = true; }
  try { M.parseImport(JSON.stringify({ app: 'life-wishlist', items: [] })); } catch (_) { emptyGuard = true; }
  try { M.parseImport(JSON.stringify({ app: 'other-app', items: [{ name: 'x' }] })); } catch (_) { wrongApp = true; }
  note('导入校验：坏 JSON / 空清单 / 非本应用文件均被拒绝', badJson && emptyGuard && wrongApp);
  note('重复 id 自动去重', M.normalizeData({ items: [{ id: 'dup', name: 'A' }, { id: 'dup', name: 'B' }] }).items.length === 2
    && new Set(M.normalizeData({ items: [{ id: 'dup', name: 'A' }, { id: 'dup', name: 'B' }] }).items.map((i) => i.id)).size === 2);
  note('金额格式化为中文人民币', M.formatMoney(12345.5, 'CNY') === '¥12,345.5');
  note('勾选状态映射：体验→已实现 / 商品→已拥有', M.doneStatusFor('life') === 'achieved' && M.doneStatusFor('tech') === 'owned');

  fs.rmSync(tmp, { force: true });
}

/* ==================== 3. 真实浏览器测试 ==================== */
function startStaticServer() {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const BASE = '/life-wishlist/';
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(BASE)) { res.writeHead(404); res.end('not found'); return; }
    let rel = pathname.slice(BASE.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Service-Worker-Allowed': BASE, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function findChrome() {
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ]) if (fs.existsSync(p)) return p;
  return null;
}

async function browserTests() {
  console.log('\n[3/3] 无头 Chrome 真实交互测试（iPhone 390×844 视口）');
  const chrome = findChrome();
  if (!chrome) { note('找到可用浏览器', false, '跳过浏览器测试'); return; }

  const { server, port } = await startStaticServer();
  const url = `http://127.0.0.1:${port}/life-wishlist/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lw-chrome-'));
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=390,844', url,
  ], { stdio: 'ignore' });

  let ws = null;
  try {
    // 等待 Chrome 写出 DevToolsActivePort
    let cdpPort = null;
    for (let i = 0; i < 60; i++) {
      const f = path.join(profile, 'DevToolsActivePort');
      if (fs.existsSync(f)) { cdpPort = Number(fs.readFileSync(f, 'utf8').split('\n')[0]); break; }
      await sleep(250);
    }
    if (!cdpPort) throw new Error('Chrome 未启动 CDP');

    const getJSON = (p) => new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${cdpPort}${p}`, (r) => {
        let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
      }).on('error', reject);
    });
    let target = null;
    for (let i = 0; i < 40; i++) {
      const list = await getJSON('/json/list').catch(() => []);
      target = list.find((t) => t.type === 'page' && t.url.includes('life-wishlist'));
      if (target) break;
      await sleep(250);
    }
    if (!target) throw new Error('找不到页面 target');

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP 超时: ' + method)); } }, 20000);
    });
    const ev = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const waitFor = async (expression, timeout = 8000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        try { if (await ev(expression)) return true; } catch (_) { /* 上下文重建时重试 */ }
        await sleep(120);
      }
      return false;
    };
    const ensureDetail = async (id) => {
      await ev(`(()=>{const c=document.querySelector('[data-item-id="${id}"]');if(c&&!c.querySelector('.card-detail'))c.querySelector('.card-main').click();return !!c})()`);
      return waitFor(`!!document.querySelector('[data-item-id="${id}"] .card-detail')`);
    };
    // LW_SHOTS=1 时额外导出 iPhone 视口截图，便于人工检查视觉
    const SHOTS = process.env.LW_SHOTS === '1';
    const shotDir = path.join(ROOT, 'screenshots');
    if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
    const shot = async (name) => {
      if (!SHOTS) return;
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(shotDir, `${name}.png`), Buffer.from(r.data, 'base64'));
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    // 无头 Chrome 默认偏暗，显式模拟 iOS 浅色外观，保证截图与默认体验一致
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

    note('首页渲染，标题与副标题正确', await waitFor(
      `document.querySelector('.page-head h1')?.textContent === '我的人生清单' && document.querySelector('.page-head p')?.textContent.includes('把想要的生活，一项项实现')`));
    const initial = await ev(`({total:document.querySelector('[data-testid=stat-total]')?.textContent, done:document.querySelector('[data-testid=stat-done]')?.textContent, pending:document.querySelector('[data-testid=stat-pending]')?.textContent, pct:document.querySelector('[data-testid=overall-pct]')?.textContent, features:document.querySelectorAll('.feature').length, cats:document.querySelectorAll('.category-row').length, recent:document.querySelectorAll('.recent-row').length})`);
    note('首页数字 / 环形进度 / 3 个最想实现 / 4 类进度 / 最近完成',
      initial.total === '35' && initial.done === '1' && initial.pending === '34' && initial.pct === '3%' &&
      initial.features === 3 && initial.cats === 4 && initial.recent === 1, JSON.stringify(initial));
    await shot('home-light');

    // 底部导航 → 全部清单
    await ev(`document.querySelectorAll('.tab')[1].click()`);
    await waitFor(`document.querySelectorAll('.wish-card').length > 0`);
    await shot('list-light');
    note('切换分类视图：全部清单显示 35 张卡片',
      (await ev(`document.querySelectorAll('.wish-card').length`)) === 35);

    // 筛选 + 搜索
    await ev(`[...document.querySelectorAll('.chip')].find(b=>b.textContent==='科技数码').click()`);
    await sleep(150);
    const techCount = await ev(`document.querySelectorAll('.wish-card').length`);
    await ev(`[...document.querySelectorAll('.chip')].find(b=>b.textContent==='全部目标').click()`);
    await sleep(150);
    note('分类筛选生效（科技数码 7 项）', techCount === 7, `实际 ${techCount}`);

    // 勾选 → 进度更新 → 记录完成日期
    await ev(`document.querySelector('.wish-card:not(.is-done) .check-btn').click()`);
    await sleep(250);
    const afterCheck = await ev(`(()=>{const d=JSON.parse(localStorage.getItem('life-wishlist:data'));const done=d.items.filter(i=>i.status==='owned'||i.status==='achieved');return {done:done.length,hasDate:done.every(i=>!!i.completedAt),lastSaved:!!d.settings.lastSavedAt}})()`);
    note('勾选后状态变为已拥有 / 写入完成日期 / 更新保存时间',
      afterCheck.done === 2 && afterCheck.hasDate && afterCheck.lastSaved, JSON.stringify(afterCheck));

    // 刷新 → 数据保留
    await send('Page.reload');
    await waitFor(`document.querySelector('[data-testid=stat-done]')?.textContent === '2'`);
    note('刷新页面后勾选进度保留', (await ev(`document.querySelector('[data-testid=stat-done]')?.textContent`)) === '2');

    // 新增
    await ev(`document.querySelectorAll('.tab')[1].click()`);
    await waitFor(`document.querySelectorAll('.wish-card').length > 0`);
    await ev(`document.querySelector('.fab').click()`);
    await waitFor(`!!document.querySelector('.sheet')`);
    await ev(`(()=>{const el=document.querySelector('.sheet .field input');const s=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;s.call(el,'测试目标');el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await ev(`document.querySelector('.sheet-action .btn.primary').click()`);
    await waitFor(`JSON.parse(localStorage.getItem('life-wishlist:data')).items.length === 36`);
    note('新增目标（表单填写 → 保存 → 落盘）',
      (await ev(`JSON.parse(localStorage.getItem('life-wishlist:data')).items.length`)) === 36);

    // 编辑
    const newId = await ev(`(()=>{const c=[...document.querySelectorAll('.wish-card')].find(x=>x.textContent.includes('测试目标'));return c?.dataset.itemId||''})()`);
    await ensureDetail(newId);
    await ev(`document.querySelector('[data-item-id="${newId}"] .detail-actions .btn.ghost').click()`);
    await waitFor(`document.querySelector('.sheet-head strong')?.textContent === '编辑目标'`);
    await ev(`(()=>{const el=document.querySelector('.sheet .field input');const s=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;s.call(el,'测试目标（已改）');el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await ev(`document.querySelector('.sheet-action .btn.primary').click()`);
    await waitFor(`[...document.querySelectorAll('.card-title')].some(x=>x.textContent==='测试目标（已改）')`);
    note('编辑目标并保存', await ev(`JSON.parse(localStorage.getItem('life-wishlist:data')).items.some(i=>i.name==='测试目标（已改）')`));

    // 删除（两步确认）
    await ensureDetail(newId);
    await ev(`document.querySelector('[data-item-id="${newId}"] .detail-actions .danger-text').click()`);
    await waitFor(`!!document.querySelector('.confirm')`);
    const step1 = await ev(`document.querySelector('.confirm-actions .btn.danger')?.textContent`);
    await ev(`document.querySelector('.confirm-actions .btn.danger').click()`);
    await sleep(180);
    const hasInput = await ev(`!!document.querySelector('.confirm-input')`);
    await ev(`(()=>{const el=document.querySelector('.confirm-input');const s=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;s.call(el,'删除');el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await sleep(120);
    await ev(`document.querySelector('.confirm-actions .btn.danger').click()`);
    await waitFor(`JSON.parse(localStorage.getItem('life-wishlist:data')).items.length === 35`);
    note('删除目标需两步确认（继续 → 输入「删除」）',
      step1 === '继续' && hasInput && (await ev(`JSON.parse(localStorage.getItem('life-wishlist:data')).items.length`)) === 35);

    // 主题切换
    await ev(`document.querySelectorAll('.tab')[4].click()`);
    await waitFor(`document.querySelector('.page-head h1')?.textContent === '设置'`);
    await ev(`[...document.querySelectorAll('.seg button')].find(b=>b.textContent==='深色').click()`);
    await sleep(180);
    const dark = await ev(`document.documentElement.dataset.theme`);
    await shot('settings-dark');
    await ev(`[...document.querySelectorAll('.seg button')].find(b=>b.textContent==='浅色').click()`);
    await sleep(180);
    const light = await ev(`document.documentElement.dataset.theme`);
    const lastSavedShown = await ev(`document.body.textContent.includes('最后一次保存') && !document.body.textContent.includes('尚未保存')`);
    note('手动切换深色 / 浅色主题', dark === 'dark' && light === 'light', `dark=${dark} light=${light}`);
    note('设置页显示最后一次保存状态', lastSavedShown);
    const exportArea = await ev(`(()=>({actions:!!document.querySelector('.actions'),rows:[...document.querySelectorAll('.row-btn b')].map(b=>b.textContent)}))()`);
    note('备份区含导出 / 复制 / 导入 / 恢复 / 清空', exportArea.actions && exportArea.rows.length === 5,
      exportArea.rows.join('、'));

    // iPhone 布局：回到卡片列表视图再测，覆盖卡片、筛选按钮与触控区
    await ev(`document.querySelectorAll('.tab')[1].click()`);
    await waitFor(`document.querySelectorAll('.wish-card').length > 0`);
    const layout = await ev(`(()=>{const els=[...document.querySelectorAll('.tab,.check-btn,.chip,.confirm-actions .btn,.fab,.row-btn')];const small=els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<44||r.width<44)});return {scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth,smallCount:small.length,checked:els.length,tabs:document.querySelectorAll('.tab').length}})()`);
    note('iPhone 竖屏无横向滚动、底部导航 5 项固定', layout.scrollWidth <= layout.innerWidth + 1 && layout.tabs === 5,
      `scrollWidth=${layout.scrollWidth} innerWidth=${layout.innerWidth}`);
    note('交互按钮触控区 ≥ 44px', layout.smallCount === 0, `检查 ${layout.checked} 个，过小 ${layout.smallCount} 个`);

    // 导出数据结构（设置页导出按钮存在且 localStorage 结构正确）
    const dataShape = await ev(`(()=>{const d=JSON.parse(localStorage.getItem('life-wishlist:data'));return {version:d.version,items:d.items.length,hasSettings:!!d.settings}})()`);
    note('数据结构含版本号与设置', dataShape.version === 2 && dataShape.items === 35 && dataShape.hasSettings);

    // Service Worker 注册 + 离线重载
    await ev(`document.querySelectorAll('.tab')[0].click()`);
    const swReady = await waitFor(`navigator.serviceWorker.controller !== null`, 12000);
    note('Service Worker 已注册并接管页面', swReady);
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await send('Page.reload').catch(() => undefined);
    const offlineOK = await waitFor(`document.querySelector('.page-head h1')?.textContent === '我的人生清单'`, 12000);
    const offlineStats = offlineOK ? await ev(`document.querySelector('[data-testid=stat-total]')?.textContent`) : '';
    note('断网后仍可打开并读取数据', offlineOK && offlineStats === '35', `离线总数=${offlineStats || '未渲染'}`);
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => undefined);
  } catch (e) {
    note('浏览器测试执行', false, e.message);
  } finally {
    if (ws) { try { ws.close(); } catch (_) { /* ignore */ } }
    try { proc.kill(); } catch (_) { /* ignore */ }
    server.close();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}

/* ==================== 汇总 ==================== */
if (!fs.existsSync(DIST)) {
  console.error('请先运行 npm run build');
  process.exit(1);
}
staticChecks();
await logicTests();
await browserTests();
const failed = results.filter((r) => !r.ok);
console.log(`\n===== 验收结果：${results.length - failed.length} / ${results.length} 通过 =====`);
if (failed.length) {
  failed.forEach((f) => console.log('  FAIL  ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  process.exit(1);
}
