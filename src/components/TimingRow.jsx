const formatTimeMs = (ms) => {
  if (!Number.isFinite(ms)) return "—";
  const totalSeconds = Math.max(0, ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
};

const formatGapMs = (ms) => {
  if (!Number.isFinite(ms)) return "—";
  const totalSeconds = Math.max(0, ms / 1000);
  return `+${totalSeconds.toFixed(3)}`;
};

const formatClockTime = (timeMs) => {
  if (!Number.isFinite(timeMs)) return "—";
  return new Date(timeMs).toISOString().slice(11, 19);
};

export const TimingRow = ({
  driver,
  index,
  delta,
  moveIndicator,
  simCurrent,
  getSegmentClass,
}) => {
  const s1 =
    driver.currentLap && simCurrent >= driver.currentLap.sector1End
      ? driver.currentLap.sector1Ms
      : driver.lastS1;
  const s2 =
    driver.currentLap && simCurrent >= driver.currentLap.sector2End
      ? driver.currentLap.sector2Ms
      : driver.lastS2;
  const s3 =
    driver.currentLap && simCurrent >= driver.currentLap.sector3End
      ? driver.currentLap.sector3Ms
      : driver.lastS3;
  const bestS1 = driver.bestS1;
  const bestS2 = driver.bestS2;
  const bestS3 = driver.bestS3;

  const miniSegments = driver.currentLap
    ? driver.currentLap.minisectors.map((segment, idx) => ({
        key: `${driver.number}-${idx}`,
        value: segment.value,
        active: simCurrent >= segment.endMs,
      }))
    : driver.lastSegments
      ? driver.lastSegments.map((value, idx) => ({
          key: `${driver.number}-last-${idx}`,
          value,
          active: true,
        }))
      : [];

  const movementClass =
    delta > 0 ? "row-move-up" : delta < 0 ? "row-move-down" : "";
  const highlightBestLap =
    Number.isFinite(simCurrent) &&
    Number.isFinite(driver.bestLapHighlightUntil) &&
    simCurrent <= driver.bestLapHighlightUntil;
  const highlightClass = highlightBestLap ? "best-lap-highlight" : "";
  const showMoveIndicator =
    moveIndicator && Number.isFinite(simCurrent) && simCurrent <= moveIndicator.until;
  const sectorBestClassS1 = driver.isGlobalBestS1 ? "sector-global-best" : "";
  const sectorBestClassS2 = driver.isGlobalBestS2 ? "sector-global-best" : "";
  const sectorBestClassS3 = driver.isGlobalBestS3 ? "sector-global-best" : "";
  const sectorCurrentClassS1 =
    Number.isFinite(s1) &&
    Number.isFinite(driver.globalBestS1) &&
    s1 < driver.globalBestS1
      ? "sector-current-best"
      : "";
  const sectorCurrentClassS2 =
    Number.isFinite(s2) &&
    Number.isFinite(driver.globalBestS2) &&
    s2 < driver.globalBestS2
      ? "sector-current-best"
      : "";
  const sectorCurrentClassS3 =
    Number.isFinite(s3) &&
    Number.isFinite(driver.globalBestS3) &&
    s3 < driver.globalBestS3
      ? "sector-current-best"
      : "";

  return (
    <tr
      className={[
        driver.pitOut ? "row-pitout" : driver.onTrack ? "row-fast" : "",
        movementClass,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <td className="pos-cell">
        <span className="pos-content">
          {showMoveIndicator ? (
            <span className={`move-indicator move-${moveIndicator.direction}`}>
              {moveIndicator.direction === "up" ? "▲" : "▼"}
            </span>
          ) : (
            <span className="move-indicator move-equal">=</span>
          )}
          {index + 1}
        </span>
      </td>
      <td>
        <span className="dot" style={{ background: driver.teamColor }}></span>
        {driver.acronym}
      </td>
      <td className={highlightClass}>
        {driver.bestLap !== null ? formatTimeMs(driver.bestLap) : "—"}
      </td>
      <td>{formatGapMs(driver.gapToLeader)}</td>
      <td>{formatGapMs(driver.intervalToAhead)}</td>
      <td className={highlightClass}>
        {driver.lastLap !== null ? formatTimeMs(driver.lastLap) : "—"}
      </td>
      <td>
        <div className="sector-cell">
          <span className={`sector-best ${sectorBestClassS1}`}>
            {Number.isFinite(bestS1) ? formatTimeMs(bestS1) : "—"}
          </span>
          <span className={`sector-current ${sectorCurrentClassS1}`}>
            {Number.isFinite(s1) ? formatTimeMs(s1) : "—"}
          </span>
        </div>
      </td>
      <td>
        <div className="sector-cell">
          <span className={`sector-best ${sectorBestClassS2}`}>
            {Number.isFinite(bestS2) ? formatTimeMs(bestS2) : "—"}
          </span>
          <span className={`sector-current ${sectorCurrentClassS2}`}>
            {Number.isFinite(s2) ? formatTimeMs(s2) : "—"}
          </span>
        </div>
      </td>
      <td>
        <div className="sector-cell">
          <span className={`sector-best ${sectorBestClassS3}`}>
            {Number.isFinite(bestS3) ? formatTimeMs(bestS3) : "—"}
          </span>
          <span className={`sector-current ${sectorCurrentClassS3}`}>
            {Number.isFinite(s3) ? formatTimeMs(s3) : "—"}
          </span>
        </div>
      </td>
      <td>
        {miniSegments.length ? (
          <div className="minisectors">
            {miniSegments.map((segment) => (
              <span
                key={segment.key}
                className={`minisector ${
                  segment.active ? getSegmentClass(segment.value) : "segment-empty"
                }`}
              ></span>
            ))}
          </div>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
};
