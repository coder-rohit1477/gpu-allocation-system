/**
 * Chart hues for the admin analytics pages — CSS custom-property references
 * (defined in styles/index.css) rather than raw hex, so the values live in
 * one place. Values are the dataviz skill's validated default categorical
 * palette (slots 1/2/3/7) and status palette; see styles/index.css for the
 * hex and `scripts/validate_palette.js` results referenced there.
 */
export const CHART_COLORS = {
  blue: "var(--chart-blue)",
  orange: "var(--chart-orange)",
  aqua: "var(--chart-aqua)",
  violet: "var(--chart-violet)",
} as const;

export const STATUS_COLORS = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
} as const;
