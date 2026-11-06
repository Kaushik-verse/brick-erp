import React from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrapNativeShell } from './core/utils/nativeBootstrap';
import './index.css';

bootstrapNativeShell();

/**
 * Two separate apps are built from this code:
 *   • Classic  — `npm run dev` / `npm run android:build`
 *   • New      — `npm run dev:new` / `npm run android:build:new`
 * VITE_APP_VARIANT is fixed at build time, so each build only contains its own app.
 */
const loadApp =
  import.meta.env.VITE_APP_VARIANT === 'new' ? () => import('./v3/AppV3') : () => import('./App');

loadApp().then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
