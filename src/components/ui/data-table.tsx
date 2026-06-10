import type { ReactNode } from "react";

export type ColumnDef<Row> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
};

/**
 * Desktop table + mobile card hybrid.
 * Tables render >= md; below that each row becomes a card via `renderCard`
 * (or an auto-generated label/value grid from the column defs).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  renderCard,
}: {
  columns: ColumnDef<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  emptyMessage: string;
  renderCard?: (row: Row) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="detail-table-wrap">
        <table className="detail-table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="empty-cell">{emptyMessage}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="detail-table-wrap hidden md:block">
        <table className="detail-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((c) => (
                  <td key={c.key} style={c.align === "right" ? { textAlign: "right" } : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((row, i) => (
          <div key={rowKey(row, i)} className="card-row">
            {renderCard ? (
              renderCard(row)
            ) : (
              <div className="card-row-grid !mt-0">
                {columns.map((c) => (
                  <div key={c.key}>
                    <div className="card-field-label">{c.label}</div>
                    <div className="card-field-value">{c.render(row)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
