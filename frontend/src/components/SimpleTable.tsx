import * as React from "react";

type Column<T> = {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
};

function valueOf<T>(row: T, key: string) {
  return key.split(".").reduce((obj: any, part) => (obj == null ? undefined : obj[part]), row) as any;
}

export function SimpleTable<T>({
  columns,
  data,
  mobileActionsAlign = "end",
}: {
  columns: Column<T>[];
  data: T[];
  mobileActionsAlign?: "start" | "center" | "end";
}) {
  const rows = Array.isArray(data) ? data : [];
  const fieldColumns = columns.filter((c) => c.label);
  const actionColumns = columns.filter((c) => !c.label);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse border-b border-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="h-12 whitespace-nowrap px-3 text-left font-medium text-muted-foreground">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border hover:bg-accent/50">
                {columns.map((c) => {
                  const val = valueOf(row, c.key);
                  return (
                    <td key={c.key} className="p-3 align-middle">
                      {c.render ? c.render(val, row) : String(val ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <dl className="space-y-2">
              {fieldColumns.map((c) => {
                const val = valueOf(row, c.key);
                return (
                  <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{c.label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium">
                      {c.render ? c.render(val, row) : String(val ?? "")}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {actionColumns.length > 0 ? (
              <div
                className={
                  "mt-3 flex items-center gap-2 border-t border-border pt-2 " +
                  (mobileActionsAlign === "center"
                    ? "justify-center"
                    : mobileActionsAlign === "start"
                      ? "justify-start"
                      : "justify-end")
                }
              >
                {actionColumns.map((c) => (
                  <React.Fragment key={c.key}>{c.render ? c.render(valueOf(row, c.key), row) : null}</React.Fragment>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
