export function readingAnchor(reading: { dateString: string; desc: string }): string {
    return `reading-${reading.dateString}-${encodeURIComponent(reading.desc)}`;
}
