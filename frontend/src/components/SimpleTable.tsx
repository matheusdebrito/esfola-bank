import * as React from "react";
import { ChevronDown } from "lucide-react";

export type Column<T> = {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
};

function valueOf<T>(row: T, key: string) {
  return key.split(".").reduce((obj: any, part) => obj == null ? undefined : obj[part], row) as any;
}

export function SimpleTable<T>({
  columns, data, mobileActionsAlign = "end",
}: { columns: Column<T>[]; data: T[]; mobileActionsAlign?: "start" | "center" | "end" }) {
  const rows = Array.isArray(data) ? data : [];
  const fields = columns.filter(c => c.label);
  const actions = columns.filter(c => !c.label);
  const primary = fields.slice(0, 4);
  const additional = fields.slice(4);

  if (!rows.length) return (
    <div className="flex min-h-[125px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
      <p className="text-sm font-medium text-foreground">Nenhum registro encontrado</p>
      <p className="mt-1 text-xs text-muted-foreground">Experimente alterar os filtros ou a busca.</p>
    </div>
  );

  function renderField(column: Column<T>, row: T) {
    const val = valueOf(row, column.key);
    return column.render ? column.render(val, row) : String(val ?? "—");
  }
  function fieldRows(list: Column<T>[], row: T) {
    return list.map(column => <div key={column.key} className="grid grid-cols-[minmax(0,43%)_minmax(0,1fr)] items-start gap-3 py-1.5 text-[13px]">
      <dt className="min-w-0 text-muted-foreground">{column.label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-foreground">{renderField(column, row)}</dd>
    </div>);
  }
  return (
    <>
      <div className="hidden max-w-full overflow-x-auto rounded-xl border border-border/80 md:block">
        <table className="w-full min-w-[650px] border-collapse text-sm">
          <thead className="bg-muted/80">
            <tr>{columns.map(c => <th key={c.key} scope="col"
              className="whitespace-nowrap border-b border-border px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
              {c.label || <span className="sr-only">Ações</span>}
            </th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row, index) => <tr key={typeof (row as any)?.id === "string" ? (row as any).id : index} className="transition-colors hover:bg-muted/40">
              {columns.map(c => <td key={c.key} className="max-w-[300px] break-words px-4 py-3.5 align-middle text-[13px] text-foreground">
                {renderField(c, row)}
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="space-y-2.5 md:hidden">
        {rows.map((row, index) => <article
          key={typeof (row as any)?.id === "string" ? (row as any).id : index}
          className="min-w-0 rounded-2xl border border-border/80 bg-card px-4 py-3.5 shadow-sm shadow-slate-900/[.03]">
          <dl className="divide-y divide-border/40">
            {fieldRows(primary, row)}
          </dl>
          {additional.length > 0 && <details className="group mt-2 border-t border-border/70 pt-2">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Ver mais detalhes <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <dl className="mt-1 divide-y divide-border/40">{fieldRows(additional, row)}</dl>
          </details>}
          {actions.length > 0 && <div className={"mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 " +
            (mobileActionsAlign === "center" ? "justify-center" : mobileActionsAlign === "start" ? "justify-start" : "justify-end")}>
            {actions.map(column => <React.Fragment key={column.key}>{renderField(column, row)}</React.Fragment>)}
          </div>}
        </article>)}
      </div>
    </>
  );
}
