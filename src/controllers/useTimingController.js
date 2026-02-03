import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createOpenF1Client } from "../models/openf1Api.js";

const SEGMENT_CLASSES = {
  2048: "segment-yellow",
  2049: "segment-green",
  2051: "segment-purple",
  2064: "segment-pitlane",
  0: "segment-empty",
};

const buildLapTiming = (lap) => {
  if (!lap?.date_start) return null;
  const startMs = new Date(lap.date_start).getTime();
  if (!Number.isFinite(startMs)) return null;

  const s1 = lap.duration_sector_1 ? lap.duration_sector_1 * 1000 : null;
  const s2 = lap.duration_sector_2 ? lap.duration_sector_2 * 1000 : null;
  const s3 = lap.duration_sector_3 ? lap.duration_sector_3 * 1000 : null;
  const hasLapDuration = lap.lap_duration !== null && lap.lap_duration !== undefined;
  const lapDurationMs = hasLapDuration
    ? lap.lap_duration * 1000
    : s1 !== null && s2 !== null && s3 !== null
      ? s1 + s2 + s3
      : null;
  const s1End = s1 ? startMs + s1 : null;
  const s2End = s2 && s1End ? s1End + s2 : null;
  const s3End = s3 && s2End ? s2End + s3 : null;
  const sectorSumMs =
    s1 !== null && s2 !== null && s3 !== null ? s1 + s2 + s3 : null;
  const sectorSumEnd = sectorSumMs ? startMs + sectorSumMs : null;

  const minisectors = [];
  const addMiniSectors = (segments, sectorStart, sectorDuration) => {
    if (!segments?.length || !sectorDuration) return;
    const segmentDuration = sectorDuration / segments.length;
    segments.forEach((value, index) => {
      const endMs = sectorStart + segmentDuration * (index + 1);
      minisectors.push({ endMs, value });
    });
  };

  addMiniSectors(lap.segments_sector_1, startMs, s1);
  if (s1End) {
    addMiniSectors(lap.segments_sector_2, s1End, s2);
  }
  if (s2End) {
    addMiniSectors(lap.segments_sector_3, s2End, s3);
  }
  const lastMiniEnd =
    minisectors.length > 0 ? minisectors[minisectors.length - 1].endMs : null;

  return {
    lapNumber: lap.lap_number,
    isPitOutLap: Boolean(lap.is_pit_out_lap),
    hasLapDuration,
    startMs,
    endMs: lapDurationMs ? startMs + lapDurationMs : null,
    lapDurationMs,
    sector1Ms: s1,
    sector2Ms: s2,
    sector3Ms: s3,
    sector1End: s1End,
    sector2End: s2End,
    sector3End: s3End,
    sectorSumEnd,
    lastMiniEnd,
    minisectors,
    segments: {
      s1: lap.segments_sector_1 ?? [],
      s2: lap.segments_sector_2 ?? [],
      s3: lap.segments_sector_3 ?? [],
    },
  };
};

