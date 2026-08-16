import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({ variant = "primary", className, children, ...rest }: ButtonProps) {
  const base = "gpu-ui-button";
  const variantClass =
    variant === "primary" ? "gpu-ui-button--primary" : "gpu-ui-button--secondary";
  const classes = [base, variantClass, className].filter(Boolean).join(" ");

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
