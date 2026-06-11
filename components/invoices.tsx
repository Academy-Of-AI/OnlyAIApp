"use client";

import { useEffect, useState } from "react";
import { formatDate, formatMoney } from "@/lib/date";

type Inv = {
  id: string; number: string | null; created: number;
  amount: number; currency: string; status: string | null;
  pdf: string | null; url: string | null;
};

export function Invoices() {
  const [invoices, setInvoices] = useState<Inv[] | null>(null);

  useEffect(() => {
    fetch("/api/stripe/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .catch(() => setInvoices([]));
  }, []);

  if (invoices === null) return <p className="text-sm text-on-surface-variant">Loading invoices…</p>;
  if (invoices.length === 0) return <p className="text-sm text-on-surface-variant">No invoices yet — they’ll appear here after your first payment.</p>;

  return (
    <div className="panel divide-y divide-[var(--color-outline-variant)]">
      {invoices.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="text-on-surface">{formatDate(inv.created)} · {formatMoney(inv.amount, inv.currency)}</p>
            <p className="text-xs text-on-surface-variant truncate">{inv.number ?? inv.id}{inv.status ? ` · ${inv.status}` : ""}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {inv.pdf && <a href={inv.pdf} className="btn-ghost text-xs px-3 py-1.5">Download PDF</a>}
            {inv.url && <a href={inv.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-dim hover:underline">View</a>}
          </div>
        </div>
      ))}
    </div>
  );
}
