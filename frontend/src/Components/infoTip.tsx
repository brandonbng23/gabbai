import React, { useId } from "react";

function InfoIcon({message, style, iconStyle}: {message: string | React.JSX.Element, style?: React.CSSProperties, iconStyle?: React.CSSProperties}): React.JSX.Element {
    const tooltipId = useId();

    return ( 
        <span className="info-tip">
            <button type="button" className="info-icon" style={iconStyle} aria-label="More information" aria-describedby={tooltipId}>i</button>
            <span id={tooltipId} role="tooltip" className="hover-tip" style={style}>
                {message}
            </span>
        </span>
    )
}

export default InfoIcon;
