import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootstrapNativeShell } from './core/utils/nativeBootstrap';
import './index.css';

bootstrapNativeShell();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
