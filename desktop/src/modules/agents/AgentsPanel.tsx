import { useEffect, useState, useCallback } from "react";
import {
  api, saveCreds, loadCreds, clearCreds,
  getMe, getAgents, getDashboard, getIssues, getProjects,
  type PaperclipCreds, type Agent, type Issue, type Project, type DashboardData,
} from "../../lib/paperclip";
import styles from "../shared.module.css";
import pp from "./AgentsPanel.module.css";

// ── Status helpers ─────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  done: "var(--success)", in_progress: "var(--accent-bright)",
  todo: "var(--text-muted)", blocked: "var(--danger)",
  in_review: "var(--warning)", backlog: "var(--text-muted)",
  cancelled: "var(--text-muted)",
};
const PRIORITY_LABEL: Record<string, string> = {
  critical: "🔴", high: "🟠", medium: "🟡", low: "⚪",
};

// ── Connect form ───────────────────────────────────────────────────────
function ConnectForm({ onConnect }: { onConnect: (c: PaperclipCreds) => void }) {
  const [form, setForm] = useState({ apiUrl: "https://paperclip.ing", apiKey: "", companyId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.apiKey.trim() || !form.companyId.trim()) { setError("API key and Company ID are required."); return; }
    setLoading(true); setError("");
    try {
      api.setCreds(form);
      await getMe(); // validates creds
      await saveCreds(form);
      onConnect(form);
    } catch {
      setError("Could not connect — check your API key and Company ID.");
    } finally { setLoading(false); }
  }

  return (
    <div className={pp.connectWrap}>
      <div className={pp.connectCard}>
        <div className={pp.connectLogo}>⬡</div>
        <h2 className={pp.connectTitle}>Connect to Paperclip</h2>
        <p className={pp.connectSub}>Enter your credentials to access agents, goals, and issues.</p>

        <div className={pp.field}>
          <label className={pp.label}>API URL</label>
          <input className={pp.input} value={form.apiUrl}
            onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))}
            placeholder="https://paperclip.ing" />
        </div>
        <div className={pp.field}>
          <label className={pp.label}>Company ID</label>
          <input className={pp.input} value={form.companyId}
            onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
            placeholder="your-company-id" />
        </div>
        <div className={pp.field}>
          <label className={pp.label}>API Key</label>
          <input className={pp.input} type="password" value={form.apiKey}
            onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="pk_live_…" />
        </div>

        {error && <p className={pp.error}>{error}</p>}

        <button className={pp.connectBtn} onClick={submit} disabled={loading}>
          {loading ? "Connecting…" : "Connect"}
        </button>
      </div>
    </div>
  );
}

