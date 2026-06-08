export async function register() {
  if (process.env.NEXT_RUNTIME === "node") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
  },
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
