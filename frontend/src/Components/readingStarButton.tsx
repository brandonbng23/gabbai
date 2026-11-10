import { useRef, useState } from 'react';

// Font Awesome Free v7.3.1 by @fontawesome — https://fontawesome.com/license/free
// Copyright 2026 Fonticons, Inc.
const outline = 'M320.1 32C329.1 32 337.4 37.1 341.5 45.1L415 189.3L574.9 214.7C583.8 216.1 591.2 222.4 594 231C596.8 239.6 594.5 249 588.2 255.4L473.7 369.9L499 529.8C500.4 538.7 496.7 547.7 489.4 553C482.1 558.3 472.4 559.1 464.4 555L320.1 481.6L175.8 555C167.8 559.1 158.1 558.3 150.8 553C143.5 547.7 139.8 538.8 141.2 529.8L166.4 369.9L52 255.4C45.6 249 43.4 239.6 46.2 231C49 222.4 56.3 216.1 65.3 214.7L225.2 189.3L298.8 45.1C302.9 37.1 311.2 32 320.2 32zM320.1 108.8L262.3 222C258.8 228.8 252.3 233.6 244.7 234.8L119.2 254.8L209 344.7C214.4 350.1 216.9 357.8 215.7 365.4L195.9 490.9L309.2 433.3C316 429.8 324.1 429.8 331 433.3L444.3 490.9L424.5 365.4C423.3 357.8 425.8 350.1 431.2 344.7L521 254.8L395.5 234.8C387.9 233.6 381.4 228.8 377.9 222L320.1 108.8z';
const filled = 'M341.5 45.1C337.4 37.1 329.1 32 320.1 32C311.1 32 302.8 37.1 298.7 45.1L225.1 189.3L65.2 214.7C56.3 216.1 48.9 222.4 46.1 231C43.3 239.6 45.6 249 51.9 255.4L166.3 369.9L141.1 529.8C139.7 538.7 143.4 547.7 150.7 553C158 558.3 167.6 559.1 175.7 555L320.1 481.6L464.4 555C472.4 559.1 482.1 558.3 489.4 553C496.7 547.7 500.4 538.8 499 529.8L473.7 369.9L588.1 255.4C594.5 249 596.7 239.6 593.9 231C591.1 222.4 583.8 216.1 574.8 214.7L415 189.3L341.5 45.1z';

export function ReadingStarButton({ starred, disabled = false, label, onChange }: {
    starred: boolean;
    disabled?: boolean;
    label: string;
    onChange: (starred: boolean) => Promise<void>;
}) {
    const busy = useRef(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    async function toggle() {
        if (busy.current || disabled) return;
        busy.current = true;
        setSaving(true);
        setError('');
        try { await onChange(!starred); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save. Please try again.'); }
        finally { busy.current = false; setSaving(false); }
    }
    return <div className="reading-star-control">
        <button type="button" className="reading-star-button" aria-pressed={starred}
            aria-label={`${starred ? 'Unstar' : 'Star'} reading: ${label}`}
            title={starred ? 'Remove from Starred' : 'Star this reading — only visible to you'}
            disabled={disabled || saving} aria-busy={saving} onClick={() => void toggle()}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                <path d={starred ? filled : outline} />
            </svg>
        </button>
        {error && <p className="reading-star-error" role="alert">{error}</p>}
    </div>;
}
