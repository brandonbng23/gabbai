type SkeletonVariant = 'quick-start' | 'schedule' | 'profile' | 'settings' | 'user-settings' | 'user-readings' | 'shul' | 'registration' | 'users' | 'readings' | 'messages' | 'message-view' | 'message-thread' | 'message-recipients';

function Block({ width = '100%', className = '' }: { width?: string; className?: string }) {
    return <span className={`skeleton-block ${className}`} style={{ width }} />;
}

function Details() {
    return <div className="skeleton-details">
        {Array.from({ length: 6 }, (_, index) => <div className="skeleton-field" key={index}>
            <Block width="35%" className="skeleton-label" /><Block width={index % 2 ? '70%' : '85%'} />
        </div>)}
    </div>;
}

function Profile() {
    return <div className="shul-card skeleton-profile">
        <div className="settings-summary-heading">
            <Block className="skeleton-avatar" width="80px" />
            <div className="skeleton-profile-name"><Block width="35%" className="skeleton-label" /><Block width="70%" className="skeleton-title" /></div>
        </div>
        <Details />
    </div>;
}

function ReadingCardPlaceholder({ showTags = true }: { showTags?: boolean }) {
    return <div className="reading-card">
        <div className="reading-card-header">
            <div className="reading-card-title"><Block width="150px" className="skeleton-title" /></div>
            <div className="schedule-assigned-reader"><Block width="32px" className="skeleton-avatar-small" /></div>
        </div>
        <div className="reading-card-body">
            <Block width="140px" /><Block width="190px" />
        </div>
        {showTags && <div className="reading-card-footer">
            <div className="reading-card-tags"><Block width="85px" className="skeleton-reading-tag" /></div>
            <div className="reading-card-actions" />
        </div>}
    </div>;
}

function ReadingStats() {
    return <div className="shul-card user-stats">
        <div className="settings-summary-heading">
            <div className="skeleton-stats-heading">
                <Block width="64px" className="skeleton-label" />
                <Block width="240px" className="skeleton-title" />
            </div>
        </div>
        <div className="user-reading-stats">
            {Array.from({ length: 4 }, (_, index) => <div className="stat-group" key={index}>
                <Block className="skeleton-stat-number" />
                <div className="skeleton-stat-label">
                    <Block width="75px" /><Block width="60px" />
                </div>
            </div>)}
        </div>
        <div className="activity-readings">
            <h3><Block width="140px" /></h3>
            <div className="reading-list">
                {Array.from({ length: 3 }, (_, index) => <ReadingCardPlaceholder key={index} showTags={false} />)}
            </div>
        </div>
    </div>;
}

function UpcomingReadings() {
    return <div className="quick-start-preview-grid">
        {Array.from({ length: 3 }, (_, index) => <div className="quick-start-preview" key={index}>
            <Block width="100px" className="skeleton-label" />
            <Block width={index % 2 ? '65%' : '80%'} className="skeleton-title" />
            <Block width="120px" className="skeleton-reading-tag" />
            <Block width="90%" className="skeleton-label" />
        </div>)}
    </div>;
}

function ShulInformation() {
    return <>
        <header className="my-shul-header">
            <div className="my-shul-identity">
                <Block width="80px" className="skeleton-avatar skeleton-shul-picture" />
                <div className="skeleton-profile-name"><Block width="260px" className="skeleton-title" /><Block width="130px" /></div>
            </div>
            <Block width="200px" className="skeleton-input" />
        </header>
        <div className="my-shul-sections">
            {Array.from({ length: 2 }, (_, index) => <section className="my-shul-card" key={index}>
                <h2><Block width="180px" /></h2>
                <dl>{Array.from({ length: 5 }, (_, row) => <div key={row}>
                    <dt><Block width="90px" className="skeleton-label" /></dt>
                    <dd><Block width={row % 2 ? '60%' : '80%'} /></dd>
                </div>)}</dl>
            </section>)}
        </div>
    </>;
}

