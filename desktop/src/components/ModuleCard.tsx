import styles from "./ModuleCard.module.css";

interface ModuleCardProps {
  title: string;
  value?: string;
  subtitle?: string;
  status?: "active" | "pending" | "inactive";
  icon?: string;
}

export function ModuleCard({ title, value, subtitle, status = "inactive", icon }: ModuleCardProps) {
  return (
    <div className={`${styles.card} ${styles[status]}`}>
      <div className={styles.header}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
        <span className={`${styles.statusBadge} ${styles[`badge_${status}`]}`}>
          {status}
        </span>
      </div>
      {value && <div className={styles.value}>{value}</div>}
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}
