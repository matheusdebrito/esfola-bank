export function exportToCsv<T extends Record<string, unknown>>({
  filename,
  data,
  columns,
}: {
  filename: string;
  data: T[];
  columns: { key: string; label: string }[];
}) {
  const headers = columns.map((c) => c.label);
  const rows = data.map((row) =>
    columns.map((c) => {
      const value = c.key.split(".").reduce((o: any, k) => (o == null ? undefined : o[k]), row);
      const stringValue = value == null ? "" : String(value);
      // escape aspas e quebra de linha para CSV
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }),
  );

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
