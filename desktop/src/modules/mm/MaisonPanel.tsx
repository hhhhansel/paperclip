import { ModuleCard } from "../../components/ModuleCard";
import styles from "../shared.module.css";

export function MaisonPanel() {
  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h1 className={styles.moduleTitle}>Maison Maintenant</h1>
        <p className={styles.moduleSubtitle}>
          Psychology-first products — consulting, experiences, products
        </p>
      </div>

      <div className={styles.grid}>
        <ModuleCard
          title="Active Clients"
          icon="■"
          status="pending"
          value="—"
          subtitle="Add consulting clients manually"
        />
        <ModuleCard
          title="Revenue (Monthly)"
          icon="■"
          status="pending"
          value="—"
          subtitle="Track invoices and payments"
        />
        <ModuleCard
          title="Experiences"
          icon="■"
          status="inactive"
          value="—"
          subtitle="Upcoming events and workshops"
        />
        <ModuleCard
          title="Products"
          icon="■"
          status="inactive"
          value="—"
          subtitle="Product catalog and status"
        />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Roadmap</h2>
        <div className={styles.roadmap}>
          <div className={styles.roadmapItem}>
            <span className={styles.roadmapDot} data-status="active" />
            <div>
              <div className={styles.roadmapTitle}>CAEL iOS App</div>
              <div className={styles.roadmapSubtitle}>Beta launch — in progress</div>
            </div>
          </div>
          <div className={styles.roadmapItem}>
            <span className={styles.roadmapDot} data-status="pending" />
            <div>
              <div className={styles.roadmapTitle}>Command Center</div>
              <div className={styles.roadmapSubtitle}>Internal tooling — building now</div>
            </div>
          </div>
          <div className={styles.roadmapItem}>
            <span className={styles.roadmapDot} data-status="inactive" />
            <div>
              <div className={styles.roadmapTitle}>Consulting Framework</div>
              <div className={styles.roadmapSubtitle}>Psychology-first consulting packages</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Invoicing</h2>
        <p className={styles.placeholder}>
          Invoice builder coming in v2 — for now, track invoices manually below
        </p>
      </div>
    </div>
  );
}
