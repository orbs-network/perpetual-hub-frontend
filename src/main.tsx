import { createRoot } from 'react-dom/client';
import { lazy } from 'react';
import { PartnerBootstrap } from './PartnerBootstrap';
import './index.css';
import './i18n';
import { applyTheme } from './config/partners';

const App = lazy(() => import('./App'));

// Apply partner theme CSS variables before first render
applyTheme();

createRoot(document.getElementById('root')!).render(
  <PartnerBootstrap>
    <App />
  </PartnerBootstrap>
);
