import { Injectable } from '@angular/core';

/**
 * Error severity levels for categorizing errors
 */
export enum ErrorSeverity {
  /** Informational - non-critical, can be ignored */
  Info = 'info',
  /** Warning - unexpected but handled gracefully */
  Warning = 'warning',
  /** Error - unexpected failure that impacts functionality */
  Error = 'error',
  /** Critical - system-breaking error requiring immediate attention */
  Critical = 'critical',
}

/**
 * Structured error context for better debugging
 */
export interface ErrorContext {
  /** Component or service where error occurred */
  source: string;
  /** Specific operation that failed */
  operation: string;
  /** Additional metadata about the error */
  metadata?: Record<string, unknown>;
  /** User-facing message (if applicable) */
  userMessage?: string;
  /** Whether error has been recovered from */
  recovered?: boolean;
}

/**
 * External error monitoring service interface (e.g., Sentry, LogRocket)
 */
export interface ErrorMonitoringService {
  captureError(error: unknown, context: ErrorContext, severity: ErrorSeverity): void;
  captureMessage(message: string, context: ErrorContext, severity: ErrorSeverity): void;
}

/**
 * Centralized error logging service with support for external monitoring
 *
 * Features:
 * - Consistent error formatting
 * - Severity-based filtering
 * - External monitoring integration (Sentry, LogRocket, etc.)
 * - Development vs production behavior
 * - Error context tracking
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorLoggingService {
  private monitoringService: ErrorMonitoringService | null = null;
  private readonly isDevelopment = !this.isProduction();

  /**
   * Register an external error monitoring service
   * @example
   * errorLogging.setMonitoringService({
   *   captureError: (error, context, severity) => Sentry.captureException(error, { extra: context, level: severity }),
   *   captureMessage: (message, context, severity) => Sentry.captureMessage(message, { extra: context, level: severity })
   * });
   */
  setMonitoringService(service: ErrorMonitoringService): void {
    this.monitoringService = service;
  }

  /**
   * Log an error with context
   */
  logError(error: unknown, context: ErrorContext, severity = ErrorSeverity.Error): void {
    const formattedMessage = this.formatMessage(context);

    // Always log to console in development
    if (this.isDevelopment) {
      this.logToConsole(error, formattedMessage, severity);
    }

    // Send to external monitoring in production (or always if configured)
    if (this.monitoringService) {
      this.monitoringService.captureError(error, context, severity);
    } else if (!this.isDevelopment && severity >= ErrorSeverity.Error) {
      // In production without monitoring, at least log critical errors
      console.error(formattedMessage, error);
    }
  }

  /**
   * Log a message without an error object
   */
  logMessage(message: string, context: ErrorContext, severity = ErrorSeverity.Warning): void {
    const formattedMessage = this.formatMessage(context, message);

    if (this.isDevelopment) {
      this.logMessageToConsole(formattedMessage, severity);
    }

    if (this.monitoringService) {
      this.monitoringService.captureMessage(message, context, severity);
    }
  }

  /**
   * Log a warning - shorthand for logError with Warning severity
   */
  logWarning(error: unknown, context: ErrorContext): void {
    this.logError(error, context, ErrorSeverity.Warning);
  }

  /**
   * Log an info message - shorthand for logMessage with Info severity
   */
  logInfo(message: string, context: ErrorContext): void {
    this.logMessage(message, context, ErrorSeverity.Info);
  }

  /**
   * Log a critical error - shorthand for logError with Critical severity
   */
  logCritical(error: unknown, context: ErrorContext): void {
    this.logError(error, context, ErrorSeverity.Critical);
  }

  /**
   * Create an error context object (helper for consistent context creation)
   */
  createContext(
    source: string,
    operation: string,
    metadata?: Record<string, unknown>,
    userMessage?: string
  ): ErrorContext {
    return {
      source,
      operation,
      metadata,
      userMessage,
    };
  }

  private formatMessage(context: ErrorContext, customMessage?: string): string {
    const parts = [`[${context.source}]`, customMessage || context.operation];

    if (context.metadata) {
      parts.push(JSON.stringify(context.metadata));
    }

    return parts.join(' ');
  }

  private logToConsole(error: unknown, message: string, severity: ErrorSeverity): void {
    switch (severity) {
      case ErrorSeverity.Info:
        console.log(message, error);
        break;
      case ErrorSeverity.Warning:
        console.warn(message, error);
        break;
      case ErrorSeverity.Error:
      case ErrorSeverity.Critical:
        console.error(message, error);
        break;
    }
  }

  private logMessageToConsole(message: string, severity: ErrorSeverity): void {
    switch (severity) {
      case ErrorSeverity.Info:
        console.log(message);
        break;
      case ErrorSeverity.Warning:
        console.warn(message);
        break;
      case ErrorSeverity.Error:
      case ErrorSeverity.Critical:
        console.error(message);
        break;
    }
  }

  private isProduction(): boolean {
    // Check if we're in production mode (can be extended with environment checks)
    return (
      typeof window !== 'undefined' &&
      (window as unknown as { [key: string]: unknown })['__isProduction__'] === true
    );
  }
}
