import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Standard "nothing here yet" placeholder for empty lists/tables. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="gpu-ui-empty-state" role="status">
      {icon && (
        <div className="gpu-ui-empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="gpu-ui-empty-state__title">{title}</p>
      {description && <p className="gpu-ui-empty-state__description">{description}</p>}
      {action && <div className="gpu-ui-empty-state__action">{action}</div>}
    </div>
  );
}
