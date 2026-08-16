import { z } from "zod";

/**
 * Offset (page/pageSize) pagination, not keyset/cursor. Deliberate choice for
 * this admin module: admins expect page numbers ("jump to page 5"), and the
 * scale here (thousands of users, hundreds of nodes) doesn't yet justify the
 * added complexity of keyset pagination. Revisit if a list grows large
 * enough for deep-page skip() cost or write-concurrency drift to matter.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginationArgs(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  query: PaginationQuery,
): PaginatedResult<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
