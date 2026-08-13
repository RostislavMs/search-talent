// ---------------------------------------------------------------------------
// Line-art illustrations for the rating guide.
//
// Inline SVG rather than raster art: it inherits the page's stroke language
// from the icon set, adapts to both themes through currentColor and the chart
// tokens, and stays sharp at any size. Each one diagrams the idea in its
// section instead of decorating it.
// ---------------------------------------------------------------------------

const ACCENT = "var(--chart-series-1)";
const SECOND = "var(--chart-series-2)";

/**
 * Hero: separate profile signals feeding one combined score.
 * Drawn for a dark translucent panel, so strokes are currentColor (white).
 */
export function SignalsToScoreIllustration({ label }: { label: string }) {
  const bars = [
    { y: 96, width: 92 },
    { y: 118, width: 68 },
    { y: 140, width: 78 },
    { y: 162, width: 46 },
  ];
  // 78 % of the ring, drawn from the top and running clockwise.
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      viewBox="0 0 400 264"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {/* Profile card */}
      <rect
        x="28"
        y="46"
        width="150"
        height="172"
        rx="16"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <circle cx="58" cy="76" r="12" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
      <path
        d="M80 71h64M80 82h40"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {bars.map((bar) => (
        <rect
          key={bar.y}
          x="46"
          y={bar.y}
          width={bar.width}
          height="7"
          rx="3.5"
          fill={ACCENT}
          fillOpacity="0.9"
        />
      ))}
      <path
        d="M46 186h114M46 198h72"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Signals flowing into the score */}
      {bars.map((bar, index) => (
        <path
          key={`link-${bar.y}`}
          d={`M${46 + bar.width + 6} ${bar.y + 3.5}C${224 + index * 6} ${bar.y + 3.5} ${232} ${132} ${246} ${132}`}
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="1.5"
        />
      ))}

      {/* Score ring */}
      <circle cx="302" cy="132" r={radius} stroke="currentColor" strokeOpacity="0.25" strokeWidth="8" />
      <circle
        cx="302"
        cy="132"
        r={radius}
        stroke={ACCENT}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.78} ${circumference}`}
        transform="rotate(-90 302 132)"
      />
      <text
        x="302"
        y="142"
        textAnchor="middle"
        fill="currentColor"
        fontSize="34"
        fontWeight="600"
      >
        78
      </text>
    </svg>
  );
}

/**
 * "Why not just likes": one weighted signal outweighing a pile of cheap ones.
 */
export function BalanceIllustration({ label }: { label: string }) {
  // The beam is tipped 9° toward the earned signal, and both pans hang from
  // their own beam end on equal-length cords — so the heavier side really does
  // sit lower instead of the two being placed by eye.
  const pivot = { x: 160, y: 62 };
  const armLength = 97;
  const tilt = (-9 * Math.PI) / 180;
  const cord = 40;

  const end = (direction: -1 | 1) => ({
    x: pivot.x + direction * armLength * Math.cos(tilt),
    y: pivot.y + direction * armLength * Math.sin(tilt),
  });
  const left = end(-1);
  const right = end(1);

  const pan = (cx: number, top: number) =>
    `M${cx - 36} ${top}h72l-14 22h-44Z`;
  const leftPanTop = left.y + cord;
  const rightPanTop = right.y + cord;

  const beads = [
    [right.x - 14, rightPanTop - 7],
    [right.x, rightPanTop - 7],
    [right.x + 14, rightPanTop - 7],
    [right.x - 7, rightPanTop - 17],
    [right.x + 7, rightPanTop - 17],
    [right.x, rightPanTop - 27],
  ];

  return (
    <svg
      viewBox="0 0 320 220"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {/* Column and base */}
      <path d={`M${pivot.x} ${pivot.y}v108`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d={`M${pivot.x - 34} 182h68l-10-12h-48Z`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d={`M${pivot.x - 48} 190h96`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      {/* Beam and cords */}
      <path
        d={`M${left.x} ${left.y}L${right.x} ${right.y}`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx={pivot.x} cy={pivot.y} r="4" fill="currentColor" />
      <path
        d={`M${left.x} ${left.y}v${cord}M${right.x} ${right.y}v${cord}`}
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Left pan: one dense, earned signal — the side that drops */}
      <path d={pan(left.x, leftPanTop)} stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={left.x} cy={leftPanTop - 12} r="12" fill={ACCENT} fillOpacity="0.9" />

      {/* Right pan: many weightless ones */}
      <path
        d={pan(right.x, rightPanTop)}
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {beads.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="5"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

/**
 * "What does NOT work": interchangeable template output, pulled out and voided.
 */
export function TemplateGridIllustration({ label }: { label: string }) {
  const columns = [0, 1, 2, 3];
  const rows = [0, 1, 2, 3];

  return (
    <svg
      viewBox="0 0 320 220"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {rows.map((row) =>
        columns.map((column) => {
          // The third row's second card is the one pulled out of the grid.
          const isFlagged = row === 2 && column === 1;
          if (isFlagged) return null;
          return (
            <rect
              key={`${row}-${column}`}
              x={34 + column * 66}
              y={26 + row * 46}
              width="52"
              height="34"
              rx="6"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
          );
        }),
      )}

      {/* The empty slot it came from */}
      <rect
        x="100"
        y="118"
        width="52"
        height="34"
        rx="6"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* Lifted duplicate, marked */}
      <g transform="translate(112 100)">
        <rect
          x="0"
          y="0"
          width="52"
          height="34"
          rx="6"
          stroke="#f43f5e"
          strokeWidth="2"
          fill="var(--surface)"
        />
        <path
          d="m19 11 14 12M33 11 19 23"
          stroke="#f43f5e"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * "Two boards": the same pool ranked twice on different rules.
 */
export function TwoBoardsIllustration({ label }: { label: string }) {
  const allTime = [46, 38, 30, 22];
  const month = [26, 44, 20, 36];

  return (
    <svg
      viewBox="0 0 320 160"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {[0, 1].map((board) => {
        const offsetX = board === 0 ? 24 : 180;
        const values = board === 0 ? allTime : month;
        const color = board === 0 ? ACCENT : SECOND;
        return (
          <g key={board}>
            <rect
              x={offsetX}
              y="20"
              width="116"
              height="120"
              rx="12"
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            {values.map((value, index) => (
              <g key={index}>
                <circle
                  cx={offsetX + 22}
                  cy={46 + index * 24}
                  r="7"
                  stroke="currentColor"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
                <rect
                  x={offsetX + 38}
                  y={42 + index * 24}
                  width={value}
                  height="7"
                  rx="3.5"
                  fill={color}
                  fillOpacity={index === 0 ? 0.95 : 0.55}
                />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
