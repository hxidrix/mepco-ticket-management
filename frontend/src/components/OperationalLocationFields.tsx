import type { RegistrationOptions } from '../types/auth';

interface OperationalLocationFieldsProps {
  options: RegistrationOptions | null;
  circleId: string;
  divisionId: string;
  subdivisionId: string;
  onChange: (circleId: string, divisionId: string, subdivisionId: string) => void;
  labelPrefix?: string;
  subdivisionClassName?: string;
}

export function OperationalLocationFields({
  options,
  circleId,
  divisionId,
  subdivisionId,
  onChange,
  labelPrefix = 'Work',
  subdivisionClassName,
}: OperationalLocationFieldsProps) {
  const divisions = options?.circles.find((circle) => String(circle.id) === circleId)?.divisions ?? [];
  const subdivisions = divisions.find((division) => String(division.id) === divisionId)?.subdivisions ?? [];
  const prefix = labelPrefix === '' ? '' : `${labelPrefix} `;

  return (
    <>
      <label>
        <span>{prefix}circle</span>
        <select
          name="circleId"
          required
          value={circleId}
          onChange={(event) => {
            const nextCircleId = event.target.value;
            const nextDivisions = options?.circles.find(
              (circle) => String(circle.id) === nextCircleId,
            )?.divisions ?? [];
            const nextDivision = nextDivisions[0];
            onChange(
              nextCircleId,
              String(nextDivision?.id ?? ''),
              String(nextDivision?.subdivisions[0]?.id ?? ''),
            );
          }}
        >
          <option value="">Select a circle</option>
          {options?.circles.map((circle) => (
            <option key={circle.id} value={circle.id}>{circle.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{prefix}division</span>
        <select
          name="divisionId"
          required
          value={divisionId}
          disabled={circleId === ''}
          onChange={(event) => {
            const nextDivisionId = event.target.value;
            const nextSubdivision = divisions.find(
              (division) => String(division.id) === nextDivisionId,
            )?.subdivisions[0];
            onChange(circleId, nextDivisionId, String(nextSubdivision?.id ?? ''));
          }}
        >
          <option value="">Select a division</option>
          {divisions.map((division) => (
            <option key={division.id} value={division.id}>{division.name}</option>
          ))}
        </select>
      </label>
      <label className={subdivisionClassName}>
        <span>{prefix}sub-division</span>
        <select
          name="subdivisionId"
          required
          value={subdivisionId}
          disabled={divisionId === ''}
          onChange={(event) => onChange(circleId, divisionId, event.target.value)}
        >
          <option value="">Select a sub-division</option>
          {subdivisions.map((subdivision) => (
            <option key={subdivision.id} value={subdivision.id}>{subdivision.name}</option>
          ))}
        </select>
      </label>
    </>
  );
}
