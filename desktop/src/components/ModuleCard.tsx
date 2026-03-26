import { ReactNode } from "react";
import styles from "./ModuleCard.module.css";

interface ModuleCardProps {
  title: string;
  value?: string;
  subtitle?: string;
  status?: "active" | "pending" | "inactive";
  icon?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  children?: ReactNode;
}

export function ModuleCard({ title, value, subtitle, status = "inactive", icon, action, children }: ModuleCardProps) {
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
      {action && (
        <button
          className={styles.actionBtn}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
