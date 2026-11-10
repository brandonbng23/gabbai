import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function BackToTopButton({ focusTarget }: { focusTarget: RefObject<HTMLElement | null> }) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const update = () => setVisible(window.scrollY > 400);
        update();
        window.addEventListener('scroll', update, { passive: true });
        return () => window.removeEventListener('scroll', update);
    }, []);
    if (!visible) return null;
    return <button type="button" className="back-to-top" onClick={() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        focusTarget.current?.focus({ preventScroll: true });
    }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
            <path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z" />
        </svg>
        Back to top
    </button>;
}
