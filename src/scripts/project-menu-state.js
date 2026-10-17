const key = 'portfolio-projects-expanded';

// Keep the persistent offline app's preference in its outer document as well
// as sessionStorage. Blocked storage is harmless.
export function projectMenuPreference(scope = window) {
  const owner = scope.__PORTFOLIO_PREVIEW_ADDRESS__ !== undefined ? scope.parent : scope;
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
