export function formatTorahServiceTime(day: string, time: string): string {
    if (!time) return 'Not provided';
    const [hour, minute] = time.split(':').map(Number);
    return `${day} at ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
