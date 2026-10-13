import React from "react";

function HoverTip({message, style}: {message: string; style?: React.CSSProperties}): React.JSX.Element {
    return (
        <div className="hover-tip" style={style}>
            {message}
        </div>
    )
}

export default HoverTip;
