export const Controls = ({
  form,
  setForm,
  onLoad,
  onStart,
  onReset,
  playbackSpeed,
  setPlaybackSpeed,
  disabled,
}) => (
  <>
    <div className="controls">
      <div className="field">
        <label htmlFor="countryName">Страна</label>
        <input
          id="countryName"
          type="text"
          value={form.countryName}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, countryName: event.target.value }))
          }
        />
      </div>
      <div className="field">
        <label htmlFor="year">Год</label>
        <input
          id="year"
          type="number"
          min="2018"
          max="2030"
          value={form.year}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, year: event.target.value }))
          }
        />
      </div>
      <div className="field">
        <label htmlFor="sessionName">Сессия</label>
        <input
          id="sessionName"
          type="text"
          value={form.sessionName}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, sessionName: event.target.value }))
          }
        />
      </div>
      <button type="button" onClick={onLoad}>
        Загрузить
      </button>
    </div>

    <div className="controls">
      <button type="button" onClick={onStart} disabled={disabled}>
        Старт
      </button>
      <button type="button" onClick={onReset} disabled={disabled}>
        Сброс
      </button>
      <div className="field">
        <label htmlFor="speed">Скорость</label>
        <select
          id="speed"
          value={playbackSpeed}
          onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          disabled={disabled}
        >
          <option value="1">1x</option>
          <option value="2">2x</option>
          <option value="5">5x</option>
          <option value="10">10x</option>
          <option value="20">20x</option>
        </select>
      </div>
    </div>
  </>
);
