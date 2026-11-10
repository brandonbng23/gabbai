import { useEffect, useRef, useState } from 'react';

const settingsSections = [
    { id: 'shul-info-heading', label: 'Shul Info' },
    { id: 'schedule-heading', label: 'Schedule' },
    { id: 'notification-settings-heading', label: 'Communication' },
];
const managementSections = [
    { id: 'adjustments-heading', label: 'Reading Adjustments' },
    { id: 'shul-events-heading', label: 'Events' },
    { id: 'permissions-heading', label: 'Users & Permissions' },
];

// Experimental section navigation; removing this component restores the original page.
export default function ShulSettingsNavigation({ view }: { view: 'management' | 'settings' }) {
    const sections = view === 'management' ? managementSections : settingsSections;
    const navRef = useRef<HTMLElement>(null);
    const [activeSection, setActiveSection] = useState(sections[0].id);
    const [collapseMode, setCollapseMode] = useState<'expanded' | 'collapsed' | 'top-expanded'>('expanded');
    const wasAtTop = useRef(true);
    const clickedSection = useRef<string | null>(null);
    const collapsed = collapseMode === 'collapsed';
    const activeSectionLabel = sections.find(section => section.id === activeSection)?.label ?? sections[0].label;

    useEffect(() => {
        let frame = 0;
        let scrollSettled: ReturnType<typeof setTimeout> | undefined;
        function update() {
            frame = 0;
            const nav = navRef.current;
            if (!nav) return;
            const atTop = window.scrollY <= 8;
            const returnedToTop = atTop && !wasAtTop.current;
            wasAtTop.current = atTop;
            setCollapseMode(mode => {
                if (mode === 'collapsed' && returnedToTop) return 'top-expanded';
                if (mode === 'top-expanded' && !atTop) return 'collapsed';
                return mode;
            });
            // Share the actual bar height with anchor scrolling. A selected heading
            // lands 12px below the bar, within the 16px active-section threshold.
            const stickyTop = Number.parseFloat(getComputedStyle(nav).top) || 0;
            nav.parentElement?.style.setProperty('--shul-section-offset', `${stickyTop + nav.offsetHeight + 12}px`);
            const boundary = nav.getBoundingClientRect().bottom + 16;
            let active = sections[0].id;
            for (const section of sections) {
                const heading = document.getElementById(section.id);
                if (heading && heading.getBoundingClientRect().top <= boundary) active = section.id;
            }
            setActiveSection(clickedSection.current ?? active);
        }
        function scheduleUpdate() {
            if (!frame) frame = requestAnimationFrame(update);
            clearTimeout(scrollSettled);
            if (clickedSection.current) scrollSettled = setTimeout(resumeScrollTracking, 160);
        }
        function resumeScrollTracking() {
            clickedSection.current = null;
            clearTimeout(scrollSettled);
            if (!frame) frame = requestAnimationFrame(update);
        }
        function onKeyDown(event: KeyboardEvent) {
            if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) resumeScrollTracking();
        }
        // Capture scrolls from the app's scrolling container as well as the window.
        document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
        window.addEventListener('resize', scheduleUpdate);
        document.addEventListener('wheel', resumeScrollTracking, { passive: true });
        document.addEventListener('touchstart', resumeScrollTracking, { passive: true });
        document.addEventListener('keydown', onKeyDown);
        const observer = new ResizeObserver(scheduleUpdate);
        const content = navRef.current?.parentElement;
        if (content) observer.observe(content);
        if (navRef.current) observer.observe(navRef.current);
        update();
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(scrollSettled);
            observer.disconnect();
            content?.style.removeProperty('--shul-section-offset');
            document.removeEventListener('scroll', scheduleUpdate, true);
            window.removeEventListener('resize', scheduleUpdate);
            document.removeEventListener('wheel', resumeScrollTracking);
            document.removeEventListener('touchstart', resumeScrollTracking);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [sections]);

    return <nav ref={navRef} className={`shul-settings-navigation${collapsed ? ' shul-settings-navigation-collapsed' : ''}`} aria-label="Manage shul sections">
        <button type="button" className="shul-settings-navigation-toggle"
            aria-label={collapsed ? `Expand section navigation: ${activeSectionLabel}` : 'Collapse section navigation'}
            title={collapsed ? 'Expand section navigation' : 'Collapse section navigation'}
            aria-expanded={!collapsed} aria-controls="shul-settings-navigation-links"
            onClick={() => setCollapseMode(collapsed ? 'expanded' : 'collapsed')}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false">
                {/* Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc. */}
                <path fill="currentColor" d={collapsed
                    ? 'M96 160C96 142.3 110.3 128 128 128L512 128C529.7 128 544 142.3 544 160C544 177.7 529.7 192 512 192L128 192C110.3 192 96 177.7 96 160zM96 320C96 302.3 110.3 288 128 288L512 288C529.7 288 544 302.3 544 320C544 337.7 529.7 352 512 352L128 352C110.3 352 96 337.7 96 320zM544 480C544 497.7 529.7 512 512 512L128 512C110.3 512 96 497.7 96 480C96 462.3 110.3 448 128 448L512 448C529.7 448 544 462.3 544 480z'
                    : 'M169.4 297.4C156.9 309.9 156.9 330.2 169.4 342.7L361.4 534.7C373.9 547.2 394.2 547.2 406.7 534.7C419.2 522.2 419.2 501.9 406.7 489.4L237.3 320L406.6 150.6C419.1 138.1 419.1 117.8 406.6 105.3C394.1 92.8 373.8 92.8 361.3 105.3L169.3 297.3z'} />
            </svg>
            {collapsed && <span className="shul-settings-navigation-current">{activeSectionLabel}</span>}
        </button>
        <div id="shul-settings-navigation-links" className="shul-settings-navigation-links" inert={collapsed} aria-hidden={collapsed}>
            {sections.map(section => <a key={section.id} href={`#${section.id}`}
                aria-current={activeSection === section.id ? 'location' : undefined}
                onClick={event => {
                    event.preventDefault();
                    const heading = document.getElementById(section.id);
                    if (!heading) return;
                    clickedSection.current = section.id;
                    setActiveSection(section.id);
                    heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
                    heading.tabIndex = -1;
                    heading.focus({ preventScroll: true });
                }}>{section.label}</a>)}
        </div>
    </nav>;
}
