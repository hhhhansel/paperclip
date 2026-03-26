import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

const navItems = [
  { to: "/", label: "Agents", icon: "◉" },
  { to: "/cael", label: "CAEL", icon: "◆" },
  { to: "/mm", label: "Maison Maintenant", icon: "■" },
  { to: "/ops", label: "Personal Ops", icon: "▸" },
];

export function Sidebar() {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoMark}>⬡</span>
        <span className={styles.logoText}>Command Center</span>
      </div>

      <div className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ""}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.status}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>Backend connected</span>
        </div>
      </div>
    </nav>
  );
}