export function LoadingSkeleton({ variant = 'schedule', page = false }: { variant?: SkeletonVariant; page?: boolean }) {
    if (page && variant === 'schedule') return <main className="schedule-page skeleton-state" role="status" aria-label="Loading schedule" aria-busy="true">
        <span className="visually-hidden">Loading schedule…</span>
        <div className="quick-start" aria-hidden="true">
            <div className="welcome-bar skeleton-welcome"><Block width="min(480px, 85%)" className="skeleton-title" /></div>
            <div className="quick-start-search skeleton-quick-start-search"><Block width="240px" className="skeleton-label" /><Block className="skeleton-input" /></div>
            <div className="quick-start-upcoming"><UpcomingReadings /></div>
            <div className="quick-start-reveal"><Block width="140px" className="skeleton-label" /></div>
        </div>
        <div className="schedule-content" aria-hidden="true"><LoadingSkeleton variant="schedule" /></div>
    </main>;
    if (page && variant === 'messages') return <main className="messages-page skeleton-state" role="status" aria-label="Loading messages" aria-busy="true">
        <span className="visually-hidden">Loading messages…</span>
        <header className="inbox-header" aria-hidden="true"><Block width="200px" className="skeleton-title" /><Block width="120px" className="skeleton-input" /></header>
        <div className="inbox" aria-hidden="true">
            <div className="message-list-panel">
                <div className="msg-filters"><Block className="skeleton-input" /></div>
                <div className="message-list"><LoadingSkeleton variant="messages" /></div>
            </div>
            <section className="message-view"><LoadingSkeleton variant="message-view" /></section>
        </div>
    </main>;
    const label = ({ 'quick-start': 'upcoming readings', schedule: 'schedule', profile: 'user profile', settings: 'settings', 'user-settings': 'user settings', 'user-readings': 'user readings', shul: 'shul information',
        registration: 'registration details', users: 'shul users', readings: 'readings', messages: 'messages', 'message-view': 'message', 'message-thread': 'conversation', 'message-recipients': 'recipients' })[variant];
    const settingsPage = page && ['profile', 'settings', 'user-settings', 'user-readings'].includes(variant);
    return <div className={`skeleton-state skeleton-state-${variant}${settingsPage ? ' shul-admin-page' : ''}${variant === 'shul' ? ' my-shul-page' : ''}`}
        role="status" aria-label={`Loading ${label}`} aria-busy="true">
        <span className="visually-hidden">Loading {label}…</span>
        <div aria-hidden="true">
            {page && variant !== 'shul' && <div className={`skeleton-page-heading${settingsPage ? ' settings-page-header' : ''}`}>
                <Block width="180px" className="skeleton-title" />
            </div>}
            {variant === 'shul' ? <ShulInformation /> : variant === 'quick-start' ? <UpcomingReadings /> : variant === 'messages' ? <div className="skeleton-message-list">
                {Array.from({ length: 6 }, (_, index) => <div className="msg-card skeleton-message-card" key={index}>
                    <div className="skeleton-message-sender"><Block width="6.5px" className="skeleton-message-dot" /><Block width="30px" className="skeleton-message-avatar" /><Block width={index % 2 ? '42%' : '58%'} /></div>
                    <div className="skeleton-message-info"><Block width={index % 2 ? '80%' : '65%'} /><Block width="40%" className="skeleton-label" /></div>
                </div>)}
            </div> : variant === 'message-view' ? <div className="skeleton-message-view">
                <div className="skeleton-message-actions"><Block width="100px" className="skeleton-input" /><Block width="65px" className="skeleton-input" /></div>
                <Block width="68%" className="skeleton-title" />
                <div className="skeleton-message-sender"><Block width="32px" className="skeleton-message-avatar" /><div className="skeleton-message-author"><Block width="130px" /><Block width="95px" className="skeleton-label" /></div></div>
                <div className="skeleton-message-lines">{['95%', '100%', '83%', '92%', '58%'].map((width, index) => <Block width={width} key={index} />)}</div>
            </div> : variant === 'message-thread' ? <div className="skeleton-message-thread">
                <div className="skeleton-message-sender"><Block width="35%" /><Block width="20%" className="skeleton-label" /></div>
                <div className="skeleton-message-lines"><Block /><Block width="85%" /><Block width="60%" /></div>
                <Block className="skeleton-reply-editor" />
            </div> : variant === 'message-recipients' ? <div className="skeleton-message-recipients">
                {Array.from({ length: 3 }, (_, index) => <div className="skeleton-message-sender" key={index}><Block width="16px" /><Block width={index % 2 ? '45%' : '65%'} /></div>)}
            </div> : variant === 'user-readings' ? <div className="shul-settings user-readings-page">
                <div className="settings-panel user-readings-panel">
                    <div className="user-readings-toolbar">
                        <div className="user-readings-filters skeleton-reading-filters">{Array.from({ length: 4 }, (_, index) => <Block width="100px" className="skeleton-input" key={index} />)}</div>
                        <div className="user-readings-search skeleton-reading-search"><Block width="170px" className="skeleton-label" /><Block className="skeleton-input" /></div>
                        <Block width="110px" className="skeleton-label" />
                    </div>
                    <h2><Block width="180px" /></h2>
                    <div className="user-readings-list">
                        {Array.from({ length: 4 }, (_, index) => <ReadingCardPlaceholder key={index} />)}
                    </div>
                </div>
            </div> : variant === 'profile' || variant === 'settings' || variant === 'user-settings' ? <div className="shul-settings">
                <div className="settings-view">
                    <Profile />
                    {variant !== 'settings' && <ReadingStats />}
                    {(variant === 'settings' || variant === 'user-settings') && <div className="settings-panel skeleton-form">
                        <Block width="35%" className="skeleton-title" />
                        <Details />
                        <Block width="140px" className="skeleton-input" />
                    </div>}
                </div>
            </div> : variant === 'users' || variant === 'readings' ? <div className="skeleton-list">
                {Array.from({ length: 4 }, (_, index) => <div className="skeleton-list-row" key={index}>
                    {variant === 'users' && <Block className="skeleton-avatar skeleton-avatar-small" width="32px" />}
                    <Block width="30%" /><Block width="25%" /><Block width="15%" />
                </div>)}
            </div> : variant === 'registration' ? <div className="skeleton-light-cards">
                <div className="registration-details"><Block width="35%" className="skeleton-title" /><Details /></div>
                <div className="registration-details"><Details /></div>
            </div> : <div className="schedule">
                <div className="filterBar skeleton-filter"><Block width="35%" className="skeleton-input" /><Block width="25%" className="skeleton-input" /></div>
                <div className="parshiyot">
                    {Array.from({ length: 3 }, (_, index) => <div className="parsha skeleton-reading" key={index}>
                        <Block width="45%" className="skeleton-title" /><Block width="25%" className="skeleton-label" />
                        {Array.from({ length: 4 }, (_, row) => <div className="skeleton-list-row" key={row}><Block width="20%" /><Block width="45%" /><Block width="15%" /></div>)}
                    </div>)}
                </div>
            </div>}
        </div>
    </div>;
}
