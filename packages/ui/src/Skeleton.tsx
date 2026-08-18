import type { HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** CSS width, e.g. "100%" or "8rem". Defaults to "100%". */
  width?: string;
  /** CSS height, e.g. "1rem". Defaults to "1rem". */
  height?: string;
}

/** Loading placeholder — a pulsing block sized to stand in for text/cards while data loads. */
export function Skeleton({ width = "100%", height = "1rem", className, style, ...rest }: SkeletonProps) {
  const classes = ["gpu-ui-skeleton", className].filter(Boolean).join(" ");
  return (
    <div
      className={classes}
      style={{ width, height, ...style }}
      role="presentation"
      aria-hidden="true"
      {...rest}
    />
  );
}
