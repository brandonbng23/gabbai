function Aliyah({hdate, date, parsha, a, psukim, reader}) {
    let aliyahNum = "";

    if (a < 8) {
        aliyahNum = "Aliyah " + a;
    } else if (a == 8) {
        aliyahNum = "Maftir";
    } else if (a == 9) {
        aliyahNum == "Haftarah";
    }

    return (
        <div className="aliyah-card">
            <span>
                <h5>{aliyahNum}</h5>
                <h5>{psukim}</h5>
                reader ? <h5>{reader}</h5> : <button>Register</button>
            </span>
        </div>
    )
}

export default Aliyah;