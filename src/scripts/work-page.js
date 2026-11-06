import { resolveWorkLocation, workAddress, workLinksAddress } from './work-location.js';

const stateKey = 'portfolioWork';
const finite = value => Number.isFinite(value) ? Math.max(0, value) : 0;

export function mountWorkPage(root = document.querySelector('[data-work-root]')) {
  if (!root) return () => {};
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const projects = JSON.parse(root.querySelector('#work-data').textContent);
  const base = root.dataset.base || '/';
  const preview = view.__PORTFOLIO_PREVIEW_ADDRESS__ !== undefined;
  const locationAddress = () => preview ? view.__PORTFOLIO_PREVIEW_ADDRESS__ : view.location.href;
  const gridAddress = workAddress(null, { base });
  const grid = root.querySelector('[data-work-grid]');
  const article = root.querySelector('[data-work-article]');
  const heading = root.querySelector('[data-work-heading]') || grid.querySelector('h1');
  const title = article.querySelector('[data-detail-title]');
  const gridTitle = doc.title;
  const owner = root.dataset.owner || gridTitle.replace(/\s[-—–|]\sWork$/, '');
  const controller = new view.AbortController();
  const listen = (target, type, handler, options) => target.addEventListener(type, handler,
    { ...options, signal: controller.signal });
  const previousScrollRestoration = view.history.scrollRestoration;
  view.history.scrollRestoration = 'manual';
  let sequence = 0;
  let current = null;
  let rendered = '';
  let restoreFrame = 0;
  let saveFrame = 0;
  let restoring = false;
  let closing = false;
  let redirecting = false;
  let disposed = false;

  const identifier = () => `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2, 8)}`;
  const snapshot = (focus = current?.focus || null) => ({
    scroll: { x: finite(view.scrollX), y: finite(view.scrollY) }, focus
  });
  const emptySnapshot = focus => ({ scroll: { x: 0, y: 0 }, focus: focus || null });
  const stateFor = (route, extra = {}) => ({
    version: 1, path: gridAddress, id: identifier(), view: route.view, slug: route.slug,
    ...emptySnapshot(route.slug), ...extra
  });

  function storedState(route) {
    const state = view.history.state?.[stateKey];
    if (state?.version !== 1 || state.path !== gridAddress || !state.id ||
      state.view !== route.view || state.slug !== route.slug) return null;
    return { ...state, scroll: { x: finite(state.scroll?.x), y: finite(state.scroll?.y) } };
  }

  function writeState(state, { push = false, address = workAddress(state.slug, { base }) } = {}) {
    const previous = view.history.state;
    const historyState = previous && typeof previous === 'object' ? previous : {};
    const next = { ...historyState, [stateKey]: state };
    if (preview && typeof view.__PORTFOLIO_PREVIEW_SET_ADDRESS__ === 'function') {
      view.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address, replace: !push, state: next });
    } else view.history[push ? 'pushState' : 'replaceState'](next, '', address);
    current = state;
  }

  function savePosition(focus) {
    if (!current || disposed) return;
    const route = resolveWorkLocation(locationAddress(), projects, { base });
    if (route?.view !== current.view || route.slug !== current.slug) return;
    current = { ...current, ...snapshot(focus) };
    writeState(current);
  }

  function cancelRestore() {
    view.cancelAnimationFrame(restoreFrame);
    restoreFrame = 0;
  }

  function projectLink(slug) {
    return [...grid.querySelectorAll('[data-work-project]')]
      .find(link => link.dataset.workProject === slug);
  }

  function restorePosition(state, { focus = true } = {}) {
    cancelRestore();
    restoreFrame = view.requestAnimationFrame(() => {
      restoreFrame = 0;
      if (disposed || current?.id !== state.id) return;
      const target = state.view === 'article' ? title : projectLink(state.focus) || heading;
      restoring = true;
      if (focus) target?.focus({ preventScroll: true });
      view.scrollTo({ left: state.scroll.x, top: state.scroll.y, behavior: 'instant' });
      restoring = false;
    });
  }

  function fillArticle(project) {
    title.textContent = project.title;
    article.scrollTop = 0;
  }

  function render(state, { initial = false } = {}) {
    const key = `${state.id}:${state.view}:${state.slug || ''}`;
    if (rendered === key) return;
    const wasArticle = !article.hidden;
    closing = false;
    if (state.view === 'article') {
      fillArticle(projects.find(project => project.slug === state.slug));
      grid.hidden = true;
      grid.inert = true;
      article.hidden = false;
      article.inert = false;
      doc.title = `${owner} - ${title.textContent}`;
    } else {
      article.hidden = true;
      article.inert = true;
      grid.hidden = false;
      grid.inert = false;
      doc.title = gridTitle;
    }
    root.dataset.workView = state.view;
    root.dataset.workProject = state.slug || '';
    rendered = key;
    restorePosition(state, { focus: state.view === 'article' || wasArticle || !initial && !!state.focus });
  }

  function followLocation({ initial = false, write = true, address = locationAddress() } = {}) {
    const route = resolveWorkLocation(address, projects, { base });
    if (!route) return;
    if (route.view === 'legacy-links') {
      if (!redirecting) {
        redirecting = true;
        // A cross-page preview redirect must wait until app.js has received
        // this mount's cleanup function and installed its lifecycle listener.
        view.queueMicrotask(() => {
          redirecting = false;
          if (disposed || resolveWorkLocation(locationAddress(), projects, { base })?.view !== 'legacy-links') return;
          if (preview && typeof view.__PORTFOLIO_PREVIEW_SET_ADDRESS__ === 'function') {
            view.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address: workLinksAddress({ base }), replace: true, state: null });
          } else view.location.replace(workLinksAddress({ base }));
        });
      }
      return;
    }
    let state = storedState(route);
    if (!state) {
      const fromGrid = !initial && current?.view === 'grid' && route.view === 'article';
      state = stateFor(route, fromGrid ? { gridId: current.id, gridReturn: snapshot(route.slug) } : {});
    }
    if (write) writeState(state);
    else current = state;
    render(state, { initial });
  }

  function openProject(slug) {
    if (disposed || closing) return;
    const project = projects.find(item => item.slug === slug);
    if (!project || current?.view === 'article' && current.slug === slug) return;
    cancelRestore();
    let origin = {};
    const push = current?.view === 'grid';
    if (push) {
      savePosition(slug);
      origin = { gridId: current.id, gridReturn: snapshot(slug) };
    } else if (current?.view === 'article') {
      origin = { gridId: current.gridId, gridReturn: current.gridReturn };
    }
    const state = stateFor({ view: 'article', slug }, origin);
    writeState(state, { push });
    render(state);
  }

  function closeArticle() {
    if (disposed || closing || current?.view !== 'article') return;
    cancelRestore();
    savePosition();
    if (current.gridId) {
      // Only entries opened from this Work grid may go Back. Direct entries
      // replace themselves, so Close never sends readers to an external page.
      closing = true;
      view.history.back();
      return;
    }
    const fallback = current.gridReturn || emptySnapshot(current.slug);
    const state = stateFor({ view: 'grid', slug: null }, fallback);
    writeState(state);
    render(state);
  }

  listen(root, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const skip = event.target.closest?.('a.serif-skip-link');
    if (!skip || !root.contains(skip) || !skip.getAttribute('href')?.startsWith('#') ||
      skip.target && skip.target !== '_self' || !current) return;
    event.preventDefault();
    cancelRestore();
    const target = current.view === 'article' ? title : heading;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  listen(doc, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const control = event.target.closest?.('[data-work-close], [data-work-index]');
    if (control && root.contains(control) && current?.view === 'article') {
      if (control.target && control.target !== '_self') return;
      event.preventDefault();
      closeArticle();
      return;
    }
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || link.target && link.target !== '_self') return;
    const address = new URL(link.dataset.previewAddress || link.href, view.location.href);
    if (address.origin !== view.location.origin) return;
    const route = resolveWorkLocation(address.href, projects, { base });
    if (route?.view !== 'article') return;
    event.preventDefault();
    openProject(route.slug);
  });
  listen(doc, 'keydown', event => {
    if (event.defaultPrevented || event.key !== 'Escape' || current?.view !== 'article' ||
      doc.querySelector('dialog[open]')) return;
    event.preventDefault();
    closeArticle();
  });
  listen(grid, 'focusin', event => {
    if (current?.view !== 'grid' || restoreFrame || restoring) return;
    const link = event.target.closest?.('[data-work-project]');
    if (link) savePosition(link.dataset.workProject);
  });
  listen(view, 'scroll', () => {
    if (restoreFrame || restoring || saveFrame || disposed) return;
    const entry = current?.id;
    saveFrame = view.requestAnimationFrame(() => {
      saveFrame = 0;
      if (current?.id === entry) savePosition();
    });
  }, { passive: true });
  if (preview) {
    listen(view, 'portfolio:preview-navigate', event => followLocation({ address: event.detail?.address, write: false }));
  } else {
    listen(view, 'popstate', () => followLocation());
    listen(view, 'hashchange', () => followLocation());
  }
  listen(view, 'pageshow', event => { if (event.persisted) followLocation(); });

  followLocation({ initial: true });
  doc.documentElement.removeAttribute('data-portfolio-entry-pending');
  const cleanup = () => {
    if (disposed) return;
    savePosition();
    disposed = true;
    cancelRestore();
    view.cancelAnimationFrame(saveFrame);
    controller.abort();
    view.history.scrollRestoration = previousScrollRestoration;
  };
  cleanup.entryDone = Promise.resolve();
  return cleanup;
}
