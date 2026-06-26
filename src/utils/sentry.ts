import * as Sentry from "@sentry/nextjs";

export async function withSpan<T>(name: string, fn: () => Promise<T>, op = "function"): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => fn());
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}
