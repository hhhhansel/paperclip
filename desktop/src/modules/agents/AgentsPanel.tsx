import { useEffect, useState } from "react";
import { ModuleCard } from "../../components/ModuleCard";
import styles from "../shared.module.css";

interface HealthStatus {
  status: string;
  version: string;
  deploymentMode: string;
}

export function AgentsPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h1 className={styles.moduleTitle}>Agent Overview</h1>
        <p className={styles.moduleSubtitle}>
          Orchestrate and monitor your AI agents
        </p>
      </div>

      <div className={styles.grid}>
        <ModuleCard
          title="Claude CLI"
          icon="◉"
          status="pending"
          subtitle="OAuth not connected — connect to enable"
        />
        <ModuleCard
          title="Gemini"
          icon="◉"
          status="pending"
          subtitle="OAuth not connected — connect to enable"
        />
        <ModuleCard
          title="Zo Computer"
          icon="◉"
          status="pending"
          subtitle="API key not configured"
        />
        <ModuleCard
          title="OpenClaw"
          icon="◉"
          status="inactive"
          subtitle="Coming soon — placeholder"
        />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>System Status</h2>
        <div className={styles.grid}>
          <ModuleCard
            title="Paperclip Backend"
            icon="⬡"
            status={health?.status === "ok" ? "active" : "inactive"}
            value={health?.version ?? "—"}
            subtitle={
              health
                ? `Mode: ${health.deploymentMode}`
                : "Unable to connect to backend"
            }
          />
          <ModuleCard
            title="Audit Trail"
            icon="◈"
            status="active"
            subtitle="All agent actions logged"
          />
        </div>
      </div>
    </div>
  );
}
