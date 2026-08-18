export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendChartProps {
  data: TrendPoint[];
  /** CSS color for the line — single-series chart, one hue. */
  color: string;
  ariaLabel: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

const WIDTH = 600;
const PADDING = 24;

/**
 * Minimal dependency-free SVG line chart. Each point is a focusable circle
 * carrying a native `<title>` (hover + keyboard-accessible tooltip) with
 * "label: value" — the closest a no-JS-library chart gets to the dataviz
 * skill's "crosshair + tooltip on line/area" guidance without hand-rolling
 * a full pointer-tracking tooltip widget.
 */
export function TrendChart({ data, color, ariaLabel, valueFormatter, height = 180 }: TrendChartProps) {
  const format = valueFormatter ?? ((v: number) => String(v));
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = height - PADDING * 2;

  const points = data.map((point, i) => {
    const x = data.length === 1 ? PADDING + innerWidth / 2 : PADDING + (i / (data.length - 1)) * innerWidth;
    const y = PADDING + innerHeight - ((point.value - min) / range) * innerHeight;
    return { ...point, x, y };
  });

  const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");
  const baselineY = PADDING + innerHeight - ((0 - min) / range) * innerHeight;

  return (
    <svg
      className="gpu-ui-trendchart"
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        className="gpu-ui-trendchart__baseline"
        x1={PADDING}
        y1={baselineY}
        x2={WIDTH - PADDING}
        y2={baselineY}
      />
      <polyline className="gpu-ui-trendchart__line" points={linePath} style={{ stroke: color }} />
      {points.map((point) => (
        <circle
          key={point.label}
          className="gpu-ui-trendchart__dot"
          cx={point.x}
          cy={point.y}
          r={4}
          style={{ fill: color }}
          tabIndex={0}
          aria-label={`${point.label}: ${format(point.value)}`}
        >
          <title>{`${point.label}: ${format(point.value)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
