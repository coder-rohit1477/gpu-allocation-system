import { Prisma } from "@prisma/client";

/** Postgres unique-constraint violation, surfaced by Prisma as P2002. */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Prisma "record to update/delete not found" — P2025. */
export function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** Foreign key violation — P2003. Surfaces when a Restrict relation blocks a delete. */
export function isForeignKeyConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}
