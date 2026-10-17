import { mountPortfolio } from './carousel.js';
import { mountTheme, appearanceEnabled } from './theme.js';
import { mountPublicationLabel } from './publication-label.js';

function start() {
  const theme = mountTheme({ enabled: appearanceEnabled });
  const releasePublication = mountPublicationLabel();
  const cleanup = mountPortfolio();
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { cleanup?.(); releasePublication(); theme.destroy?.(); }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
