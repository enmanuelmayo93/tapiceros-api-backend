import { Request } from 'express';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

interface LogContext {
  requestId?: string;
  userId?: string | undefined;
  method?: string;
  url?: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env['NODE_ENV'] === 'development';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(level, message, context);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
    }
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Request logging
  logRequest(req: Request, responseTime?: number): void {
    const context: LogContext = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req.user as any)?.id,
      ...(responseTime && { responseTime: `${responseTime}ms` })
    };

    this.info(`${req.method} ${req.url}`, context);
  }

  // Error logging with request context
  logError(error: Error, req?: Request): void {
    const context: LogContext = {
      error: {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined
      },
      ...(req && {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: (req.user as any)?.id
      })
    };

    this.error(`Error: ${error.message}`, context);
  }

  // Database operation logging
  logDbOperation(operation: string, table: string, duration?: number): void {
    const context: LogContext = {
      operation,
      table,
      ...(duration && { duration: `${duration}ms` })
    };

    this.debug(`DB ${operation} on ${table}`, context);
  }

  // Authentication logging
  logAuth(action: string, userId?: string, success: boolean = true): void {
    const context: LogContext = {
      action,
      userId,
      success
    };

    this.info(`Auth ${action} ${success ? 'successful' : 'failed'}`, context);
  }

  // Payment logging
  logPayment(action: string, amount?: number, currency?: string, userId?: string): void {
    const context: LogContext = {
      action,
      ...(amount && { amount }),
      ...(currency && { currency }),
      userId
    };

    this.info(`Payment ${action}`, context);
  }
}

export const logger = new Logger(); 