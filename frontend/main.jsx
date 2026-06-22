import { Settings } from "../settings.mjs"
import { Schedule } from "../schedule.mjs"
import { Shul } from "../shul.mjs"

const settings = new Settings();
settings.triennial(true);

const shul = new Shul("Test Shul", [], [], null, "testshul.org", "testshul.org/contribute", settings);

const schedule = new Schedule(shul.getSettings(), settings.getHebYear());
shul.setSchedule(schedule);

data = schedule.getScheduleData();

function CreateSchedule( {scheduleData} ) {
    return (
        <div className="schedule">
            {scheduleData.map(event => (
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