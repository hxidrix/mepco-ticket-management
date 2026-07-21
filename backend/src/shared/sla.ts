export function effectiveSlaTargetHours(
  complaintTargetHours: number,
  priorityCapHours: number | null,
): number {
  return priorityCapHours === null
    ? complaintTargetHours
    : Math.min(complaintTargetHours, priorityCapHours);
}
