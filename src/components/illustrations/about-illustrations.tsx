// ---------------------------------------------------------------------------
// Line-art illustrations for the About page.
//
// Same rules as the rating-guide set: inline SVG, one stroke weight, geometry
// computed rather than eyeballed, and colour limited to currentColor plus the
// two chart slots. That keeps a single drawing usable on the light cards and
// on the dark hero without a second asset, and keeps the page free of raster
// artwork the rest of the site does not have.
// ---------------------------------------------------------------------------

const ACCENT = "var(--chart-series-1)";
const SECOND = "var(--chart-series-2)";

/** Five-point star, used by the recognition marks. */
function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

/** Tag glyph with its eyelet, anchored at its top-left corner. */
function Tag({ x, y, stroke }: { x: number; y: number; stroke: string }) {
  return (
    <g>
      <path
        d={`M${x} ${y}h12l7 7-7 7h-12z`}
        stroke={stroke}
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx={x + 5} cy={y + 7} r="1.6" fill={stroke} fillOpacity="0.5" />
    </g>
  );
}

// ---- Hero ------------------------------------------------------------------

/**
 * Hero: one profile feeding every surface the platform has — a project, an
 * article, a leaderboard, a rating. Drawn for the dark hero panel, so the
 * structural strokes are currentColor (white there).
 */
