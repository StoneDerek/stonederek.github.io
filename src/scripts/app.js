import { mountPortfolio } from './carousel.js';
import { mountTheme, appearanceEnabled } from './theme.js';
import { mountPublicationLabel } from './publication-label.js';
import { mountWorkPage } from './work-page.js';
import { mountSerifNavigation } from './serif-navigation.js';
import { mountArtGallery } from './art-gallery.js';

function start() {
  const theme = mountTheme({ enabled: appearanceEnabled });
  const releasePublication = mountPublicationLabel();
  const cleanup = mountPortfolio();
  const releaseWork = mountWorkPage();
  const releaseArt = mountArtGallery();
  const releaseNavigation = mountSerifNavigation();
  let disposed = false;
  const stop = () => {
    if (disposed) return;
    disposed = true;
    cleanup?.();
    releaseWork?.();
    releaseArt?.();
    releaseNavigation?.();
    releasePublication();
    theme.destroy?.();
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('portfolio:preview-unmount', stop);
  };
  const onPageHide = event => { if (!event.persisted) stop(); };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('portfolio:preview-unmount', stop, { once: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
