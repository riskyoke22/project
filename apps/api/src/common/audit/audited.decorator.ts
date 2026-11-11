import { SetMetadata } from '@nestjs/common';
import { AuditAction } from './audit.types';

export const AUDITED_KEY = 'audited_metadata';

export interface AuditedOptions {
  action: AuditAction;
  entity: string;
}

export const Audited = (options: AuditedOptions) => SetMetadata(AUDITED_KEY, options);
