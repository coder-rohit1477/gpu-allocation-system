import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  const classes = ["gpu-ui-card", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
