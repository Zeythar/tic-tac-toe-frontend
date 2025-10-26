import { environment } from '../../environments/environment';

/**
 * Logger utility that only logs in development mode.
 * In production, all debug/log calls are no-ops.
 */
class Logger {
  private get isDev(): boolean {
    return !environment.production;
  }

  log(...args: any[]): void {
    if (this.isDev) {
      console.log(...args);
    }
  }

  debug(...args: any[]): void {
    if (this.isDev) {
      console.debug(...args);
    }
  }

  info(...args: any[]): void {
    // Info always logs (e.g., connection status users might need)
    console.info(...args);
  }

  warn(...args: any[]): void {
    // Warnings always show
    console.warn(...args);
  }

  error(...args: any[]): void {
    // Errors always show
    console.error(...args);
  }
}

export const logger = new Logger();
