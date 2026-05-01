"use client";

const PER_SHEET = 6;

export function BlankPrintSheets({ sheetCount }: { sheetCount: number }) {
  const sheets = Array.from({ length: sheetCount }, (_, i) => i);
  return (
    <div className="print-sheets">
      {sheets.map((i) => (
        <section
          key={i}
          className="print-sheet"
          aria-label={`Blank sheet ${i + 1} of ${sheets.length}`}
        >
          <div className="print-grid">
            {Array.from({ length: PER_SHEET }, (_, j) => (
              <div key={j} className="print-cell">
                <BlankCard />
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
          width: 8in;
          height: 9in;
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

/** A single 4×3" card with just the dashed border — for handwriting. */
function BlankCard() {
  return (
    <div
      style={{
        width: "4in",
        height: "3in",
        background: "#ffffff",
        border: "1px solid #d4d4d4",
        borderRadius: 6,
        boxSizing: "border-box",
      }}
    />
  );
}
