export function readingAnchor(reading: { dateString: string; desc: string }): string {
    return `reading-${reading.dateString}-${encodeURIComponent(reading.desc)}`;
}

export function readingAdjustmentAnchor(reading: { dateString: string; desc: string }): string {
    return `adjustment-${readingAnchor(reading)}`;
}
