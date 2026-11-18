import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><StoreProvider><App /></StoreProvider></StrictMode>,
);
