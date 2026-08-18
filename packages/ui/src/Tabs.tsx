import { useId } from "react";
import type { KeyboardEvent } from "react";

export interface TabItem {
  value: string;
  label: string;
  /** Optional count badge shown after the label, e.g. "Pending (3)". */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
}

/** Accessible tab strip (role="tablist") — arrow-key navigable, single active panel driven by the caller. */
export function Tabs({ items, value, onChange, ...rest }: TabsProps) {
  const idPrefix = useId();
  const ariaLabel = rest["aria-label"];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = items.findIndex((item) => item.value === value);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = items[nextIndex];
    if (next) onChange(next.value);
  }

  return (
    <div className="gpu-ui-tabs" role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${idPrefix}-${item.value}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`gpu-ui-tabs__tab${selected ? " gpu-ui-tabs__tab--active" : ""}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span className="gpu-ui-tabs__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
