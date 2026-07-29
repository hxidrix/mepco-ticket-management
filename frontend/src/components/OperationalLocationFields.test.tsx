import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { LocationCatalogOptions } from '../types/auth';
import { OperationalLocationFields } from './OperationalLocationFields';

const options: LocationCatalogOptions = {
  departments: [],
  circles: [
    {
      id: 1,
      name: 'First Circle',
      divisions: [{
        id: 10,
        name: 'First Division',
        subdivisions: [{ id: 100, name: 'First Sub-division' }],
      }],
    },
    {
      id: 2,
      name: 'Second Circle',
      divisions: [{
        id: 20,
        name: 'Second Division',
        subdivisions: [{ id: 200, name: 'Second Sub-division' }],
      }],
    },
  ],
};

function LocationHarness() {
  const [circleId, setCircleId] = useState('1');
  const [divisionId, setDivisionId] = useState('10');
  const [subdivisionId, setSubdivisionId] = useState('100');
  return (
    <form>
      <OperationalLocationFields
        options={options}
        circleId={circleId}
        divisionId={divisionId}
        subdivisionId={subdivisionId}
        onChange={(nextCircleId, nextDivisionId, nextSubdivisionId) => {
          setCircleId(nextCircleId);
          setDivisionId(nextDivisionId);
          setSubdivisionId(nextSubdivisionId);
        }}
      />
    </form>
  );
}

describe('operational work-location fields', () => {
  it('updates the dependent division and sub-division when the circle changes', () => {
    render(<LocationHarness />);

    fireEvent.change(screen.getByLabelText('Work circle'), { target: { value: '2' } });

    expect(screen.getByLabelText('Work circle')).toHaveValue('2');
    expect(screen.getByLabelText('Work division')).toHaveValue('20');
    expect(screen.getByLabelText('Work sub-division')).toHaveValue('200');
  });
});
