import React, { useState } from "react";
import { Form } from "react-bootstrap";

function Aliyah(): React.JSX.Element {
    const [hdate, setHdate] = useState<string>("");
    const [gregDate, setGregDate] = useState<string>("");
    const [parsha, setParsha] = useState<string>("");
    const [a, setA] = useState<number>(1);
    const [psukim, setPsukim] = useState<string>("");
    const [reader, setReader] = useState<string>("");

    return (
        <div>
            <h3>Aliyah Component</h3>
        </div>
    )
}

export default Aliyah;