// Fragment routes are only available in the browser. Conceal the default
// gallery until its controller has applied the requested initial destination.
export function preparePortfolioEntry() {
  const address = new URL(window.__PORTFOLIO_PREVIEW_ADDRESS__ || window.location.href, 'https://portfolio.invalid');
  if (!/\/projects(?:\/index\.html|\/)?$/.test(address.pathname) || !address.hash) return;
  const html = document.documentElement;
  html.setAttribute('data-portfolio-entry-pending', '');
  // A failed module must not leave the server-rendered fallback concealed.
  window.addEventListener('load', () => html.removeAttribute('data-portfolio-entry-pending'), { once: true });
}
