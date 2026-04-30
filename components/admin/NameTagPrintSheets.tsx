"use client";

import { NameTagCard, type NameTagLayout } from "./NameTagComposer";
import type { NameTag } from "@/lib/event-name-tags";

const PER_SHEET = 6;

export function PrintSheets({
  tags,
  layout = "standard",
}: {
  tags: NameTag[];
  layout?: NameTagLayout;
}) {
  // Chunk tags into sheets of 6.
  const sheets: NameTag[][] = [];
  for (let i = 0; i < tags.length; i += PER_SHEET) {
    sheets.push(tags.slice(i, i + PER_SHEET));
  }

  return (
    <div className="print-sheets">
      {sheets.map((sheet, i) => (
        <section
          key={i}
          className="print-sheet"
          aria-label={`Sheet ${i + 1} of ${sheets.length}`}
        >
          <div className="print-grid">
            {sheet.map((tag) => (
              <div key={tag.id} className="print-cell">
                <NameTagCard tag={tag} widthPx={384} layout={layout} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <style jsx global>{`
        @page {
          size: letter portrait;
          margin: 1in 0.25in;
        }

        .print-sheets {
          background: var(--ivory);
          padding: 24px 0;
        }

        .print-sheet {
          background: white;
          width: 8in; /* matches 8.5in - 0.25in margins */
          height: 9in; /* matches 11in - 1in margins */
          margin: 0 auto 24px;
          box-shadow: 0 4px 16px -4px rgba(11, 37, 69, 0.18);
          page-break-after: always;
        }
        .print-sheet:last-child {
          page-break-after: auto;
        }

        .print-grid {
          display: grid;
          grid-template-columns: repeat(2, 4in);
          grid-template-rows: repeat(3, 3in);
          width: 8in;
          height: 9in;
        }

        .print-cell {
          width: 4in;
          height: 3in;
          /* The NameTagCard inside is exactly 4×3 inches with its own
             border, so the cell is just a positioning container. */
        }

        @media print {
          .print-sheets {
            background: white;
            padding: 0;
          }
          .print-sheet {
            box-shadow: none;
            margin: 0;
            page-break-after: always;
          }
          .print-sheet:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
