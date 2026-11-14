export function BeatLights({
  position,
  running,
}: {
  position: number;
  running: boolean;
}) {
  return (
    <div
      className="beat-lights"
      aria-label={`当前第 ${Math.floor(position % 4) + 1} 拍`}
    >
      {[0, 1, 2, 3].map((n) => (
        <span
          key={n}
          className={running && Math.floor(position % 4) === n ? "lit" : ""}
        />
      ))}
    </div>
  );
}
