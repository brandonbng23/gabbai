import React, { useState } from "react";

function InfoTip({message, style}: {message: string; style?: React.CSSProperties}): React.JSX.Element {
    return (
        <div className="hover-tip" style={style}>
            {message}
        </div>
    )
}

function InfoIcon({message, style}: {message: string, style?: React.CSSProperties}): React.JSX.Element {
    const [hovered, setHovered] = useState<boolean>(false);

    return ( 
        <>
            <div className="info-icon" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>i</div>
            <InfoTip message={message} style={style}></InfoTip>
        </>
    )
}

export default InfoIcon;
