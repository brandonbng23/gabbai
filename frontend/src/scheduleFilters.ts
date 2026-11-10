import type { ParshaData } from '../../interfaces/parshaData.mts';
import type { StarredReading } from '../../interfaces/user.mts';

export function hasStarredAliyah(reading: Pick<ParshaData, 'dateString' | 'desc' | 'psukim'>,
    starredReadings: StarredReading[] = [], shulId?: string): boolean {
    if (!shulId) return false;
    return starredReadings.some(star => {
        if (star.shulId !== shulId || star.dateString !== reading.dateString || star.desc !== reading.desc) return false;
        if (!Number.isInteger(star.aliyah) || star.aliyah < 1 || star.aliyah > 9) return false;
        const passage = reading.psukim[star.aliyah - 1];
        return Boolean(passage?.trim() && passage !== 'null');
    });
}
