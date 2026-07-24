import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { AppError } from './app-error.js';

interface OperationalLocationRow extends RowDataPacket {
  circleName: string;
  divisionName: string;
  subdivisionName: string;
}

export interface OperationalLocation {
  circleName: string;
  divisionName: string;
  subdivisionName: string;
  label: string;
}

export async function resolveActiveOperationalLocation(
  connection: PoolConnection,
  circleId: number,
  divisionId: number,
  subdivisionId: number,
): Promise<OperationalLocation> {
  const [rows] = await connection.execute<OperationalLocationRow[]>(
    `SELECT circle.name AS circleName,division.name AS divisionName,
       subdivision.name AS subdivisionName
     FROM circles circle
     JOIN divisions division ON division.circle_id=circle.id
     JOIN subdivisions subdivision ON subdivision.division_id=division.id
     WHERE circle.id=? AND division.id=? AND subdivision.id=?
       AND circle.is_active=TRUE AND division.is_active=TRUE AND subdivision.is_active=TRUE`,
    [circleId, divisionId, subdivisionId],
  );
  const location = rows[0];
  if (location === undefined) {
    throw new AppError(
      422,
      'INVALID_WORK_LOCATION',
      'The selected work circle, division and sub-division do not match',
    );
  }
  return {
    circleName: location.circleName,
    divisionName: location.divisionName,
    subdivisionName: location.subdivisionName,
    label: `${location.circleName} / ${location.divisionName} / ${location.subdivisionName}`,
  };
}
