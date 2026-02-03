const formatDateTime = (timeMs) => {
  const date = new Date(timeMs);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 19);
};

export const StatusPanel = ({
  sessionData,
  sessionPhase,
  simCurrent,
  progress,
  lapsRequestsTotal,
  lapsRequestsDone,
  lapsProgressText,
  loadStatus,
}) => (
  <>
    <div className="status">
      <div>
        <div className="label">Сессия</div>
        <div>
          {sessionData
            ? `${sessionData.session_name} · ${sessionData.location} · ${sessionData.year}`
            : "—"}
        </div>
      </div>
      <div>
        <div className="label">Сегмент</div>
        <div>{sessionPhase}</div>
      </div>
      <div>
        <div className="label">Время</div>
        <div>{simCurrent ? formatDateTime(simCurrent) : "—"}</div>
      </div>
      <div>
        <div className="label">Прогресс</div>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>

    <div className="status">
      <div>
        <div className="label">Запросы кругов</div>
        <div>
          {lapsRequestsTotal
            ? `${lapsRequestsDone}/${lapsRequestsTotal} · ${lapsProgressText}`
            : "—"}
        </div>
      </div>
      <div>
        <div className="label">Статус загрузки</div>
        <div>{loadStatus}</div>
      </div>
    </div>
  </>
);
