import Aliyah from "./aliyah";

function Parsha({ name, aliyot}) {
    return (
        <div className="parsha-card">
            <h4>{name}</h4>

            {aliyot.map(a => (
                <Aliyah key={a.id} hdate={a.hdate} date={a.date} parsha={name} psukim={a.psukim} reader={reader} />
            ))}
        </div>
    )
}

export default Parsha;