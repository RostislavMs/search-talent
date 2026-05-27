"use client";

import Link from "next/link";
import CommentDeleteButton from "@/components/admin/comment-delete-button";
import CommentsBulkTable from "@/components/admin/comments-bulk-table";

export type CommentTableItem = {
  id: string;
  kind: "article" | "project";
  body: string;
  kindLabel: string;
  authorLabel: string;
  authorHref: string | null;
  targetLabel: string;
  targetHref: string | null;
  createdAtLabel: string;
};

type ColumnLabels = {
  body: string;
  author: string;
  target: string;
  created: string;
  actions: string;
};

type BulkLabels = {
  selected: string;
  clear: string;
  bulkDelete: string;
  applying: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmButton: string;
  cancel: string;
  errorFallback: string;
};

type RowDeleteLabels = {
  delete: string;
  deleting: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmButton: string;
  cancel: string;
  errorFallback: string;
};

type Props = {
  items: CommentTableItem[];
  columnLabels: ColumnLabels;
  bulkLabels: BulkLabels;
  rowDeleteLabels: RowDeleteLabels;
  selectAllLabel: string;
  selectRowLabel: string;
};

export default function CommentsTableClient({
  items,
  columnLabels,
  bulkLabels,
  rowDeleteLabels,
  selectAllLabel,
  selectRowLabel,
}: Props) {
  return (
    <CommentsBulkTable
      items={items.map((item) => ({ id: item.id, kind: item.kind }))}
      labels={bulkLabels}
    >
      {({ isSelected, toggle, toggleAll, allSelected }) => (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-eyebrow app-soft">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    className="app-checkbox"
                    aria-label={selectAllLabel}
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-3">{columnLabels.body}</th>
                <th className="px-3 py-3">{columnLabels.author}</th>
                <th className="px-3 py-3">{columnLabels.target}</th>
                <th className="px-3 py-3">{columnLabels.created}</th>
                <th className="px-3 py-3 text-right">{columnLabels.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const item = { id: row.id, kind: row.kind };
                return (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className="border-t border-[color:var(--border)] align-top"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="app-checkbox"
                        aria-label={selectRowLabel}
                        checked={isSelected(item)}
                        onChange={() => toggle(item)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="max-w-md whitespace-pre-wrap text-[color:var(--foreground)]">
                        {row.body}
                      </p>
                      <p className="mt-1 text-xs app-soft">{row.kindLabel}</p>
                    </td>
                    <td className="px-3 py-3">
                      {row.authorHref ? (
                        <Link
                          href={row.authorHref}
                          className="text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                        >
                          {row.authorLabel}
                        </Link>
                      ) : (
                        <span className="app-muted">{row.authorLabel}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {row.targetHref ? (
                        <Link
                          href={row.targetHref}
                          className="text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                        >
                          {row.targetLabel}
                        </Link>
                      ) : (
                        <span className="app-muted">{row.targetLabel}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="app-muted">{row.createdAtLabel}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <CommentDeleteButton
                        commentId={row.id}
                        kind={row.kind}
                        labels={rowDeleteLabels}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CommentsBulkTable>
  );
}
