import styles from "../shared.module.css";
import creativeStyles from "./CreativePanel.module.css";

const PLANNED_FEATURES = [
  { icon: "🖼", label: "Image Generation", desc: "Flux / SDXL / Ideogram via API", tag: "v2" },
  { icon: "🎬", label: "Video Drafts", desc: "Runway / Kling clips from prompt", tag: "v2" },
  { icon: "✍️", label: "Copywriting", desc: "Claude-powered ad copy + captions", tag: "v2" },
  { icon: "📐", label: "Brand Assets", desc: "Auto-resize to Instagram / TikTok specs", tag: "v2" },
  { icon: "🎨", label: "Palette Generator", desc: "Extract MM brand palettes from images", tag: "v2" },
  { icon: "📸", label: "Content Calendar", desc: "Schedule + preview social posts", tag: "v2" },
];

export function CreativePanel() {
  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h1 className={styles.moduleTitle}>Creative Studio</h1>
        <p className={styles.moduleSubtitle}>
          Image gen, video, copy, and brand assets — unlocking when credits reset
        </p>
      </div>

      {/* Hero placeholder */}
      <div className={creativeStyles.hero}>
        <div className={creativeStyles.heroGlow} />
        <div className={creativeStyles.heroContent}>
          <div className={creativeStyles.badge}>Coming in v2</div>
          <h2 className={creativeStyles.heroTitle}>AI Creative Suite</h2>
          <p className={creativeStyles.heroDesc}>
            One place to generate images, draft video clips, write copy,<br />
            and build brand-consistent content for CAEL + Maison Maintenant.
          </p>
        </div>
      </div>

      {/* Feature roadmap */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Planned Features</h2>
        <div className={creativeStyles.featureGrid}>
          {PLANNED_FEATURES.map((f) => (
            <div key={f.label} className={creativeStyles.featureCard}>
              <span className={creativeStyles.featureIcon}>{f.icon}</span>
              <div>
                <div className={creativeStyles.featureLabel}>{f.label}</div>
                <div className={creativeStyles.featureDesc}>{f.desc}</div>
              </div>
              <span className={creativeStyles.featureTag}>{f.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
