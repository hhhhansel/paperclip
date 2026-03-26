import { ModuleCard } from "../../components/ModuleCard";
import styles from "../shared.module.css";

export function CaelPanel() {
  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h1 className={styles.moduleTitle}>CAEL</h1>
        <p className={styles.moduleSubtitle}>
          Crypto education app — business metrics and operations
        </p>
      </div>

      <div className={styles.grid}>
        <ModuleCard
          title="Subscribers"
          icon="◆"
          status="pending"
          value="—"
          subtitle="Connect RevenueCat to populate"
        />
        <ModuleCard
          title="Monthly Revenue"
          icon="◆"
          status="pending"
          value="—"
          subtitle="Connect RevenueCat to populate"
        />
        <ModuleCard
          title="Active Beta Users"
          icon="◆"
          status="pending"
          value="—"
          subtitle="Connect Appwrite analytics"
        />
        <ModuleCard
          title="App Store Rating"
          icon="◆"
          status="inactive"
          value="—"
          subtitle="Available after App Store launch"
        />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Content Pipeline</h2>
        <div className={styles.grid}>
          <ModuleCard
            title="Curriculum Progress"
            icon="▸"
            status="active"
            value="Module 1"
            subtitle="6 lessons complete — Modules 2-4 in progress"
          />
          <ModuleCard
            title="Instagram Content"
            icon="▸"
            status="pending"
            subtitle="Psychology-first carousels — connect calendar"
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Launch Checklist</h2>
        <div className={styles.checklist}>
          <label className={styles.checkItem}>
            <input type="checkbox" defaultChecked /> Stripe integration
          </label>
          <label className={styles.checkItem}>
            <input type="checkbox" defaultChecked /> Apple IAP (StoreKit 2)
          </label>
          <label className={styles.checkItem}>
            <input type="checkbox" defaultChecked /> Onboarding flow
          </label>
          <label className={styles.checkItem}>
            <input type="checkbox" /> TestFlight submission
          </label>
          <label className={styles.checkItem}>
            <input type="checkbox" /> Beta access code system
          </label>
          <label className={styles.checkItem}>
            <input type="checkbox" /> Free tier enforcement
          </label>
        </div>
      </div>
    </div>
  );
}