export function PlatformMapIllustration({ label }: { label: string }) {
  const ring = { cx: 250, cy: 132, r: 104 };
  // Four surfaces spread evenly across the 120° arc facing the profile.
  const surfaces = [-60, -20, 20, 60].map((degrees) => {
    const radians = (degrees * Math.PI) / 180;
    return {
      degrees,
      cx: ring.cx + ring.r * Math.cos(radians),
      cy: ring.cy + ring.r * Math.sin(radians),
    };
  });
  const card = { x: 18, y: 88, width: 132, height: 88 };
  const exit = { x: card.x + card.width, y: ring.cy };
  const tile = { width: 56, height: 42 };

  return (
    <svg
      viewBox="0 0 400 264"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {/* Orbit the surfaces sit on */}
      <circle
        cx={ring.cx}
        cy={ring.cy}
        r={ring.r}
        stroke={ACCENT}
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />

      {/* The profile everything starts from */}
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx="14"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <circle
        cx={card.x + 28}
        cy={card.y + 30}
        r="12"
        stroke={ACCENT}
        strokeWidth="1.5"
      />
      <path
        d={`M${card.x + 20} ${card.y + 36}a8 8 0 0 1 16 0`}
        stroke={ACCENT}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx={card.x + 28} cy={card.y + 25} r="4.5" stroke={ACCENT} strokeWidth="1.5" />
      <path
        d={`M${card.x + 50} ${card.y + 24}h60M${card.x + 50} ${card.y + 34}h44`}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d={`M${card.x + 20} ${card.y + 60}h92M${card.x + 20} ${card.y + 70}h58`}
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Connectors fanning out to each surface */}
      {surfaces.map((surface) => (
        <path
          key={`link-${surface.degrees}`}
          d={`M${exit.x} ${exit.y}C${exit.x + 58} ${exit.y} ${
            surface.cx - 70
          } ${surface.cy} ${surface.cx - tile.width / 2 - 4} ${surface.cy}`}
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
      ))}

      {/* The surfaces themselves */}
      {surfaces.map((surface, index) => {
        const x = surface.cx - tile.width / 2;
        const y = surface.cy - tile.height / 2;
        return (
          <g key={`tile-${surface.degrees}`}>
            <rect
              x={x}
              y={y}
              width={tile.width}
              height={tile.height}
              rx="10"
              stroke="currentColor"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
            {index === 0 ? (
              // Project media
              <g>
                <rect
                  x={x + 14}
                  y={y + 12}
                  width="28"
                  height="18"
                  rx="3"
                  stroke="currentColor"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                />
                <circle cx={x + 21} cy={y + 18} r="2" fill={ACCENT} />
                <path
                  d={`M${x + 15} ${y + 28}l7-7 5 5 5-5 5 7`}
                  stroke="currentColor"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
            {index === 1 ? (
              // Article
              <path
                d={`M${x + 14} ${y + 13}h28M${x + 14} ${y + 20}h28M${x + 14} ${y + 27}h18`}
                stroke="currentColor"
                strokeOpacity="0.55"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : null}
            {index === 2 ? (
              // Leaderboard
              <g>
                {[10, 18, 26].map((height, bar) => (
                  <rect
                    key={height}
                    x={x + 16 + bar * 10}
                    y={y + 31 - height}
                    width="6"
                    height={height}
                    rx="2"
                    fill={bar === 2 ? ACCENT : "currentColor"}
                    fillOpacity={bar === 2 ? 0.95 : 0.45}
                  />
                ))}
                <path
                  d={`M${x + 12} ${y + 32}h32`}
                  stroke="currentColor"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            ) : null}
            {index === 3 ? (
              // Rating mark
              <g>
                <circle
                  cx={x + tile.width / 2}
                  cy={y + tile.height / 2}
                  r="11"
                  stroke={ACCENT}
                  strokeWidth="1.5"
                />
                <polygon
                  points={starPoints(x + tile.width / 2, y + tile.height / 2, 6, 2.6)}
                  fill={ACCENT}
                  fillOpacity="0.9"
                />
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Mission ---------------------------------------------------------------

/**
 * Mission: work scattered across a dozen places pulled into one page you own.
 */
export function ScatteredToProfileIllustration({ label }: { label: string }) {
  const focus = { x: 226, y: 120 };
  const card = { x: 250, y: 46, width: 126, height: 148 };
  // Loose fragments, each tilted a little so the pile reads as unsorted.
  const fragments = [
    { x: 44, y: 26, rotate: -8 },
    { x: 28, y: 74, rotate: 6 },
    { x: 52, y: 118, rotate: -4 },
    { x: 30, y: 162, rotate: 9 },
    { x: 68, y: 202, rotate: -6 },
  ];

  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {/* Converging guides */}
      {fragments.map((fragment) => (
        <path
          key={`guide-${fragment.y}`}
          d={`M${fragment.x + 40} ${fragment.y + 14}L${focus.x} ${focus.y}`}
          stroke={ACCENT}
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
      <path
        d={`M${focus.x} ${focus.y}h${card.x - focus.x}`}
        stroke={ACCENT}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Fragments */}
      {fragments.map((fragment, index) => (
        <g
          key={`fragment-${fragment.y}`}
          transform={`rotate(${fragment.rotate} ${fragment.x + 14} ${fragment.y + 14})`}
        >
          <rect
            x={fragment.x}
            y={fragment.y}
            width="30"
            height="28"
            rx="6"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
          {index % 2 === 0 ? (
            <path
              d={`M${fragment.x + 7} ${fragment.y + 20}l6-7 4 4 5-6`}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d={`M${fragment.x + 8} ${fragment.y + 11}h14M${fragment.x + 8} ${
                fragment.y + 18
              }h9`}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
        </g>
      ))}

      {/* The one page it all lands on */}
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx="16"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.8"
      />
      <circle cx={card.x + 63} cy={card.y + 46} r="21" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.8" />
      <circle cx={card.x + 63} cy={card.y + 39} r="8" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.8" />
      <path
        d={`M${card.x + 50} ${card.y + 58}a13 13 0 0 1 26 0`}
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d={`M${card.x + 20} ${card.y + 84}h86M${card.x + 32} ${card.y + 96}h62`}
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {[0, 1, 2].map((pill) => (
        <rect
          key={pill}
          x={card.x + 18 + pill * 34}
          y={card.y + 112}
          width="28"
          height="12"
          rx="6"
          stroke={pill === 0 ? ACCENT : "currentColor"}
          strokeOpacity={pill === 0 ? 1 : 0.45}
          strokeWidth="1.6"
        />
      ))}
    </svg>
  );
}

// ---- How it works ----------------------------------------------------------

/**
 * Three steps: fill a profile, publish work, get ranked. One wide drawing
 * rather than three separate ones, because the connectors are the point.
 */
export function StepFlowIllustration({ label }: { label: string }) {
  const steps = [16, 198, 380];
  const size = 84;
  const midY = 24 + size / 2;

  return (
    // Sits in an auto-height band rather than a fixed-aspect slot, so the
    // height comes from the viewBox instead of the parent.
    <svg
      viewBox="0 0 480 132"
      className="h-auto w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {/* Connectors between the steps */}
      {[0, 1].map((gap) => {
        const from = steps[gap] + size;
        const to = steps[gap + 1];
        const node = (from + to) / 2;
        return (
          <g key={gap}>
            <path
              d={`M${from + 6} ${midY}h${to - from - 12}`}
              stroke={ACCENT}
              strokeOpacity="0.75"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx={node} cy={midY} r="6" stroke={ACCENT} strokeWidth="1.6" />
            <circle cx={node} cy={midY} r="2.4" fill={ACCENT} />
            <path
              d={`M${to - 14} ${midY - 5}l5 5-5 5`}
              stroke={ACCENT}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {steps.map((x, index) => (
        <g key={x} transform={`translate(${x} 24)`}>
          <rect
            x="0"
            y="0"
            width={size}
            height={size}
            rx="18"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="1.6"
          />
          {index === 0 ? (
            // Fill the profile
            <g>
              <circle cx="42" cy="40" r="22" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" />
              <circle cx="42" cy="33" r="8" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" />
              <path
                d="M29 53a13 13 0 0 1 26 0"
                stroke="currentColor"
                strokeOpacity="0.55"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="m32 40 7 7 14-15"
                stroke={ACCENT}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : null}
          {index === 1 ? (
            // Publish work
            <g>
              {[0, 1, 2].map((sheet) => (
                <rect
                  key={sheet}
                  x={22 + (2 - sheet) * 8}
                  y={18 + sheet * 7}
                  width="34"
                  height="44"
                  rx="6"
                  stroke="currentColor"
                  strokeOpacity={sheet === 2 ? 0.6 : 0.3}
                  strokeWidth="1.6"
                />
              ))}
              <path
                d="M30 46h18M30 54h11"
                stroke={ACCENT}
                strokeOpacity="0.8"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </g>
          ) : null}
          {index === 2 ? (
            // Get ranked
            <g>
              <path
                d="m20 52 12-13 9 8 15-19"
                stroke={ACCENT}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M50 28h8v8"
                stroke={ACCENT}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 64h48"
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <rect
                x="34"
                y="56"
                width="16"
                height="8"
                rx="2"
                stroke="currentColor"
                strokeOpacity="0.55"
                strokeWidth="1.6"
              />
            </g>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

// ---- Community -------------------------------------------------------------

/**
 * Community: a closed loop — people react to work, the work's standing moves,
 * which is what brings the next people in.
 */
export function CommunityLoopIllustration({ label }: { label: string }) {
  const center = { x: 170, y: 126 };
  const orbit = 96;
  const nodeAngles = [-90, 30, 150];
  const point = (degrees: number, radius = orbit) => {
    const radians = (degrees * Math.PI) / 180;
    return {
      x: center.x + radius * Math.cos(radians),
      y: center.y + radius * Math.sin(radians),
    };
  };
  // Each arc runs between two avatars, broken where a glyph sits on it.
  const arc = (from: number, to: number) => {
    const start = point(from);
    const end = point(to);
    return `M${start.x} ${start.y}A${orbit} ${orbit} 0 0 1 ${end.x} ${end.y}`;
  };
  const segments = [
    { d: arc(-74, -46) },
    { d: arc(-14, 14), arrow: 14 },
    { d: arc(46, 76) },
    { d: arc(104, 134), arrow: 134 },
    { d: arc(166, 254), arrow: 254 },
  ];
  const heart = point(-30);
  const bubble = point(90);

  return (
    <svg
      viewBox="0 0 340 252"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {segments.map((segment) => (
        <g key={segment.d}>
          <path d={segment.d} stroke={ACCENT} strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" />
          {segment.arrow !== undefined
            ? (() => {
                const tip = point(segment.arrow);
                // Rotate the head to the tangent, which is the angle + 90°.
                return (
                  <path
                    d="M-5 -5 0 0 -5 5"
                    stroke={ACCENT}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform={`translate(${tip.x} ${tip.y}) rotate(${segment.arrow + 90})`}
                  />
                );
              })()
            : null}
        </g>
      ))}

      {/* The work everyone is reacting to */}
      <rect
        x={center.x - 62}
        y={center.y - 40}
        width="124"
        height="80"
        rx="14"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.8"
      />
      {[16, 28, 42].map((height, bar) => (
        <rect
          key={height}
          x={center.x - 36 + bar * 26}
          y={center.y + 22 - height}
          width="16"
          height={height}
          rx="3"
          fill={bar === 2 ? ACCENT : "currentColor"}
          fillOpacity={bar === 2 ? 0.9 : 0.35}
        />
      ))}
      <path
        d={`M${center.x - 42} ${center.y + 24}h84`}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* People */}
      {nodeAngles.map((angle) => {
        const node = point(angle);
        return (
          <g key={angle}>
            <circle cx={node.x} cy={node.y} r="22" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.8" />
            <circle cx={node.x} cy={node.y - 6} r="7.5" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.8" />
            <path
              d={`M${node.x - 12} ${node.y + 15}a12 12 0 0 1 24 0`}
              stroke="currentColor"
              strokeOpacity="0.55"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* A reaction and a comment, sitting in the gaps in the loop */}
      <path
        d={`M${heart.x} ${heart.y + 7}c-9-7-13-11-13-16a6.5 6.5 0 0 1 13-3.5 6.5 6.5 0 0 1 13 3.5c0 5-4 9-13 16Z`}
        stroke={ACCENT}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d={`M${bubble.x - 15} ${bubble.y - 11}h30a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-11l-7 7v-7h-12a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z`}
        stroke={ACCENT}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {[-7, 0, 7].map((offset) => (
        <circle key={offset} cx={bubble.x + offset} cy={bubble.y - 2} r="1.8" fill={ACCENT} />
      ))}
    </svg>
  );
}

// ---- Built in the open -----------------------------------------------------

/**
 * Built in the open: the product on the bench, with contributions coming in
 * from outside it.
 */
export function OpenBuildIllustration({ label }: { label: string }) {
  const panel = { x: 30, y: 70, width: 300, height: 96 };
  const inbound = [
    { x: 88, y: 34, filled: false },
    { x: 180, y: 22, filled: true },
    { x: 272, y: 34, filled: false },
  ];

  return (
    <svg
      viewBox="0 0 360 200"
      className="h-full w-full"
      fill="none"
      role="img"
      aria-label={label}
    >
      {/* Contributions arriving */}
      {inbound.map((node) => (
        <g key={node.x}>
          <path
            d={`M${node.x} ${node.y + 12}L${node.x + (180 - node.x) * 0.42} ${panel.y - 4}`}
            stroke={ACCENT}
            strokeOpacity="0.7"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="1 6"
          />
          <circle
            cx={node.x}
            cy={node.y}
            r="9"
            stroke={ACCENT}
            strokeWidth="1.8"
            fill={node.filled ? ACCENT : "none"}
          />
        </g>
      ))}

      {/* The thing being built */}
      <rect
        x={panel.x}
        y={panel.y}
        width={panel.width}
        height={panel.height}
        rx="16"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.8"
      />
      <rect
        x={panel.x + 18}
        y={panel.y + 16}
        width="120"
        height="64"
        rx="8"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.6"
      />
      {[0, 1, 2].map((row) => (
        <rect
          key={row}
          x={panel.x + 158}
          y={panel.y + 18 + row * 22}
          width={row === 2 ? 96 : 124}
          height="14"
          rx="7"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.6"
        />
      ))}

      {/* Measured, not guessed */}
      <path
        d="M20 184h320"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {[100, 260].map((tick) => (
        <path
          key={tick}
          d={`M${tick} 176v16`}
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// ---- Pillar vignettes ------------------------------------------------------
//
// Small drawings for the four "platform at a glance" cards. They share a
// 160×112 frame so the card row stays on one optical baseline.

export function ProfileVignette({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 160 112" className="h-full w-full" fill="none" role="img" aria-label={label}>
      <rect x="44" y="6" width="72" height="70" rx="12" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.6" />
      <circle cx="80" cy="27" r="11" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" />
      <circle cx="80" cy="23" r="4" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" />
      <path d="M73 34a7 7 0 0 1 14 0" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M58 48h44M66 55h28" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" />
      {[0, 1, 2].map((pill) => (
        <rect
          key={pill}
          x={54 + pill * 20}
          y="62"
          width="16"
          height="8"
          rx="4"
          fill={pill === 0 ? ACCENT : "currentColor"}
          fillOpacity={pill === 0 ? 0.9 : 0.3}
        />
      ))}
      {/* Exported as a résumé */}
      <path d="M80 80v16m0 0-5-5m5 5 5-5" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M62 96v8h36v-8" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PortfolioVignette({ label }: { label: string }) {
  // Three tags, each 19 wide (12 body + 7 point) on a 26 pitch, centred under
  // the frame. Nothing overlaps the frame: crossing strokes read as a mistake
  // at this size.
  const tagStart = 80 - (19 + 2 * 26) / 2;
  return (
    <svg viewBox="0 0 160 112" className="h-full w-full" fill="none" role="img" aria-label={label}>
      <rect x="30" y="12" width="100" height="58" rx="12" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.6" />
      {/* Optically centred rather than geometrically: a triangle's mass sits
          behind its tip. */}
      <path d="m72 27 22 14-22 14z" stroke={ACCENT} strokeWidth="1.8" strokeLinejoin="round" />
      {[0, 1, 2].map((tag) => (
        <Tag key={tag} x={tagStart + tag * 26} y={84} stroke="currentColor" />
      ))}
    </svg>
  );
}

export function KnowledgeVignette({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 160 112" className="h-full w-full" fill="none" role="img" aria-label={label}>
      {/* Speech bubble above the spread */}
      <path
        d="M62 6h36a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7h-12l-8 8v-8H62a7 7 0 0 1-7-7V13a7 7 0 0 1 7-7Z"
        stroke={ACCENT}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Article on the left, poll on the right */}
      <path
        d="M14 48h58v52c0-4-26-6-58-4z"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M146 48H88v52c0-4 26-6 58-4z"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M72 48v52M88 48v52" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.6" />
      <path
        d="M22 60h42M22 68h42M22 76h34M22 84h42"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {[12, 24, 32].map((height, bar) => (
        <rect
          key={height}
          x={98 + bar * 14}
          y={90 - height}
          width="9"
          height={height}
          rx="2"
          fill={bar === 2 ? SECOND : "currentColor"}
          fillOpacity={bar === 2 ? 0.9 : 0.3}
        />
      ))}
    </svg>
  );
}

export function RecognitionVignette({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 160 112" className="h-full w-full" fill="none" role="img" aria-label={label}>
      {/* Wings framing the mark. Two symmetric pairs rather than full arcs:
          an arc wide enough to span the podium passes straight through the
          medal, which reads as a crossing-out. */}
      <path d="M32 62Q36 36 62 30" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M128 62Q124 36 98 30" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 70Q22 26 58 16" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M142 70Q138 26 102 16" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="80" cy="26" r="16" stroke={ACCENT} strokeWidth="1.8" />
      <polygon points={starPoints(80, 26, 8.5, 3.6)} fill={ACCENT} fillOpacity="0.9" />
      {/* Podium: second, first, third */}
      <rect x="26" y="76" width="34" height="24" rx="3" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" />
      <rect x="62" y="60" width="34" height="40" rx="3" stroke={ACCENT} strokeWidth="1.8" />
      <rect x="98" y="84" width="34" height="16" rx="3" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" />
      <path d="M18 104h124" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
