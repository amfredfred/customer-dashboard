export type TabDef = {
  id: string;
  label: string;
  count?: number;
};

/** Quiet underline tabs; horizontally scrollable on mobile. */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly TabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tab-row" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`tab-btn${active === t.id ? " active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {typeof t.count === "number" && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