// ── Org chart node ─────────────────────────────────────────────────────
function AgentNode({ agent, children }: { agent: Agent; children?: React.ReactNode }) {
  return (
    <div className={pp.orgBranch}>
      <div className={pp.orgNode}>
        <span className={pp.orgDot} data-live={agent.isLive} />
        <div>
          <div className={pp.orgName}>{agent.name}</div>
          <div className={pp.orgRole}>{agent.role} · {agent.model ?? "Claude"}</div>
        </div>
      </div>
      {children && <div className={pp.orgChildren}>{children}</div>}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────
export function AgentsPanel() {
  const [creds, setCreds]       = useState<PaperclipCreds | null>(null);
  const [loading, setLoading]   = useState(true);
  const [agents, setAgents]     = useState<Agent[]>([]);
  const [issues, setIssues]     = useState<Issue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [_dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tab, setTab]           = useState<"agents" | "issues" | "projects">("agents");
  const [refreshing, setRefreshing] = useState(false);

  // Load saved creds on mount
  useEffect(() => {
    loadCreds().then(c => {
      if (c) { api.setCreds(c); setCreds(c); } else { setLoading(false); }
    });
  }, []);

  const fetchAll = useCallback(async (c: PaperclipCreds) => {
    setRefreshing(true);
    try {
      const [agentsRes, dashRes, issuesRes, projRes] = await Promise.allSettled([
        getAgents(c.companyId),
        getDashboard(c.companyId),
        getIssues(c.companyId, "?status=todo,in_progress,blocked&limit=30"),
        getProjects(c.companyId),
      ]);
      if (agentsRes.status === "fulfilled") setAgents(agentsRes.value.agents ?? []);
      if (dashRes.status === "fulfilled")   setDashboard(dashRes.value);
      if (issuesRes.status === "fulfilled") setIssues(issuesRes.value.issues ?? []);
      if (projRes.status === "fulfilled")   setProjects(projRes.value.projects ?? []);
    } finally { setRefreshing(false); setLoading(false); }
  }, []);

  useEffect(() => {
    if (creds) fetchAll(creds);
  }, [creds, fetchAll]);

  function handleConnect(c: PaperclipCreds) { setCreds(c); setLoading(true); }
  function handleDisconnect() { clearCreds(); setCreds(null); setAgents([]); setIssues([]); setDashboard(null); }

  // ── Not connected ──
  if (!loading && !creds) return <ConnectForm onConnect={handleConnect} />;
  if (loading) return (
    <div className={styles.module}>
      <div className={pp.loadingState}>
        <span className={pp.loadingDot} />
        <span className={pp.loadingDot} />
        <span className={pp.loadingDot} />
      </div>
    </div>
  );

  // Build org tree
  const roots   = agents.filter(a => !a.managerId);
  const reports = (id: string) => agents.filter(a => a.managerId === id);

  function renderTree(a: Agent): React.ReactNode {
    const children = reports(a.id);
    return (
      <AgentNode key={a.id} agent={a}>
        {children.length > 0 && children.map(renderTree)}
      </AgentNode>
    );
  }

  const liveCount  = agents.filter(a => a.isLive).length;
  const openIssues = issues.filter(i => i.status !== "done" && i.status !== "cancelled");

  return (
    <div className={styles.module}>
      {/* ── Header ── */}
      <div className={pp.topBar}>
        <div>
          <h1 className={styles.moduleTitle}>Command Center</h1>
          <p className={styles.moduleSubtitle}>
            {agents.length} agents · {openIssues.length} open issues · {projects.length} projects
          </p>
        </div>
        <div className={pp.topActions}>
          <button className={pp.refreshBtn} onClick={() => creds && fetchAll(creds)} disabled={refreshing}>
            {refreshing ? "↻" : "↻"} Refresh
          </button>
          <button className={pp.disconnectBtn} onClick={handleDisconnect}>Disconnect</button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className={pp.statsRow}>
        <div className={pp.stat}>
          <span className={pp.statVal}>{agents.length}</span>
          <span className={pp.statLbl}>Agents</span>
        </div>
        <div className={pp.stat}>
          <span className={pp.statVal} style={{ color: liveCount > 0 ? "var(--success)" : undefined }}>{liveCount}</span>
          <span className={pp.statLbl}>Live</span>
        </div>
        <div className={pp.stat}>
          <span className={pp.statVal}>{openIssues.length}</span>
          <span className={pp.statLbl}>Open Issues</span>
        </div>
        <div className={pp.stat}>
          <span className={pp.statVal}>{issues.filter(i => i.status === "blocked").length}</span>
          <span className={pp.statLbl} style={{ color: issues.filter(i => i.status === "blocked").length > 0 ? "var(--danger)" : undefined }}>Blocked</span>
        </div>
        <div className={pp.stat}>
          <span className={pp.statVal}>{projects.length}</span>
          <span className={pp.statLbl}>Projects</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={pp.tabs}>
        {(["agents", "issues", "projects"] as const).map(t => (
          <button key={t} className={`${pp.tab} ${tab === t ? pp.tabActive : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Agents org chart ── */}
      {tab === "agents" && (
        <div className={pp.orgWrap}>
          {agents.length === 0
            ? <div className={styles.placeholder}>No agents found in this company.</div>
            : <div className={pp.orgTree}>{roots.map(renderTree)}</div>
          }
        </div>
      )}

      {/* ── Issues ── */}
      {tab === "issues" && (
        <div className={pp.issueList}>
          {openIssues.length === 0
            ? <div className={styles.placeholder}>No open issues 🎉</div>
            : openIssues.map(issue => {
                const agent = agents.find(a => a.id === issue.assigneeAgentId);
                return (
                  <div key={issue.id} className={pp.issueRow}>
                    <span className={pp.issuePriority}>{PRIORITY_LABEL[issue.priority] ?? "⚪"}</span>
                    <span className={pp.issueId}>{issue.identifier}</span>
                    <span className={pp.issueTitle}>{issue.title}</span>
                    <span className={pp.issueAgent}>{agent?.name ?? "—"}</span>
                    <span className={pp.issueStatus} style={{ color: STATUS_COLOR[issue.status] ?? "var(--text-muted)" }}>
                      {issue.status.replace("_", " ")}
                    </span>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ── Projects ── */}
      {tab === "projects" && (
        <div className={pp.projectGrid}>
          {projects.length === 0
            ? <div className={styles.placeholder}>No projects found.</div>
            : projects.map(p => (
                <div key={p.id} className={pp.projectCard}>
                  <div className={pp.projectName}>{p.name}</div>
                  <div className={pp.projectKey}>{p.urlKey}</div>
                  <div className={pp.projectStatus}>{p.status ?? "active"}</div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
