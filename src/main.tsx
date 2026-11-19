import { createRoot } from 'react-dom/client';
import { lazy } from 'react';
import { PartnerBootstrap } from './PartnerBootstrap';
import './index.css';
import './i18n';
import { applyTheme, applyThemeColors } from './config/partners';
import { resolveThemePreview } from './config/partners/themePreview';

const App = lazy(() => import('./App'));

// Apply partner theme CSS variables before first render
applyTheme();

// Local development only: preview a generated palette from ?themeBg=…&themeAccent=…
if (import.meta.env.DEV) {
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = undefined;
  }
  const preview = resolveThemePreview(window.location.search, storage);
  if (preview) {
    applyThemeColors(preview.theme);
    console.info('[theme preview] Showing generated palette', preview.seeds);
  }
}

createRoot(document.getElementById('root')!).render(
  <PartnerBootstrap>
    <App />
  </PartnerBootstrap>
);
