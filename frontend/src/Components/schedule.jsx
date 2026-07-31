import Welcome from "./welcome"
import { Settings } from "../../../core/settings.mjs"
import { Schedule } from "../../../core/schedule.mjs"
import { Shul } from "../../../core/shul.mjs"

function ScheduleC() {
    let settings = new Settings(5787);
    settings.setTriennial(false);    
    let schedule = new Schedule(settings, settings.getHebYear());

    let readings = [];
    let counter = 0;

    let current = schedule.head;
    while(current && counter < 2100) {
        readings.push(current);
        current = current.next;
        counter++;
    }
     
    return (
        <div className="content">
            <Welcome name="Brandon"/>
            {readings.map(r => (
                <Parsha key={r.name} hdate={r.hebDate} date={r.gregDate} parsha={r.name} psukim={r.readers.getPsukim(a)}></Parsha>
            ))}
        </div>
    )
}

export default ScheduleC;