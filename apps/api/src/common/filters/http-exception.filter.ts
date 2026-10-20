import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomUUID();
    const timestamp = new Date().toISOString();
    const path = request.url;

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      statusCode = exception.getStatus();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string) || exception.message;
        if (typeof b.message === 'object') {
          message = Array.isArray(b.message) ? b.message.join(', ') : exception.message;
        }
        details = b.details;
        code = (b.code as string) || this.httpCodeToCode(statusCode);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping = this.mapPrismaError(exception);
      statusCode = mapping.statusCode;
      code = mapping.code;
      message = mapping.message;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Invalid request data';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorBody: ErrorResponse = {
      statusCode,
      code,
      message,
      details,
      requestId,
      timestamp,
      path,
    };

    this.logger.error(
      `${request.method} ${path} ${statusCode} ${code} [${requestId}] : ${message}`,
      exception instanceof Error ? exception.stack : undefined
    );

    response.status(statusCode).json(errorBody);
  }

  private httpCodeToCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'ERROR';
    }
  }

  private mapPrismaError(
    error: Prisma.PrismaClientKnownRequestError
  ): { statusCode: number; code: string; message: string } {
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this value already exists',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced record does not exist',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'RELATION_CONFLICT',
          message: 'A required relation is missing',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Database operation failed',
        };
    }
  }
}
