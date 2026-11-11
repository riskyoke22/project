import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './app-error';
import { AppLogger } from '../logger/logger.service';

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Ambil request_id dari middleware request-logger atau header x-request-id
    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as unknown as { id?: string }).id ||
      uuidv4();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = 'INTERNAL_SERVER_ERROR';
    let clientMessage: string =
      'Terjadi kesalahan internal pada server. Silakan hubungi administrator dengan menyertakan request ID.';
    let details: unknown = undefined;

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      errorCode = exception.code;
      clientMessage = exception.message;
      details = exception.details;

      if (statusCode >= 500) {
        this.logger.error(
          `[AppError] ${exception.message} (${errorCode})`,
          exception.stack,
          'GlobalExceptionFilter',
          { requestId, code: errorCode, statusCode, details },
        );
      } else {
        this.logger.warn(
          `[AppError] ${exception.message} (${errorCode})`,
          'GlobalExceptionFilter',
          { requestId, code: errorCode, statusCode },
        );
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        errorCode = (resObj.error as string) || `HTTP_${statusCode}`;
        clientMessage = (resObj.message as string) || exception.message;
        details = resObj.details;
      } else {
        clientMessage = String(res);
        errorCode = `HTTP_${statusCode}`;
      }

      this.logger.warn(
        `[HttpException] ${clientMessage} (${statusCode})`,
        'GlobalExceptionFilter',
        { requestId, code: errorCode, statusCode },
      );
    } else {
      // Unhandled generic exception (Error, TypeError, DatabaseError, dll.)
      // JANGAN PERNAH membocorkan pesan error teknis / SQL ke klien
      const stack = exception instanceof Error ? exception.stack : undefined;
      const originalMessage = exception instanceof Error ? exception.message : String(exception);

      this.logger.error(`[UnhandledException] ${originalMessage}`, stack, 'GlobalExceptionFilter', {
        requestId,
        path: request.url,
        method: request.method,
      });
    }

    const payload: StandardErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: clientMessage,
        requestId,
        ...(details ? { details } : {}),
      },
    };

    response.status(statusCode).json(payload);
  }
}
