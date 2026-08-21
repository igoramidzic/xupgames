// Stub for convex/_generated/api used in tests (generated dir is gitignored)
export const internal: Record<string, unknown> = new Proxy(
  {},
  {
    get(_, ns) {
      return new Proxy(
        {},
        {
          get(_, fn) {
            return `internal.${String(ns)}.${String(fn)}`;
          },
        }
      );
    },
  }
);

export const api: Record<string, unknown> = new Proxy(
  {},
  {
    get(_, ns) {
      return new Proxy(
        {},
        {
          get(_, fn) {
            return `api.${String(ns)}.${String(fn)}`;
          },
        }
      );
    },
  }
);

export const components: Record<string, unknown> = new Proxy(
  {},
  {
    get(_, component) {
      return new Proxy(
        {},
        {
          get(_, module) {
            return new Proxy(
              {},
              {
                get(_, fn) {
                  return `components.${String(component)}.${String(module)}.${String(fn)}`;
                },
              }
            );
          },
        }
      );
    },
  }
);
