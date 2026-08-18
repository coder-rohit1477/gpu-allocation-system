import type { ReactNode } from "react";
import { Button } from "@gpu/ui";

export interface AsyncSectionProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyState?: ReactNode;
  skeleton: ReactNode;
  children: ReactNode;
}

/** Shared loading/error/empty/content switch so every page doesn't re-implement it. */
export function AsyncSection({
  loading,
  error,
  onRetry,
  isEmpty,
  emptyState,
  skeleton,
  children,
}: AsyncSectionProps) {
  if (loading) return <>{skeleton}</>;

  if (error) {
    return (
      <div className="async-error" role="alert">
        <p>{error}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty && emptyState) return <>{emptyState}</>;

  return <>{children}</>;
}
