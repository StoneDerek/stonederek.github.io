const key = 'portfolio-projects-expanded';

// Legacy same-origin preview frames can share their outer preference. Restricted
// attachment viewers and direct previews keep the state in their own document.
export function projectMenuPreference(scope = window) {
  let owner = scope;
  if (scope.__PORTFOLIO_PREVIEW_ADDRESS__ !== undefined && typeof scope.__PORTFOLIO_PREVIEW_SET_ADDRESS__ !== 'function') {
    try {
      const parent = scope.parent;
      if (parent) {
        // Accessing this property throws for an opaque/cross-origin parent.
        void parent.__PORTFOLIO_PROJECTS_EXPANDED__;
        owner = parent;
      }
    } catch { /* Keep a local preference when the host window is inaccessible. */ }
  }
  return {
    read(fallback) {
      if (typeof owner.__PORTFOLIO_PROJECTS_EXPANDED__ === 'boolean') return owner.__PORTFOLIO_PROJECTS_EXPANDED__;
      try {
        const saved = owner.sessionStorage.getItem(key);
        if (saved === 'true' || saved === 'false') return saved === 'true';
      } catch {}
      return fallback;
    },
    write(value) {
      owner.__PORTFOLIO_PROJECTS_EXPANDED__ = Boolean(value);
      try { owner.sessionStorage.setItem(key, String(Boolean(value))); } catch {}
    }
  };
}
