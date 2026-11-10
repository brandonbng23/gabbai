import { ProfilePicture } from '../Components/profilePicture.tsx';
import type { Shul } from '../api.js';
import { formatTorahServiceTime } from '../torahServiceTime.ts';
import { EventCard } from '../Components/eventCard.tsx';
import type { ShulEvent } from '../../../interfaces/shulEvent.mts';
import { localToday } from '../scheduleHighlights.ts';

function publicLink(value: string): string | undefined {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
}

export default function MyShul({ shul, events, eventsLoading, eventsError }: { shul: Shul; events: ShulEvent[]; eventsLoading: boolean; eventsError: string }): React.JSX.Element {
    const settings = shul.settings;
    const website = publicLink(shul.websiteUrl);
    const donation = publicLink(shul.donationUrl);
    return (
        <main className="my-shul-page">
            <header className="my-shul-header">
                <div className="my-shul-identity">
                    <ProfilePicture src={shul.pictureUrl} name={shul.name} square />
                    <div>
                        <h1>{shul.name}</h1>
                        <span className="my-shul-code">Shul code <strong>{shul.code}</strong></span>
                    </div>
                </div>
                <a className="my-shul-schedule-link" href={`/schedule?${new URLSearchParams({ shul: shul.id })}`}>← View reading schedule</a>
            </header>
            <section className="my-shul-events" aria-labelledby="my-shul-events-heading">
                <h2 id="my-shul-events-heading">Upcoming events</h2>
                {eventsLoading ? <div className="event-feedback" role="status">Loading events…</div>
                    : eventsError ? <div className="event-feedback" role="alert">{eventsError}</div>
                    : events.some(event => event.date >= localToday()) ? <div className="my-shul-events-grid">
                        {events.filter(event => event.date >= localToday()).map(event => <EventCard key={event.id} event={event} />)}
                    </div> : <div className="event-feedback">No upcoming events have been featured yet.</div>}
            </section>
            <div className="my-shul-sections">
              <section className="my-shul-card" aria-labelledby="shul-contact-heading">
                <h2 id="shul-contact-heading">Shul information</h2>
                <dl>
                {shul.torahServiceTime && <div><dt>Torah Service Time</dt><dd>{formatTorahServiceTime(shul.torahServiceDay, shul.torahServiceTime)}</dd></div>}
                {shul.address && <div><dt>Address</dt><dd>{shul.address}</dd></div>}
                {shul.phone && <div><dt>Phone</dt><dd><a href={`tel:${shul.phone}`}>{shul.phone}</a></dd></div>}
                {shul.email && <div><dt>Email</dt><dd><a href={`mailto:${shul.email}`}>{shul.email}</a></dd></div>}
                {website && <div><dt>Website</dt><dd><a href={website}>{website}</a></dd></div>}
                {donation && <div><dt>Donations</dt><dd><a href={`/api/shuls/${encodeURIComponent(shul.id)}/donate`}>{donation}</a></dd></div>}
                {!shul.address && !shul.email && !shul.phone && !website && !donation
                    && <div><dt>Contact details</dt><dd className="my-shul-empty">Contact information hasn’t been added yet.</dd></div>}
                </dl>
              </section>
              <section className="my-shul-card" aria-labelledby="shul-schedule-heading">
                <h2 id="shul-schedule-heading">Reading preferences</h2>
                <dl>
                <div><dt>Hebrew Year</dt><dd>{settings.hebYear}</dd></div>
                <div><dt>Calendar</dt><dd>{settings.il ? 'Israel' : 'Diaspora'}</dd></div>
                <div><dt>Aliyot</dt><dd>{settings.a}</dd></div>
                <div><dt>Reading Cycle</dt><dd>{settings.triennial.tri ? 'Triennial' : 'Annual'}</dd></div>
                {settings.triennial.tri && <div><dt>Triennial Year</dt><dd>{['First', 'Second', 'Third'][(settings.hebYear + 1) % 3]}</dd></div>}
                <div><dt>Maftir</dt><dd>{settings.triennial.triMaftir ? 'Triennial' : settings.triennial.tradMaftir ? 'Traditional' : 'Disabled'}</dd></div>
                </dl>
              </section>
            </div>
        </main>
    );
}
