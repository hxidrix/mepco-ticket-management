import { effectiveSlaTargetHours } from './sla.js';

describe('effective SLA target', () => {
  it('keeps the complaint target when low priority has no urgency cap', () => {
    expect(effectiveSlaTargetHours(2160, null)).toBe(2160);
  });

  it('uses a shorter priority cap for urgent work', () => {
    expect(effectiveSlaTargetHours(720, 24)).toBe(24);
    expect(effectiveSlaTargetHours(12, 24)).toBe(12);
  });
});