const buildPhaseRanges = (raceControl, simStart, simEnd) => {
  const phaseEvents = raceControl
    .filter((item) => item.qualifying_phase)
    .map((item) => ({
      time: new Date(item.date).getTime(),
      phase: `Q${item.qualifying_phase}`,
    }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time);

  if (!phaseEvents.length) return {};

  const ranges = {};
  let current = phaseEvents[0];
  let start = Math.max(simStart, current.time);

  for (let i = 1; i < phaseEvents.length; i += 1) {
    const next = phaseEvents[i];
    if (next.phase !== current.phase) {
      ranges[current.phase] = {
        start,
        end: Math.max(start, next.time),
      };
      current = next;
      start = Math.max(simStart, next.time);
    }
  }

  ranges[current.phase] = {
    start,
    end: Math.max(start, simEnd),
  };

  return ranges;
};

const getPhaseAt = (time, ranges) => {
  if (!Number.isFinite(time) || !ranges) return "—";
  const entries = Object.entries(ranges);
  for (const [phase, range] of entries) {
    if (time >= range.start && time <= range.end) return phase;
  }
  return "—";
};

const computeLapStatsForTime = (state, currentTime) => {
  const laps = state.laps ?? [];
  if (!laps.length) return;
  const segmentStart = state.segmentStartMs ?? null;
  let bestLapMs = null;
  let lastLapMs = null;
  let lastS1Ms = null;
  let lastS2Ms = null;
  let lastS3Ms = null;
  let lastSegments = null;
  let lastCompletedLapNumber = null;
  let bestLapAtMs = null;
  let bestLapNumber = null;

  for (let idx = 0; idx < laps.length; idx += 1) {
    const lap = laps[idx];
    const lapTiming = lap?.timing;
    if (!lapTiming) continue;
    if (segmentStart && lapTiming.startMs < segmentStart) continue;
    const nextLapStart = laps[idx + 1]?.startMs ?? null;
    const lapEnd =
      lapTiming.sectorSumEnd ??
      lapTiming.lastMiniEnd ??
      lapTiming.sector3End ??
      lapTiming.endMs ??
      (lapTiming.hasLapDuration
        ? lapTiming.startMs + lapTiming.lapDurationMs
        : null) ??
      nextLapStart;
    if (!lapEnd || currentTime < lapEnd) break;
    if (
      !lap.isPitOutLap &&
      lapTiming.hasLapDuration &&
      lapTiming.sectorSumEnd
    ) {
      lastLapMs = lapTiming.lapDurationMs;
      lastS1Ms = lapTiming.sector1Ms;
      lastS2Ms = lapTiming.sector2Ms;
      lastS3Ms = lapTiming.sector3Ms;
      lastSegments = [
        ...lapTiming.segments.s1,
        ...lapTiming.segments.s2,
        ...lapTiming.segments.s3,
      ];
      if (bestLapMs === null || lapTiming.lapDurationMs < bestLapMs) {
        bestLapMs = lapTiming.lapDurationMs;
        bestLapAtMs = lapEnd ?? lapTiming.startMs;
        bestLapNumber = lapTiming.lapNumber;
      }
    }
    lastCompletedLapNumber = lapTiming.lapNumber;
  }

  state.bestLapMs = bestLapMs;
  state.lastLapMs = lastLapMs;
  state.lastS1Ms = lastS1Ms;
  state.lastS2Ms = lastS2Ms;
  state.lastS3Ms = lastS3Ms;
  state.lastSegments = lastSegments;
  state.lastCompletedLapNumber = lastCompletedLapNumber;
  state.bestLapAtMs = bestLapAtMs;
  state.bestLapNumber = bestLapNumber;
};

const normalizeDriver = (driver) => ({
  number: driver.driver_number,
  fullName: driver.full_name,
  acronym: driver.name_acronym,
  teamName: driver.team_name,
  teamColor: driver.team_colour ? `#${driver.team_colour}` : "#777",
});

const computeStandings = (driverStates, fallbackOrder) => {
  const entries = driverStates.map((state) => ({
    ...state.driver,
    bestLap: state.bestLapMs,
    lastLap: state.lastLapMs,
    lastLapNumber: state.lastCompletedLapNumber,
    lastS1: state.lastS1Ms,
    lastS2: state.lastS2Ms,
    lastS3: state.lastS3Ms,
    bestS1: state.bestS1Ms,
    bestS2: state.bestS2Ms,
    bestS3: state.bestS3Ms,
    bestLapAt: state.bestLapAtMs,
    bestLapNumber: state.bestLapNumber,
    bestLapHighlightUntil: state.bestLapHighlightUntil,
    onTrack: state.onTrack,
    currentLap: state.activeLapTiming,
    lastSegments: state.lastSegments,
    pitOut: state.pitOut,
    pitLane: state.pitLane,
    isEliminated: state.isEliminated,
  }));

  const fallbackIndex = new Map(
    fallbackOrder.map((driverNumber, index) => [driverNumber, index]),
  );

  const active = entries.filter((driver) => !driver.isEliminated);
  const eliminated = entries.filter((driver) => driver.isEliminated);

  const activeSorted = [...active].sort((a, b) => {
    if (a.bestLap !== null && b.bestLap !== null) {
      return a.bestLap - b.bestLap;
    }
    if (a.bestLap !== null) return -1;
    if (b.bestLap !== null) return 1;
    return (fallbackIndex.get(a.number) ?? 0) - (fallbackIndex.get(b.number) ?? 0);
  });

  const eliminatedSorted = [...eliminated].sort(
    (a, b) =>
      (fallbackIndex.get(a.number) ?? 0) - (fallbackIndex.get(b.number) ?? 0),
  );

  const sorted = [...activeSorted, ...eliminatedSorted];

  let leaderTime = null;
  sorted.forEach((driver) => {
    if (leaderTime === null && driver.bestLap !== null) {
      leaderTime = driver.bestLap;
    }
  });

  return sorted.map((driver, index) => {
    const gapToLeader =
      leaderTime !== null && driver.bestLap !== null
        ? driver.bestLap - leaderTime
        : null;
    const previous = sorted[index - 1];
    const intervalToAhead =
      previous && previous.bestLap !== null && driver.bestLap !== null
        ? driver.bestLap - previous.bestLap
        : null;
    return {
      ...driver,
      gapToLeader,
      intervalToAhead,
    };
  });
};

export const useTimingController = ({
  defaultSession,
  rateLimitMs = 600,
} = {}) => {
  const api = useMemo(
    () => createOpenF1Client({ rateLimitMs }),
    [rateLimitMs],
  );

  const [form, setForm] = useState(defaultSession);
  const [sessionData, setSessionData] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [sessionPhase, setSessionPhase] = useState("—");
  const [loadStatus, setLoadStatus] = useState("Введите параметры и загрузите.");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const [simStart, setSimStart] = useState(null);
  const [simEnd, setSimEnd] = useState(null);
  const [simCurrent, setSimCurrent] = useState(null);
  const [lapsRequestsTotal, setLapsRequestsTotal] = useState(0);
  const [lapsRequestsDone, setLapsRequestsDone] = useState(0);
  const [lapsProgressText, setLapsProgressText] = useState("—");
  const [stateVersion, setStateVersion] = useState(0);

  const driverStatesRef = useRef(new Map());
  const phaseRangesRef = useRef({});
  const phaseOrderRef = useRef([]);
  const sessionKeyRef = useRef(null);
  const sessionResultRef = useRef(new Map());
  const realStartRef = useRef(null);
  const simCurrentRef = useRef(null);
  const segmentRef = useRef("—");
  const prefetchSegmentRef = useRef(null);
  const prefetchInFlightRef = useRef(false);
  const eventsRef = useRef([]);
  const eventCursorRef = useRef(0);
  const eventKeysRef = useRef(new Set());
  const eventsDirtyRef = useRef(false);
  const didAutoLoadRef = useRef(false);

  const standings = useMemo(() => {
    const states = Array.from(driverStatesRef.current.values());
    let globalBestS1 = null;
    let globalBestS2 = null;
    let globalBestS3 = null;
    states.forEach((state) => {
      if (Number.isFinite(state.bestS1Ms)) {
        if (globalBestS1 === null || state.bestS1Ms < globalBestS1) {
          globalBestS1 = state.bestS1Ms;
        }
      }
      if (Number.isFinite(state.bestS2Ms)) {
        if (globalBestS2 === null || state.bestS2Ms < globalBestS2) {
          globalBestS2 = state.bestS2Ms;
        }
      }
      if (Number.isFinite(state.bestS3Ms)) {
        if (globalBestS3 === null || state.bestS3Ms < globalBestS3) {
          globalBestS3 = state.bestS3Ms;
        }
      }
    });
    return computeStandings(states, phaseOrderRef.current).map((driver) => ({
      ...driver,
      globalBestS1,
      globalBestS2,
      globalBestS3,
      isGlobalBestS1:
        Number.isFinite(driver.bestS1) &&
        globalBestS1 !== null &&
        driver.bestS1 === globalBestS1,
      isGlobalBestS2:
        Number.isFinite(driver.bestS2) &&
        globalBestS2 !== null &&
        driver.bestS2 === globalBestS2,
      isGlobalBestS3:
        Number.isFinite(driver.bestS3) &&
        globalBestS3 !== null &&
        driver.bestS3 === globalBestS3,
    }));
  }, [drivers, simCurrent, stateVersion]);

  // updatePhaseState moved below prefetchNextSegmentForAll

  const mergeLapData = useCallback((lapsData) => {
    return lapsData
      .filter((lap) => lap.date_start)
      .map((lap) => {
        const startMs = new Date(lap.date_start).getTime();
        return {
          lapNumber: lap.lap_number,
          startMs,
          isPitOutLap: Boolean(lap.is_pit_out_lap),
          timing: buildLapTiming(lap),
          segments: {
            s1: lap.segments_sector_1 ?? [],
            s2: lap.segments_sector_2 ?? [],
            s3: lap.segments_sector_3 ?? [],
          },
        };
      })
      .filter((lap) => Number.isFinite(lap.startMs));
  }, []);

  const applyEvent = useCallback((event) => {
    const state = driverStatesRef.current.get(event.driverNumber);
    if (!state) return;

    if (event.type === "LAP_START") {
      state.activeLapTiming = event.timing;
      state.onTrack = !event.isPitOutLap;
      state.pitOut = event.isPitOutLap;
      state.pitLane = false;
      return;
    }

    if (event.type === "LAP_END") {
      state.activeLapTiming = null;
      state.onTrack = false;
      state.pitOut = false;
      state.pitLane = true;
      state.lastCompletedLapNumber = event.lapNumber;

      if (
        !state.segmentStartMs ||
        event.timing.startMs >= state.segmentStartMs
      ) {
        const isTimedLap =
          !event.isPitOutLap &&
          event.timing.hasLapDuration &&
          event.timing.sectorSumEnd;
        if (isTimedLap) {
          state.lastLapMs = event.timing.lapDurationMs;
          state.lastS1Ms = event.timing.sector1Ms;
          state.lastS2Ms = event.timing.sector2Ms;
          state.lastS3Ms = event.timing.sector3Ms;
          state.lastSegments = [
            ...event.timing.segments.s1,
            ...event.timing.segments.s2,
            ...event.timing.segments.s3,
          ];
          if (state.bestLapMs === null || event.timing.lapDurationMs < state.bestLapMs) {
            state.bestLapMs = event.timing.lapDurationMs;
            state.bestLapAtMs = event.time;
            state.bestLapNumber = event.lapNumber;
            state.bestS1Ms = event.timing.sector1Ms;
            state.bestS2Ms = event.timing.sector2Ms;
            state.bestS3Ms = event.timing.sector3Ms;
            let globalBest = null;
            driverStatesRef.current.forEach((otherState) => {
              if (otherState.bestLapMs === null) return;
              if (globalBest === null || otherState.bestLapMs < globalBest) {
                globalBest = otherState.bestLapMs;
              }
            });
            state.bestLapHighlightUntil =
              globalBest !== null && state.bestLapMs === globalBest
                ? event.time + 5000
                : null;
          }
        }
      }
    }
  }, []);

  const pushEvent = useCallback((event) => {
    const key = `${event.type}-${event.driverNumber}-${event.lapNumber ?? ""}`;
    if (eventKeysRef.current.has(key)) return;
    eventKeysRef.current.add(key);

    const currentTime = simCurrentRef.current;
    if (Number.isFinite(currentTime) && event.time <= currentTime) {
      eventsDirtyRef.current = true;
    }
    eventsRef.current.push(event);
    eventsRef.current.sort((a, b) => a.time - b.time);
  }, []);

  const enqueueLapEvents = useCallback(
    (driverNumber, lap) => {
      const timing = lap.timing;
      if (!timing) return;
      pushEvent({
        type: "LAP_START",
        driverNumber,
        lapNumber: lap.lapNumber,
        time: timing.startMs,
        timing,
        isPitOutLap: lap.isPitOutLap,
      });
      const lapEnd =
        timing.sectorSumEnd ??
        timing.lastMiniEnd ??
        timing.sector3End ??
        timing.endMs ??
        (timing.hasLapDuration
          ? timing.startMs + timing.lapDurationMs
          : null);
      if (lapEnd) {
        pushEvent({
          type: "LAP_END",
          driverNumber,
          lapNumber: lap.lapNumber,
          time: lapEnd,
          timing,
          isPitOutLap: lap.isPitOutLap,
        });
      }
    },
    [pushEvent],
  );

  const loadMoreLapsForDriver = useCallback(
    async (driverNumber, startLap, endLap) => {
      const sessionKey = sessionKeyRef.current;
      if (!sessionKey || startLap > endLap) return;
      try {
        const lapsData = await api.getLapsForDriver(
          sessionKey,
          driverNumber,
          startLap,
          endLap,
        );
        const state = driverStatesRef.current.get(driverNumber);
        if (!state) return;
        const newLaps = mergeLapData(lapsData).sort(
          (a, b) => a.startMs - b.startMs,
        );
        const existingNumbers = new Set(state.laps.map((lap) => lap.lapNumber));
        const merged = [
          ...state.laps,
          ...newLaps.filter((lap) => !existingNumbers.has(lap.lapNumber)),
        ].sort((a, b) => a.startMs - b.startMs);

        state.laps = merged;
        state.nextBatchStart = endLap + 1;
        if (state.maxLaps && state.nextBatchStart > state.maxLaps) {
          state.nextBatchStart = null;
        }

        newLaps.forEach((lap) => enqueueLapEvents(driverNumber, lap));
      } catch (error) {
        // Ignore, will retry on next trigger
      } finally {
        const state = driverStatesRef.current.get(driverNumber);
        if (state) {
          state.loadingMore = false;
        }
        setStateVersion((prev) => prev + 1);
      }
    },
    [api, mergeLapData, enqueueLapEvents],
  );

  const prefetchNextSegmentForAll = useCallback(
    async (segment) => {
      if (prefetchInFlightRef.current) return;
      if (prefetchSegmentRef.current === segment) return;
      prefetchSegmentRef.current = segment;
      prefetchInFlightRef.current = true;
      try {
        const states = Array.from(driverStatesRef.current.values());
        for (const state of states) {
          if (!state.nextBatchStart || state.loadingMore) continue;
          const startLap = state.nextBatchStart;
          if (state.maxLaps && startLap > state.maxLaps) {
            state.nextBatchStart = null;
            continue;
          }
          const endLap = Math.min(
            state.maxLaps ?? startLap + 2,
            startLap + 2,
          );
          state.loadingMore = true;
          await loadMoreLapsForDriver(state.driver.number, startLap, endLap);
        }
      } finally {
        prefetchInFlightRef.current = false;
      }
    },
    [loadMoreLapsForDriver],
  );

  const updatePhaseState = useCallback(
    (phase) => {
      if (phase === "—" || phase === segmentRef.current) return;
      segmentRef.current = phase;
      const currentStates = Array.from(driverStatesRef.current.values());
      phaseOrderRef.current = computeStandings(
        currentStates,
        phaseOrderRef.current,
      ).map((driver) => driver.number);
      const segmentIndex = Number(phase.replace("Q", "")) - 1;
      driverStatesRef.current.forEach((state) => {
        const durations = sessionResultRef.current.get(state.driver.number);
        const hasSegmentTime =
          Number.isFinite(segmentIndex) &&
          Array.isArray(durations) &&
          durations[segmentIndex] !== null &&
          durations[segmentIndex] !== undefined;
        state.isEliminated = !hasSegmentTime;
        if (!hasSegmentTime) {
          state.onTrack = false;
          state.pitOut = false;
          state.pitLane = false;
          state.activeLapTiming = null;
          return;
        }
        const segmentStart = phaseRangesRef.current?.[phase]?.start ?? null;
        state.segmentStartMs = segmentStart;
        state.bestLapMs = null;
        state.bestLapAtMs = null;
        state.bestLapNumber = null;
        state.bestLapHighlightUntil = null;
        state.bestS1Ms = null;
        state.bestS2Ms = null;
        state.bestS3Ms = null;
        state.lastLapMs = null;
        state.lastS1Ms = null;
        state.lastS2Ms = null;
        state.lastS3Ms = null;
        state.lastSegments = null;
        state.lastCompletedLapNumber = null;
        state.activeLapTiming = null;
        state.onTrack = false;
        state.pitOut = false;
        state.pitLane = false;
        if (segmentStart) {
          let lastIndex = -1;
          for (let i = 0; i < state.laps.length; i += 1) {
            const lapTiming = state.laps[i]?.timing;
            if (!lapTiming) continue;
            const lapEnd =
              lapTiming.lastMiniEnd ?? lapTiming.endMs ?? lapTiming.startMs;
            if (lapEnd && lapEnd < segmentStart) {
              lastIndex = i;
              continue;
            }
            break;
          }
          state.lastProcessedLapIndex = lastIndex;
        } else {
          state.lastProcessedLapIndex = -1;
        }
      });
      setSessionPhase(phase);
      void prefetchNextSegmentForAll(phase);
    },
    [prefetchNextSegmentForAll],
  );

  const resetRuntimeState = useCallback(() => {
    driverStatesRef.current.forEach((state) => {
      state.cursorIndex = -1;
      state.lastProcessedLapIndex = -1;
      state.segmentStartMs = null;
      state.activeLapTiming = null;
      state.bestLapMs = null;
      state.bestLapAtMs = null;
      state.bestLapNumber = null;
      state.bestLapHighlightUntil = null;
      state.bestS1Ms = null;
      state.bestS2Ms = null;
      state.bestS3Ms = null;
      state.lastLapMs = null;
      state.lastS1Ms = null;
      state.lastS2Ms = null;
      state.lastS3Ms = null;
      state.lastSegments = null;
      state.lastCompletedLapNumber = null;
      state.onTrack = false;
      state.pitOut = false;
      state.pitLane = true;
      state.isEliminated = false;
    });
    segmentRef.current = "—";
  }, []);

  const updatePlayback = useCallback(() => {
    if (!isPlaying || !simStart || !simEnd) return;
    const now = performance.now();
    const elapsed = (now - realStartRef.current) * playbackSpeed;
    const targetTime = Math.min(simStart + elapsed, simEnd);

    const processAtTime = (currentTime) => {
      const phase = getPhaseAt(currentTime, phaseRangesRef.current);
      updatePhaseState(phase);

      const events = eventsRef.current;
      while (
        eventCursorRef.current < events.length &&
        events[eventCursorRef.current].time <= currentTime
      ) {
        applyEvent(events[eventCursorRef.current]);
        eventCursorRef.current += 1;
      }

      const states = driverStatesRef.current;
      states.forEach((state) => {
        if (state.isEliminated) {
          state.onTrack = false;
          state.pitOut = false;
          state.pitLane = false;
          state.activeLapTiming = null;
          return;
        }

        if (state.nextBatchStart && !state.loadingMore) {
          const triggerLapNumber = Math.max(1, state.nextBatchStart - 3);
          const activeTiming = state.activeLapTiming;
          let reachedTriggerPoint = false;
          if (activeTiming && activeTiming.lapNumber >= triggerLapNumber) {
            const triggerEnd =
              activeTiming.sector2End ??
              activeTiming.lastMiniEnd ??
              activeTiming.endMs ??
              (activeTiming.hasLapDuration
                ? activeTiming.startMs + activeTiming.lapDurationMs
                : null);
            reachedTriggerPoint = triggerEnd
              ? currentTime >= triggerEnd
              : false;
          }
          const completedLapNumber = state.lastCompletedLapNumber ?? 0;
          if (reachedTriggerPoint || completedLapNumber >= triggerLapNumber) {
            const startLap = state.nextBatchStart;
            const endLap = Math.min(
              state.maxLaps ?? startLap + 2,
              startLap + 2,
            );
            if (state.maxLaps && startLap > state.maxLaps) {
              state.nextBatchStart = null;
            } else {
              state.loadingMore = true;
              loadMoreLapsForDriver(state.driver.number, startLap, endLap);
            }
          }
        }
      });
    };

    let currentTime = simCurrentRef.current ?? simStart;
    const maxIterations = 200;
    const delta = targetTime - currentTime;
    if (delta <= 0) {
      setSimCurrent(currentTime);
      return;
    }
    const stepMs =
      delta > maxIterations * 80 ? delta / maxIterations : 80;
    let iterations = 0;

    while (currentTime < targetTime && iterations < maxIterations) {
      if (eventsDirtyRef.current) {
        resetRuntimeState();
        eventCursorRef.current = 0;
        eventsDirtyRef.current = false;
      }
      currentTime = Math.min(currentTime + stepMs, targetTime);
      processAtTime(currentTime);
      iterations += 1;
    }

    simCurrentRef.current = currentTime;
    setSimCurrent(currentTime);

    if (targetTime >= simEnd) {
      setIsPlaying(false);
    }
  }, [
    isPlaying,
    playbackSpeed,
    simEnd,
    simStart,
    updatePhaseState,
    applyEvent,
    loadMoreLapsForDriver,
    resetRuntimeState,
  ]);

  useEffect(() => {
    let rafId;
    const tick = () => {
      updatePlayback();
      rafId = requestAnimationFrame(tick);
    };
    if (isPlaying) {
      rafId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, updatePlayback]);

  const startPlayback = useCallback(() => {
    if (!simStart) return;
    setIsPlaying(true);
    if (simCurrentRef.current === null) {
      simCurrentRef.current = simCurrent ?? simStart;
    }
    realStartRef.current =
      performance.now() - (simCurrent - simStart) / playbackSpeed;
  }, [playbackSpeed, simCurrent, simStart]);

  const resetPlayback = useCallback(() => {
    setIsPlaying(false);
    if (simStart) {
      setSimCurrent(simStart);
      simCurrentRef.current = simStart;
    }
    resetRuntimeState();
    eventCursorRef.current = 0;
    eventsDirtyRef.current = false;
  }, [resetRuntimeState, simStart]);

  const loadSessionData = useCallback(
    async (overrides = {}) => {
      try {
        const nextForm = { ...form, ...overrides };
        setForm(nextForm);
        setLoadStatus("Загрузка сессии...");
        setIsPlaying(false);
        setSessionData(null);
        setDrivers([]);
        setSimStart(null);
        setSimEnd(null);
        setSimCurrent(null);
        setSessionPhase("—");
        setLapsRequestsDone(0);
        setLapsRequestsTotal(0);
        setLapsProgressText("—");
        driverStatesRef.current = new Map();
        eventsRef.current = [];
        eventCursorRef.current = 0;
        eventKeysRef.current = new Set();
        eventsDirtyRef.current = false;

        const sessions = await api.getSessionsByQuery(nextForm);
        if (!sessions.length) {
          throw new Error("Сессия не найдена.");
        }
        const sessionKey = sessions[0].session_key;
        sessionKeyRef.current = sessionKey;

        setLoadStatus("Загрузка гонщиков...");
        const driversData = await api.getDrivers(sessionKey);
        const normalizedDrivers = driversData
          .map(normalizeDriver)
          .sort((a, b) => a.number - b.number);
        setDrivers(normalizedDrivers);
        if (!normalizedDrivers.length) {
          throw new Error("Нет данных по гонщикам для этой сессии.");
        }
        const initialStates = new Map();
        normalizedDrivers.forEach((driver) => {
          initialStates.set(driver.number, {
            driver,
            laps: [],
            cursorIndex: -1,
            lastProcessedLapIndex: -1,
            segmentStartMs: null,
            activeLapTiming: null,
            bestLapMs: null,
            bestLapAtMs: null,
            bestLapNumber: null,
            bestLapHighlightUntil: null,
            bestS1Ms: null,
            bestS2Ms: null,
            bestS3Ms: null,
            lastLapMs: null,
            lastS1Ms: null,
            lastS2Ms: null,
            lastS3Ms: null,
            lastSegments: null,
            lastCompletedLapNumber: null,
            onTrack: false,
            pitOut: false,
            pitLane: true,
            isEliminated: false,
          });
        });
        driverStatesRef.current = initialStates;
        phaseOrderRef.current = normalizedDrivers.map((driver) => driver.number);
        setStateVersion((prev) => prev + 1);

        setLoadStatus("Загрузка данных сессии...");
        const sessionInfo = await api.getSessionByKey(sessionKey);
        const session = sessionInfo[0] ?? sessions[0];
        setSessionData(session);
        const startMs = new Date(session.date_start).getTime();
        const endMs = new Date(session.date_end).getTime();
        setSimStart(startMs);
        setSimEnd(endMs);
        setSimCurrent(startMs);
        simCurrentRef.current = startMs;
        segmentRef.current = "—";
        prefetchSegmentRef.current = null;

        setLoadStatus("Загрузка результатов сессии...");
        const sessionResults = await api.getSessionResult(sessionKey);
        const resultsMap = new Map();
        const durationsMap = new Map();
        sessionResults.forEach((result) => {
          if (result.driver_number && result.number_of_laps !== null) {
            resultsMap.set(result.driver_number, result.number_of_laps);
          }
          if (result.driver_number) {
            durationsMap.set(result.driver_number, result.duration ?? []);
          }
        });
        sessionResultRef.current = durationsMap;

        setLoadStatus("Загрузка кругов (1-3)...");
        setLapsRequestsTotal(normalizedDrivers.length);
        setLapsRequestsDone(0);
        setLapsProgressText("0%");
        const states = new Map();
        for (let i = 0; i < normalizedDrivers.length; i += 1) {
          const driver = normalizedDrivers[i];
          const maxLaps = resultsMap.get(driver.number) ?? null;
          const initialEndLap =
            maxLaps !== null ? Math.min(3, maxLaps) : 3;
          const lapsData = await api.getLapsForDriver(
            sessionKey,
            driver.number,
            1,
            initialEndLap,
          );
          const laps = mergeLapData(lapsData).sort((a, b) => a.startMs - b.startMs);

          states.set(driver.number, {
            driver,
            laps,
            cursorIndex: -1,
            lastProcessedLapIndex: -1,
            segmentStartMs: null,
            activeLapTiming: null,
            bestLapMs: null,
            bestLapAtMs: null,
            bestLapNumber: null,
            bestLapHighlightUntil: null,
            bestS1Ms: null,
            bestS2Ms: null,
            bestS3Ms: null,
            lastLapMs: null,
            lastS1Ms: null,
            lastS2Ms: null,
            lastS3Ms: null,
            lastSegments: null,
            lastCompletedLapNumber: null,
            onTrack: false,
            pitOut: false,
            pitLane: true,
            isEliminated: false,
            maxLaps,
            nextBatchStart:
              maxLaps !== null && initialEndLap >= maxLaps
                ? null
                : initialEndLap + 1,
            loadingMore: false,
          });
          laps.forEach((lap) => enqueueLapEvents(driver.number, lap));

          const done = i + 1;
          setLapsRequestsDone(done);
          setLapsProgressText(
            `${Math.round((done / Math.max(1, normalizedDrivers.length)) * 100)}%`,
          );
        }
        driverStatesRef.current = states;
        phaseOrderRef.current = normalizedDrivers.map((driver) => driver.number);
        setStateVersion((prev) => prev + 1);

        setLoadStatus("Загрузка событий...");
        const rc = await api.getRaceControl(sessionKey);
        phaseRangesRef.current = buildPhaseRanges(rc, startMs, endMs);

        setLoadStatus("Готово.");
      } catch (error) {
        setLoadStatus(error.message);
      }
    },
    [api, form],
  );

  useEffect(() => {
    if (didAutoLoadRef.current) return;
    didAutoLoadRef.current = true;
    loadSessionData(defaultSession).catch((error) => {
      setLoadStatus(error.message);
    });
  }, [defaultSession, loadSessionData]);

  return {
    form,
    setForm,
    sessionData,
    drivers,
    sessionPhase,
    loadStatus,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    simStart,
    simEnd,
    simCurrent,
    progress:
      simStart && simEnd && simCurrent
        ? Math.min(100, ((simCurrent - simStart) / (simEnd - simStart)) * 100)
        : 0,
    lapsRequestsTotal,
    lapsRequestsDone,
    lapsProgressText,
    standings,
    startPlayback,
    resetPlayback,
    loadSessionData,
    getSegmentClass: (value) =>
      SEGMENT_CLASSES[value] ?? "segment-unknown",
  };
};
