import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

/** Small status pill — used for reservation statuses, GPU connectivity, read/unread, etc. */
export function Badge({ tone = "neutral", className, children, ...rest }: BadgeProps) {
  const classes = ["gpu-ui-badge", `gpu-ui-badge--${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
