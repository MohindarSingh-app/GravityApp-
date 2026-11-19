export function totalJobSavings(rows) {
  const values = (rows || [])
    .map((job) => job.savingsAmount ?? job.savingAmount ?? job.totalSavings)
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(Number)
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
