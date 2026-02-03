import { TimingRow } from "./TimingRow.jsx";

export const TimingTable = ({
  standings,
  simCurrent,
  getSegmentClass,
  positionDeltas,
  positionMoves,
}) => (
  <table className="timing">
    <thead>
      <tr>
        <th>POS</th>
        <th>Driver</th>
        <th>Best lap</th>
        <th>GTB</th>
        <th>GTD</th>
        <th>Last lap</th>
        <th>S1</th>
        <th>S2</th>
        <th>S3</th>
        <th>Minisectors</th>
      </tr>
    </thead>
    <tbody>
      {standings.length === 0 ? (
        <tr>
          <td colSpan="10" className="muted">
            Данные еще не загружены.
          </td>
        </tr>
      ) : (
        standings.map((driver, index) => (
          <TimingRow
            key={driver.number}
            driver={driver}
            index={index}
            delta={positionDeltas.get(driver.number) ?? 0}
            moveIndicator={positionMoves.get(driver.number) ?? null}
            simCurrent={simCurrent}
            getSegmentClass={getSegmentClass}
          />
        ))
      )}
    </tbody>
  </table>
);
