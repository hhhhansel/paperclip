import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

const navItems = [
  { to: "/",        label: "Command Center", icon: "◉" },
  { to: "/cael",    label: "CAEL",           icon: "◆" },
  { to: "/mm",      label: "Maison MM",      icon: "■" },
  { to: "/ops",     label: "Personal Ops",   icon: "▸" },
  { to: "/creative",label: "Creative",       icon: "✦", dimmed: true },
];

export function Sidebar() {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoMark}>⬡</span>
        <span className={styles.logoText}>Paperclip</span>
      </div>

      <div className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              [styles.navItem, isActive ? styles.active : "", item.dimmed ? styles.dimmed : ""].join(" ")
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {item.dimmed && <span className={styles.navBadge}>v2</span>}
          </NavLink>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.status}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>System online</span>
        </div>
      </div>
    </nav>
  );
}
