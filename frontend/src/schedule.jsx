export function SchedulePage( {scheduleData} ) {
    return (
        <div className="schedule">
            {scheduleData?.map(event => (
                <ParshaCard key={event.id} event={event}></ParshaCard>
            ))}
        </div>
    )
}

function ParshaCard( {event} ) {
    return (
        <article className="parshaCard">
            <h2>{event.name}</h2>
            <p>{event.occassion}</p>
            <p>{String(event.gregDate)}</p>
        </article>
    )
}