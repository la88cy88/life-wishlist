import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WishlistProvider } from './store';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WishlistProvider>
      <App />
    </WishlistProvider>
  </React.StrictMode>
);

// 只在生产构建注册 Service Worker，避免开发时缓存热更新资源。
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch(() => { /* 离线能力不可用时不阻塞应用 */ });
  });
}
