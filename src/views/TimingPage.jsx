import { useEffect, useMemo, useRef } from "react";
import { Controls } from "../components/Controls.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { TimingTable } from "../components/TimingTable.jsx";
import { useTimingController } from "../controllers/useTimingController.js";

const DEFAULT_SESSION = {
  countryName: "United Arab Emirates",
  year: "2025",
  sessionName: "Qualifying",
};

export const TimingPage = () => {
  const {
    form,
    setForm,
    sessionData,
    sessionPhase,
    loadStatus,
    playbackSpeed,
    setPlaybackSpeed,
    simCurrent,
    progress,
    lapsRequestsTotal,
    lapsRequestsDone,
    lapsProgressText,
    standings,
    startPlayback,
    resetPlayback,
    loadSessionData,
    getSegmentClass,
  } = useTimingController({
    defaultSession: DEFAULT_SESSION,
    rateLimitMs: 700,
  });

  const positionDeltasRef = useRef(new Map());
  const prevPositionsRef = useRef(new Map());
  const positionMovesRef = useRef(new Map());

  useEffect(() => {
    const currentPositions = new Map();
    const deltas = new Map();
    const now = simCurrent ?? 0;
    const moves = new Map();
    positionMovesRef.current.forEach((value, driverNumber) => {
      if (value.until > now) {
        moves.set(driverNumber, value);
      }
    });
    standings.forEach((driver, index) => {
      const position = index + 1;
      currentPositions.set(driver.number, position);
      const previous = prevPositionsRef.current.get(driver.number);
      const delta = previous ? previous - position : 0;
      deltas.set(driver.number, delta);
      if (delta !== 0) {
        moves.set(driver.number, {
          direction: delta > 0 ? "up" : "down",
          until: now + 5000,
        });
      }
    });
    positionDeltasRef.current = deltas;
    prevPositionsRef.current = currentPositions;
    positionMovesRef.current = moves;
  }, [simCurrent, standings]);

  const positionDeltas = useMemo(
    () => positionDeltasRef.current,
    [standings],
  );
  const positionMoves = useMemo(
    () => positionMovesRef.current,
    [standings, simCurrent],
  );

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Тайминг квалификации (replay)</h1>
          <p className="muted">Abu Dhabi 2025 · Q1 / Q2 / Q3 · OpenF1</p>
        </div>
      </header>

      <section className="panel">
        <Controls
          form={form}
          setForm={setForm}
          onLoad={() => loadSessionData()}
          onStart={startPlayback}
          onReset={resetPlayback}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          disabled={!sessionData}
        />

        <StatusPanel
          sessionData={sessionData}
          sessionPhase={sessionPhase}
          simCurrent={simCurrent}
          progress={progress}
          lapsRequestsTotal={lapsRequestsTotal}
          lapsRequestsDone={lapsRequestsDone}
          lapsProgressText={lapsProgressText}
          loadStatus={loadStatus}
        />
      </section>

      <section className="panel">
        <TimingTable
          standings={standings}
          simCurrent={simCurrent}
          getSegmentClass={getSegmentClass}
          positionDeltas={positionDeltas}
          positionMoves={positionMoves}
        />
      </section>
    </div>
  );
};
