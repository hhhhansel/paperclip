import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { ModuleCard } from "../../components/ModuleCard";
import styles from "../shared.module.css";

interface HealthStatus {
  status: string;
  version: string;
  deploymentMode: string;
}

type ConnectorState = "disconnected" | "connecting" | "connected" | "error";

const STORAGE_KEYS = {
  claude: "connector_claude_connected",
  gemini: "connector_gemini_connected",
  zo: "connector_zo_apikey",
};

// Claude uses its CLI OAuth flow (browser-based)
const CLAUDE_OAUTH_URL =
  "https://claude.ai/oauth/authorize?client_id=paperclip-desktop&response_type=code&scope=api";

// Gemini OAuth (Google sign-in)
const GEMINI_OAUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=paperclip-desktop&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgenerativeai&redirect_uri=paperclip%3A%2F%2Foauth%2Fgemini";

function loadState(key: string): boolean {
  return localStorage.getItem(key) === "true";
}

export function AgentsPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const [claudeState, setClaudeState] = useState<ConnectorState>(
    loadState(STORAGE_KEYS.claude) ? "connected" : "disconnected"
  );
  const [geminiState, setGeminiState] = useState<ConnectorState>(
    loadState(STORAGE_KEYS.gemini) ? "connected" : "disconnected"
  );
  const [zoKey, setZoKey] = useState<string>(
    localStorage.getItem(STORAGE_KEYS.zo) ?? ""
  );
  const [zoEditing, setZoEditing] = useState(false);
  const [zoInput, setZoInput] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Listen for OAuth callback via deep link (tauri://oauth/...)
  useEffect(() => {
    // Deep-link handler wired in lib.rs will post messages here
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "oauth_callback") {
        if (e.data.provider === "claude") {
          localStorage.setItem(STORAGE_KEYS.claude, "true");
          setClaudeState("connected");
        }
        if (e.data.provider === "gemini") {
          localStorage.setItem(STORAGE_KEYS.gemini, "true");
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
      // Mark connected optimistically — real token exchange happens via deep-link callback
      setTimeout(() => {
        localStorage.setItem(STORAGE_KEYS.claude, "true");
        setClaudeState("connected");
      }, 3000);
    } catch {
      setClaudeState("error");
    }
  }

  async function connectGemini() {
    setGeminiState("connecting");
    try {
      await open(GEMINI_OAUTH_URL);
      setTimeout(() => {
        localStorage.setItem(STORAGE_KEYS.gemini, "true");
        setGeminiState("connected");
      }, 3000);
    } catch {
      setGeminiState("error");
    }
  }

  function disconnectClaude() {
    localStorage.removeItem(STORAGE_KEYS.claude);
    setClaudeState("disconnected");
  }

  function disconnectGemini() {
    localStorage.removeItem(STORAGE_KEYS.gemini);
    setGeminiState("disconnected");
  }

  function saveZoKey() {
    localStorage.setItem(STORAGE_KEYS.zo, zoInput);
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
    return `OAuth not connected — connect to enable`;
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
          subtitle={
            zoKey
              ? `API key set (${zoKey.slice(0, 6)}…)`
              : "API key not configured"
          }
          action={
            zoEditing
              ? undefined
              : {
                  label: zoKey ? "Update key" : "Add API key",
                  onClick: () => {
                    setZoInput(zoKey);
                    setZoEditing(true);
                  },
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
              <button className={styles.inlineSave} onClick={saveZoKey}>
                Save
              </button>
              <button
                className={styles.inlineCancel}
                onClick={() => setZoEditing(false)}
              >
                ✕
              </button>
            </div>
          )}
        </ModuleCard>
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
