type SkeletonVariant = 'schedule' | 'profile' | 'settings' | 'shul' | 'registration' | 'users' | 'readings';

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

export function LoadingSkeleton({ variant = 'schedule', page = false }: { variant?: SkeletonVariant; page?: boolean }) {
    const label = ({ schedule: 'schedule', profile: 'user profile', settings: 'settings', shul: 'shul information',
        registration: 'registration details', users: 'shul users', readings: 'readings' })[variant];
    const settingsPage = page && ['profile', 'settings'].includes(variant);
    return <div className={`skeleton-state skeleton-state-${variant}${settingsPage ? ' shul-admin-page' : ''}${variant === 'shul' ? ' my-shul-page' : ''}`}
        role="status" aria-label={`Loading ${label}`} aria-busy="true">
        <span className="visually-hidden">Loading {label}…</span>
        <div aria-hidden="true">
            {page && variant !== 'shul' && <div className={`skeleton-page-heading${settingsPage ? ' settings-page-header' : ''}`}>
                <Block width="180px" className="skeleton-title" />
            </div>}
            {variant === 'profile' || variant === 'settings' ? <div className="shul-settings">
                <div className="settings-view">
                    <Profile />
                    {variant === 'settings' && <div className="settings-panel skeleton-form">
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
            </div> : variant === 'registration' || variant === 'shul' ? <div className="skeleton-light-cards">
                {variant === 'shul' && <div className="profile-picture-heading"><Block className="skeleton-avatar" width="80px" /><Block width="45%" className="skeleton-title" /></div>}
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
