export type StatusTone = "good" | "warning" | "critical" | "neutral";

export interface StatusSegment {
  label: string;
  value: number;
  tone: StatusTone;
}

export interface StatusBarProps {
  segments: StatusSegment[];
  ariaLabel: string;
}

/**
 * A single proportion bar broken into status-colored segments, with a
 * legend row beneath — status color is never the only signal (dataviz
 * skill: "status colors ship with icon + label, never color alone"), so
 * every segment's label + count is real text, not just a colored slice.
 */
export function StatusBar({ segments, ariaLabel }: StatusBarProps) {
  const total = Math.max(
    1,
    segments.reduce((sum, s) => sum + s.value, 0),
  );

  return (
    <div className="gpu-ui-statusbar" aria-label={ariaLabel}>
      <div className="gpu-ui-statusbar__track">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={`gpu-ui-statusbar__segment gpu-ui-statusbar__segment--${segment.tone}`}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="gpu-ui-statusbar__legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span
              className={`gpu-ui-statusbar__dot gpu-ui-statusbar__dot--${segment.tone}`}
              aria-hidden="true"
            />
            {segment.label}: <strong>{segment.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
