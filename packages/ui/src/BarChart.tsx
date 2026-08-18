export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** CSS color for every bar — single-series chart, so one hue throughout (see the dataviz skill: color follows the entity, and there is only one entity-per-row here). */
  color: string;
  ariaLabel: string;
  valueFormatter?: (value: number) => string;
}

/**
 * Horizontal bar list — dependency-free, built from plain HTML/CSS rather
 * than SVG so the label and value are real text content (not just a visual
 * bar), which doubles as the chart's accessible "table view": a screen
 * reader gets "label, value" per row for free, no separate hidden table.
 */
export function BarChart({ data, color, ariaLabel, valueFormatter }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const format = valueFormatter ?? ((v: number) => String(v));

  return (
    <ul className="gpu-ui-barchart" aria-label={ariaLabel}>
      {data.map((datum) => (
        <li key={datum.label} className="gpu-ui-barchart__row">
          <span className="gpu-ui-barchart__label">{datum.label}</span>
          <span className="gpu-ui-barchart__track">
            <span
              className="gpu-ui-barchart__fill"
              style={{ width: `${Math.max(2, (datum.value / max) * 100)}%`, backgroundColor: color }}
            />
          </span>
          <span className="gpu-ui-barchart__value">{format(datum.value)}</span>
        </li>
      ))}
    </ul>
  );
}
