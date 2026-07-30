function SidebarItem(text, icon, link, active) {
    return (
        <div className="sidebar-item mx-2">
            <a className={`icon-link sidebar-link ${active ? "active" : ""}`} href={link}>
                {icon}
                <span className="sidebar-text">Schedule</span>
            </a>
        </div>
    );
}

export default SidebarItem;