const readableDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

// Reading dates are calendar days, not instants. UTC keeps them from shifting
// to the previous day on servers or clients west of Greenwich.
export function formatCommunicationDate(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError('Expected a calendar date in YYYY-MM-DD format.');
    const date = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new RangeError('Invalid calendar date.');
    return readableDate.format(date);
}
