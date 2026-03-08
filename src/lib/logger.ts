import * as Sentry from '@sentry/nextjs'

type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  if (process.env.NODE_ENV === 'production') {
    // Structured JSON for log aggregation
    console[level](JSON.stringify(entry))
  } else {
    // Human-readable in dev
    console[level](`[${entry.timestamp}] ${level.toUpperCase()} ${message}`, context ?? '')
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, error?: unknown, context?: LogContext) => {
    log('error', message, { ...context, error: error instanceof Error ? error.message : String(error ?? '') })

    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error instanceof Error ? error : new Error(message), {
        extra: context,
      })
    }
  },
}
