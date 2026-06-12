/**
 * Three-number stats cluster shown to the right of the "Welcome, …"
 * title on /directory. Hairline-separated, Fraunces numbers,
 * letter-spaced uppercase labels. Server component.
 */

interface Props {
  alumni: number;
  countries: number;
  colleges: number;
}

const cells: Array<{ key: keyof Props; label: string }> = [
  { key: "alumni", label: "Alumni" },
  { key: "countries", label: "Countries" },
  { key: "colleges", label: "Colleges" },
];

export function StatsCluster(props: Props) {
  return (
    <div className="flex items-stretch shrink-0">
      {cells.map((c, i) => (
        <div
          key={c.key}
          className="flex flex-col items-center justify-center gap-[5px] px-6"
          style={{
            borderLeft:
              i === 0 ? undefined : "1px solid rgba(255,255,255,.2)",
          }}
        >
          <span
            className="leading-none text-white"
            style={{
              fontFamily: "Fraunces, Georgia, serif",
              fontWeight: 600,
              fontSize: 32,
            }}
          >
            {props[c.key].toLocaleString("en-US")}
          </span>
          <span className="text-[10.5px] font-bold tracking-[.2em] uppercase text-white/65">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}
