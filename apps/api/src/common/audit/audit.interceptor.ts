import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDITED_KEY, AuditedOptions } from './audited.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditOptions = this.reflector.getAllAndOverride<AuditedOptions>(AUDITED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const actorUserId = request.user?.id || null;
    const actorIp = request.ip || request.socket?.remoteAddress || null;
    const requestId = request.headers?.['x-request-id'] || null;

    return next.handle().pipe(
      tap((responseData) => {
        const entityId = request.params?.id || (responseData as { id?: string })?.id || null;

        this.auditService.log({
          action: auditOptions.action,
          entity: auditOptions.entity,
          entityId: entityId ? String(entityId) : null,
          actorUserId,
          actorIp,
          requestId,
          beforeData: request.body ? { ...request.body } : null,
          afterData:
            responseData && typeof responseData === 'object'
              ? { ...(responseData as object) }
              : null,
        });
      }),
    );
  }
}
