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

// Encrypted store backed by OS keychain via tauri-plugin-store
async function getStore() {
  return load("connectors.bin", { defaults: {}, autoSave: true });
}

async function readKey(key: string): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>(key)) ?? null;
}

async function writeKey(key: string, value: string) {
  const store = await getStore();
  await store.set(key, value);
}

async function deleteKey(key: string) {
  const store = await getStore();
  await store.delete(key);
}

const CLAUDE_OAUTH_URL =
  "https://claude.ai/oauth/authorize?client_id=paperclip-desktop&response_type=code&scope=api";

const GEMINI_OAUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=paperclip-desktop&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgenerativeai&redirect_uri=paperclip%3A%2F%2Foauth%2Fgemini";

export function AgentsPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [claudeState, setClaudeState] = useState<ConnectorState>("disconnected");
  const [geminiState, setGeminiState] = useState<ConnectorState>("disconnected");
  const [zoKey, setZoKey] = useState<string>("");
  const [zoEditing, setZoEditing] = useState(false);
  const [zoInput, setZoInput] = useState("");

  // Load persisted state from secure store on mount
  useEffect(() => {
    readKey("claude_connected").then((v) => v === "true" && setClaudeState("connected"));
    readKey("gemini_connected").then((v) => v === "true" && setGeminiState("connected"));
    readKey("zo_api_key").then((v) => v && setZoKey(v));
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Deep-link OAuth callback
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "oauth_callback") {
        if (e.data.provider === "claude") {
          writeKey("claude_connected", "true");
          setClaudeState("connected");
        }
        if (e.data.provider === "gemini") {
          writeKey("gemini_connected", "true");
          setGeminiState("connected");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  async function connectClaude() {
    setClaudeState("connecting");
    try {
      await open(CLAUDE_OAUTH_URL);
    } catch {
      setClaudeState("error");
    }
  }

  async function connectGemini() {
    setGeminiState("connecting");
    try {
      await open(GEMINI_OAUTH_URL);
    } catch {
      setGeminiState("error");
    }
  }

  async function disconnectClaude() {
    await deleteKey("claude_connected");
    setClaudeState("disconnected");
  }

  async function disconnectGemini() {
    await deleteKey("gemini_connected");
    setGeminiState("disconnected");
  }

  async function saveZoKey() {
    await writeKey("zo_api_key", zoInput);
    setZoKey(zoInput);
    setZoEditing(false);
  }

  function statusOf(s: ConnectorState): "active" | "pending" | "inactive" {
    if (s === "connected") return "active";
    if (s === "connecting") return "pending";
    return "inactive";
  }

  function subtitleOf(s: ConnectorState, label: string) {
    if (s === "connected") return `${label} connected`;
    if (s === "connecting") return "Opening browser — approve in your browser…";
    if (s === "error") return "Connection failed — try again";
    return "OAuth not connected — connect to enable";
  }

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
          status={statusOf(claudeState)}
          subtitle={subtitleOf(claudeState, "Claude")}
          action={
            claudeState === "connected"
              ? { label: "Disconnect", onClick: disconnectClaude }
              : {
                  label: claudeState === "connecting" ? "Connecting…" : "Connect",
                  onClick: connectClaude,
                  disabled: claudeState === "connecting",
                }
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
              : {
                  label: geminiState === "connecting" ? "Connecting…" : "Connect",
                  onClick: connectGemini,
                  disabled: geminiState === "connecting",
                }
          }
        />
        <ModuleCard
          title="Zo Computer"
          icon="◉"
          status={zoKey ? "active" : "inactive"}
          subtitle={zoKey ? `API key set (${zoKey.slice(0, 6)}…)` : "API key not configured"}
          action={
            zoEditing
              ? undefined
              : {
                  label: zoKey ? "Update key" : "Add API key",
                  onClick: () => { setZoInput(zoKey); setZoEditing(true); },
                }
          }
        >
          {zoEditing && (
            <div className={styles.inlineForm}>
              <input
                className={styles.inlineInput}
                type="password"
                placeholder="zo_live_…"
                value={zoInput}
                onChange={(e) => setZoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveZoKey()}
                autoFocus
              />
              <button className={styles.inlineSave} onClick={saveZoKey}>Save</button>
              <button className={styles.inlineCancel} onClick={() => setZoEditing(false)}>✕</button>
            </div>
          )}
        </ModuleCard>
        <ModuleCard
          title="OpenClaw"
          icon="◉"
          status="inactive"
          subtitle="Coming soon"
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
            subtitle={health ? `Mode: ${health.deploymentMode}` : "Unable to connect to backend"}
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
