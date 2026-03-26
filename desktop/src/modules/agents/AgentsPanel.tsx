import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { load } from "@tauri-apps/plugin-store";
import { ModuleCard } from "../../components/ModuleCard";
import styles from "../shared.module.css";

interface HealthStatus {
  status: string;
  version: string;
  deploymentMode: string;
}

type ConnectorState = "disconnected" | "connecting" | "connected" | "error";

async function getStore() {
  return load("connectors.bin", { defaults: {}, autoSave: true });
}
async function readKey(key: string): Promise<string | null> {
  const val = await (await getStore()).get<string>(key);
  return val !== undefined ? val : null;
}
async function writeKey(key: string, value: string) {
  (await getStore()).set(key, value);
}
async function deleteKey(key: string) {
  (await getStore()).delete(key);
}

const CLAUDE_OAUTH_URL =
  "https://claude.ai/oauth/authorize?client_id=paperclip-desktop&response_type=code&scope=api";
const GEMINI_OAUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=paperclip-desktop&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgenerativeai&redirect_uri=paperclip%3A%2F%2Foauth%2Fgemini";

export function AgentsPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [claudeState, setClaudeState] = useState<ConnectorState>("disconnected");
  const [geminiState, setGeminiState] = useState<ConnectorState>("disconnected");
  const [zoKey, setZoKey] = useState("");
  const [zoEditing, setZoEditing] = useState(false);
  const [zoInput, setZoInput] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    readKey("claude_connected").then((v) => v === "true" && setClaudeState("connected"));
    readKey("gemini_connected").then((v) => v === "true" && setGeminiState("connected"));
    readKey("zo_api_key").then((v) => v && setZoKey(v));
  }, []);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "oauth_callback") {
        if (e.data.provider === "claude") { writeKey("claude_connected", "true"); setClaudeState("connected"); }
        if (e.data.provider === "gemini") { writeKey("gemini_connected", "true"); setGeminiState("connected"); }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  async function connectClaude() {
    setClaudeState("connecting");
    try { await open(CLAUDE_OAUTH_URL); } catch { setClaudeState("error"); }
  }
  async function connectGemini() {
    setGeminiState("connecting");
    try { await open(GEMINI_OAUTH_URL); } catch { setGeminiState("error"); }
  }
  async function disconnectClaude() { await deleteKey("claude_connected"); setClaudeState("disconnected"); }
  async function disconnectGemini() { await deleteKey("gemini_connected"); setGeminiState("disconnected"); }
  async function saveZoKey() { await writeKey("zo_api_key", zoInput); setZoKey(zoInput); setZoEditing(false); }

  function statusOf(s: ConnectorState): "active" | "pending" | "inactive" {
    return s === "connected" ? "active" : s === "connecting" ? "pending" : "inactive";
  }
  function subtitleOf(s: ConnectorState, label: string) {
    if (s === "connected") return `${label} connected`;
    if (s === "connecting") return "Opening browser…";
    if (s === "error") return "Connection failed";
    return "Not connected";
  }

  const connectedCount = [claudeState, geminiState, zoKey ? "connected" : ""].filter(s => s === "connected").length;
  const timeStr = now.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h1 className={styles.moduleTitle}>Command Center</h1>
        <p className={styles.moduleSubtitle}>{dateStr}</p>
      </div>

      {/* ── Hero bento row ── */}
      <div className={styles.bentoHero}>
        {/* Status hero */}
        <div className={styles.heroCard}>
          <div className={styles.heroTime}>{timeStr}</div>
          <div className={styles.heroLabel}>
            {health?.status === "ok" ? "All systems operational" : "Backend offline"}
          </div>
          <div className={styles.heroMeta}>
            {connectedCount}/3 connectors live
            {health && <span className={styles.heroPill}>v{health.version} · {health.deploymentMode}</span>}
          </div>
        </div>

        {/* Audit trail */}
        <div className={styles.sideStack}>
          <div className={styles.miniCard}>
            <span className={styles.miniDot} data-status="active" />
            <div>
              <div className={styles.miniTitle}>Audit Trail</div>
              <div className={styles.miniSub}>All actions logged</div>
            </div>
          </div>
          <div className={styles.miniCard}>
            <span className={styles.miniDot} data-status={health?.status === "ok" ? "active" : "inactive"} />
            <div>
              <div className={styles.miniTitle}>Paperclip Backend</div>
              <div className={styles.miniSub}>{health ? `Mode: ${health.deploymentMode}` : "Offline"}</div>
            </div>
          </div>
          <div className={styles.miniCard}>
            <span className={styles.miniDot} data-status={connectedCount > 0 ? "active" : "inactive"} />
            <div>
              <div className={styles.miniTitle}>Agent Network</div>
              <div className={styles.miniSub}>{connectedCount} active connector{connectedCount !== 1 ? "s" : ""}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Connector cards ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Connectors</h2>
        <div className={styles.grid}>
          <ModuleCard
            title="Claude CLI"
            icon="◉"
            status={statusOf(claudeState)}
            subtitle={subtitleOf(claudeState, "Claude")}
            action={
              claudeState === "connected"
                ? { label: "Disconnect", onClick: disconnectClaude }
                : { label: claudeState === "connecting" ? "Connecting…" : "Connect", onClick: connectClaude, disabled: claudeState === "connecting" }
            }
          />
          <ModuleCard
            title="Gemini"
            icon="◉"
            status={statusOf(geminiState)}
            subtitle={subtitleOf(geminiState, "Gemini")}
            action={
              geminiState === "connected"
                ? { label: "Disconnect", onClick: disconnectGemini }
                : { label: geminiState === "connecting" ? "Connecting…" : "Connect", onClick: connectGemini, disabled: geminiState === "connecting" }
            }
          />
          <ModuleCard
            title="Zo Computer"
            icon="◉"
            status={zoKey ? "active" : "inactive"}
            subtitle={zoKey ? `Key set (${zoKey.slice(0, 6)}…)` : "API key not configured"}
            action={
              zoEditing
                ? undefined
                : { label: zoKey ? "Update key" : "Add API key", onClick: () => { setZoInput(zoKey); setZoEditing(true); } }
            }
          >
            {zoEditing && (
              <div className={styles.inlineForm}>
                <input className={styles.inlineInput} type="password" placeholder="zo_live_…" value={zoInput}
                  onChange={(e) => setZoInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveZoKey()} autoFocus />
                <button className={styles.inlineSave} onClick={saveZoKey}>Save</button>
                <button className={styles.inlineCancel} onClick={() => setZoEditing(false)}>✕</button>
              </div>
            )}
          </ModuleCard>
          <ModuleCard title="OpenClaw" icon="◉" status="inactive" subtitle="Coming soon" />
        </div>
      </div>
    </div>
  );
}
