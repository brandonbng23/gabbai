import type { SignificantPortion } from '../../../interfaces/significantPortions.mts';
import type { ParshaObj } from './parsha.tsx';
import { upcomingSignificantParshiyot } from '../upcomingSignificantParshiyot.ts';
import { readingAnchor } from '../readingAnchor.ts';
import { ReadingCardArrow } from './readingCardArrow.tsx';

export function UpcomingSignificantParshiyot({ readings, saved, onSelect }: {
    readings: ParshaObj[];
    saved: SignificantPortion[];
    onSelect: (reading: ParshaObj) => void;
}) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const upcoming = upcomingSignificantParshiyot(readings, saved, today);

    return <section className="upcoming-significant-parshiyot" aria-labelledby="upcoming-significant-heading">
        <h2 id="upcoming-significant-heading" className="significant-parshiyot-title">Your upcoming significant parshiyot</h2>
        <ul>{upcoming.map(({ reading, occasions }) => <li key={readingAnchor(reading)}>
            <a href={`#${encodeURIComponent(readingAnchor(reading))}`} onClick={event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onSelect(reading);
            }}>
                <strong className="significant-parsha-name">{reading.desc}<ReadingCardArrow /></strong>
                <span className="significant-parsha-dates">{reading.gregDate} · {reading.hDate}</span>
                {occasions.length > 0 && <span className="significant-parsha-occasion">{occasions.join(' · ')}</span>}
            </a>
        </li>)}
        {upcoming.length < 3 && <li className="significant-parshiyot-prompt">
            <a href="/userSettings#significant-parshiyot-heading">
                <strong className="significant-parshiyot-prompt-title">{upcoming.length ? 'Add more significant parshiyot' : 'Which parshiyot are special to you?'}</strong>
                <span className="significant-parshiyot-prompt-copy">Add your b’nai mitzvah parsha or a meaningful date in My Preferences.</span>
                <span className="significant-parshiyot-prompt-action">Add a parsha →</span>
            </a>
        </li>}
        </ul>
    </section>;
}
