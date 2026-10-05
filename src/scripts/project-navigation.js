// Serialize interrupted navigation and keep only the latest queued destination.
// An article change opens directly; only an explicit gallery request closes.
export function createProjectRequests({ getCurrent, open, close, cancel, settled = () => {} }) {
  let pending = null;
  let busy = false;
  let completion = Promise.resolve();
  async function run() {
    try {
      while (pending) {
        const request = pending;
        pending = null;
        const current = getCurrent();
        if (request.index === null) {
          if (current.open) await close(request);
        } else if (!current.open || request.index !== current.index) {
          await open(request, { replacing: current.open });
        }
      }
    } finally {
      busy = false;
      settled();
    }
  }
  return {
    get busy() { return busy; },
    get pending() { return pending; },
    request(destination) {
      pending = destination;
      cancel();
      if (!busy) { busy = true; completion = run(); }
      return completion;
    }
  };
}
