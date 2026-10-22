const LANDOLT_PATH =
  "M3 0.0505 A2.5 2.5 0 1 1 2 0.0505 L2 1.0858 A1.5 1.5 0 1 0 3 1.0858 Z";

export default function LandoltC({ sizePx, angle }) {
  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 5 5"
      role="img"
      aria-label="Landolt C"
      shapeRendering="geometricPrecision"
      style={{
        display: "block",
        transform: `rotate(${angle}deg)`,
      }}
    >
      <path d={LANDOLT_PATH} fill="#000" />
    </svg>
  );
}