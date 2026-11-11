import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(100).optional(),
});

export type PaginationQueryDto = z.infer<typeof PaginationQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
}

export function buildPaginatedResult<T>(params: {
  items: T[];
  total: number;
  page: number;
  limit: number;
  nextCursor?: string;
}): PaginatedResult<T> {
  const totalPages = Math.ceil(params.total / params.limit) || 1;
  return {
    items: params.items,
    total: params.total,
    page: params.page,
    limit: params.limit,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
    nextCursor: params.nextCursor,
  };
}
