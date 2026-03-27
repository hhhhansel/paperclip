import { useEffect, useState, useCallback } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import {
  api, saveCreds, loadCreds, clearCreds,
  getAgents, getIssues, getProjects,
  type PaperclipCreds, type Agent, type Issue, type Project,
} from "../../lib/paperclip";
import styles from "../shared.module.css";
import pp from "./AgentsPanel.module.css";

// ── Helpers ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  done: "var(--success)", in_progress: "var(--accent-bright)",
  todo: "var(--text-muted)", blocked: "var(--danger)",
  in_review: "var(--warning)", backlog: "var(--text-muted)",
  cancelled: "var(--text-muted)",
};
const PRIORITY_LABEL: Record<string, string> = {
  critical: "🔴", high: "🟠", medium: "🟡", low: "⚪",
};

// Repo root is one level above the desktop/ folder.
// __PAPERCLIP_REPO__ is replaced at build time; at runtime we resolve via import.meta.url.
const REPO_ROOT = new URL("../../../../", import.meta.url).pathname.replace(/\/$/, "");

async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    // Use the repo's own CLI: pnpm run paperclipai <args>
    const cmd = Command.create("pnpm", ["run", "paperclipai", ...args], { cwd: REPO_ROOT });
    const out = await cmd.execute();
    return { stdout: out.stdout ?? "", stderr: out.stderr ?? "", ok: out.code === 0 };
  } catch (e) {
    return { stdout: "", stderr: String(e), ok: false };
  }
}

// ── Step 1: Onboard/detect ─────────────────────────────────────────────
function SetupStep({ onNext }: { onNext: (apiBase: string) => void }) {
  const [status, setStatus] = useState<"idle"|"detecting"|"onboarding"|"done"|"error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [apiBase, setApiBase] = useState("http://localhost:3100");

  async function autoDetect() {
    setStatus("detecting");
    // Try the repo's context first
    const res = await runCLI(["context", "show", "--json"]);
    if (res.ok) {
      try {
        const ctx = JSON.parse(res.stdout);
        const base = ctx.profile?.apiBase ?? ctx.profiles?.default?.apiBase;
        if (base) { setApiBase(base); setLog([`✓ Found instance at ${base}`]); setStatus("done"); return; }
      } catch {}
    }
    // Probe default port 3100
    for (const port of [3100, 3000, 4000]) {
      try {
        const r = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          const base = `http://localhost:${port}`;
          setApiBase(base);
          setLog([`✓ Found Paperclip at ${base}`]);
          setStatus("done");
          return;
        }
      } catch {}
    }
    setLog(["No running instance found. Start the server first (see below)."]);
    setStatus("idle");
  }

  async function runOnboard() {
    setStatus("onboarding");
    setLog(["Running npx paperclipai onboard --yes …", "This may take a minute…"]);
    const res = await runCLI(["onboard", "--yes"]);
    if (res.ok) {
      setLog(l => [...l, "✓ Onboard complete!", res.stdout.slice(0, 200)]);
      setStatus("done");
      // Try to read context
      const ctx = await runCLI(["context", "show", "--json"]);
      if (ctx.ok) {
        try {
          const parsed = JSON.parse(ctx.stdout);
          const base = parsed.profile?.apiBase ?? parsed.profiles?.default?.apiBase;
          if (base) setApiBase(base);
        } catch {}
      }
    } else {
      setLog(l => [...l, "Error: " + res.stderr.slice(0, 300)]);
      setStatus("error");
    }
  }

  return (
    <div className={pp.setupCard}>
      <div className={pp.setupStep}>
        <div className={pp.stepNum}>1</div>
        <div className={pp.stepContent}>
          <div className={pp.stepTitle}>Start your Paperclip instance</div>
          <div className={pp.stepDesc}>Start the server from your repo root:</div>
          <div className={pp.codeBlock}>pnpm dev</div>
          <div className={pp.stepDesc} style={{ marginTop: 0 }}>First time? Run onboard first:</div>
          <div className={pp.codeBlock}>pnpm run paperclipai onboard --yes</div>
          <div className={pp.stepBtns}>
            <button className={pp.stepBtn} onClick={autoDetect} disabled={status === "detecting"}>
              {status === "detecting" ? "Detecting…" : "Auto-detect running instance"}
            </button>
            <button className={pp.stepBtnSecondary} onClick={runOnboard} disabled={status === "onboarding"}>
              {status === "onboarding" ? "Running…" : "Run onboard for me"}
            </button>
          </div>
          {log.length > 0 && (
            <div className={pp.logBox}>
              {log.map((l, i) => <div key={i} className={pp.logLine}>{l}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className={pp.setupDivider} />

      <div className={pp.setupStep}>
        <div className={pp.stepNum}>2</div>
        <div className={pp.stepContent}>
          <div className={pp.stepTitle}>Instance URL</div>
          <input className={pp.input} value={apiBase}
            onChange={e => setApiBase(e.target.value)}
            placeholder="http://localhost:3100" />
        </div>
      </div>

      <button
        className={pp.connectBtn}
        disabled={status === "detecting" || status === "onboarding"}
        onClick={() => onNext(apiBase)}
      >
        Continue →
      </button>
    </div>
  );
}

// ── Step 2: Pick company + agent ───────────────────────────────────────
function AgentStep({ apiBase, onConnect }: { apiBase: string; onConnect: (c: PaperclipCreds) => void }) {
  const [companies, setCompanies]     = useState<Array<{ id: string; name: string; prefix: string }>>([]);
  const [agents, setAgents]           = useState<Array<{ id: string; name: string; urlKey: string }>>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedAgent, setSelectedAgent]     = useState("");
  const [loading, setLoading]         = useState(false);
  const [envOutput, setEnvOutput]     = useState("");
  const [error, setError]             = useState("");
  // Manual fallback
  const [apiKey, setApiKey]           = useState("");

  useEffect(() => {
    setLoading(true);
    runCLI(["company", "list", "--api-base", apiBase, "--json"]).then(res => {
      if (res.ok) {
        try {
          const parsed = JSON.parse(res.stdout);
          const list = parsed.companies ?? parsed ?? [];
          setCompanies(Array.isArray(list) ? list : []);
          if (list.length === 1) setSelectedCompany(list[0].id);
        } catch {}
      }
      setLoading(false);
    });
  }, [apiBase]);

  useEffect(() => {
    if (!selectedCompany) return;
    runCLI(["agent", "list", "--company-id", selectedCompany, "--api-base", apiBase, "--json"]).then(res => {
      if (res.ok) {
        try {
          const parsed = JSON.parse(res.stdout);
          const list = parsed.agents ?? parsed ?? [];
          setAgents(Array.isArray(list) ? list : []);
          const ceo = list.find((a: any) => a.role?.toLowerCase().includes("ceo") || a.name?.toLowerCase() === "ceo");
          if (ceo) setSelectedAgent(ceo.id);
        } catch {}
      }
    });
  }, [selectedCompany, apiBase]);

  async function generateKey() {
    if (!selectedCompany || !selectedAgent) { setError("Select a company and agent."); return; }
    setLoading(true); setError("");
    const res = await runCLI(["agent", "local-cli", selectedAgent, "--company-id", selectedCompany, "--api-base", apiBase, "--json"]);
    if (res.ok) {
      try {
        const parsed = JSON.parse(res.stdout);
        const key = parsed.apiKey ?? parsed.PAPERCLIP_API_KEY ?? parsed.key;
        if (key) {
          setApiKey(key);
          setEnvOutput(JSON.stringify(parsed, null, 2).slice(0, 400));
        }
      } catch { setEnvOutput(res.stdout.slice(0, 400)); }
    } else {
      setError(res.stderr.slice(0, 200) || "Failed to generate API key.");
    }
    setLoading(false);
  }

  async function connect() {
    if (!apiKey) { setError("API key required."); return; }
    const creds: PaperclipCreds = { apiUrl: apiBase, apiKey, companyId: selectedCompany };
    api.setCreds(creds);
    try {
      await getAgents(selectedCompany);
      await saveCreds(creds);
      onConnect(creds);
    } catch { setError("Could not connect — check your API key."); }
  }

  return (
    <div className={pp.setupCard}>
      <div className={pp.setupStep}>
        <div className={pp.stepNum}>2</div>
        <div className={pp.stepContent}>
          <div className={pp.stepTitle}>Select your company</div>
          {loading ? <div className={pp.stepDesc}>Loading companies…</div> : (
            companies.length > 0
              ? <select className={pp.select} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name ?? c.prefix}</option>)}
                </select>
              : <div className={pp.stepDesc}>No companies found — paste Company ID manually:</div>
          )}
          {companies.length === 0 && (
            <input className={pp.input} value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)} placeholder="company-id" />
          )}
        </div>
      </div>

      <div className={pp.setupDivider} />

      <div className={pp.setupStep}>
        <div className={pp.stepNum}>3</div>
        <div className={pp.stepContent}>
          <div className={pp.stepTitle}>Select your agent & get API key</div>
          {agents.length > 0 && (
            <select className={pp.select} value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ marginBottom: 8 }}>
              <option value="">Select agent…</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <div className={pp.codeBlock}>
            npx paperclipai agent local-cli {selectedAgent || "<agent-id>"}{" "}
            --company-id {selectedCompany || "<company-id>"}
          </div>
          <button className={pp.stepBtn} onClick={generateKey} disabled={loading || !selectedCompany}>
            {loading ? "Generating…" : "Generate API key for me"}
          </button>
          {envOutput && <div className={pp.logBox}><pre style={{ margin: 0, fontSize: 10 }}>{envOutput}</pre></div>}

          <div className={pp.orDivider}>— or paste key manually —</div>
          <input className={pp.input} type="password" value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && connect()}
            placeholder="Paste API key…" />
        </div>
      </div>

      {error && <div className={pp.errorBox}>{error}</div>}

      <button className={pp.connectBtn} onClick={connect} disabled={!apiKey}>
        Connect to Paperclip →
      </button>
    </div>
  );
}

// ── Connect wrapper ────────────────────────────────────────────────────
function ConnectFlow({ onConnect }: { onConnect: (c: PaperclipCreds) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [apiBase, setApiBase] = useState("http://localhost:3100");

  return (
    <div className={pp.connectWrap}>
      <div className={pp.connectHeader}>
        <div className={pp.connectLogo}>⬡</div>
        <h2 className={pp.connectTitle}>Connect to Paperclip</h2>
        <p className={pp.connectSub}>Self-hosted agent orchestration — let's find your instance.</p>
        <div className={pp.stepIndicator}>
          <div className={`${pp.stepDot} ${step >= 1 ? pp.stepDotActive : ""}`}>1</div>
          <div className={pp.stepLine} />
          <div className={`${pp.stepDot} ${step >= 2 ? pp.stepDotActive : ""}`}>2</div>
        </div>
      </div>

      {step === 1 && <SetupStep onNext={(base) => { setApiBase(base); setStep(2); }} />}
      {step === 2 && <AgentStep apiBase={apiBase} onConnect={onConnect} />}

      {step === 2 && (
        <button className={pp.backBtn} onClick={() => setStep(1)}>← Back</button>
      )}
    </div>
  );
}

// ── Org chart ──────────────────────────────────────────────────────────
function AgentNode({ agent, children }: { agent: Agent; children?: React.ReactNode }) {
  return (
    <div className={pp.orgBranch}>
      <div className={pp.orgNode}>
        <span className={pp.orgDot} data-live={agent.isLive} />
        <div>
          <div className={pp.orgName}>{agent.name}</div>
          <div className={pp.orgRole}>{agent.role}{agent.model ? ` · ${agent.model}` : ""}</div>
        </div>
      </div>
      {children && <div className={pp.orgChildren}>{children}</div>}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────
export function AgentsPanel() {
  const [creds, setCreds]       = useState<PaperclipCreds | null>(null);
  const [loading, setLoading]   = useState(true);
  const [agents, setAgents]     = useState<Agent[]>([]);
  const [issues, setIssues]     = useState<Issue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tab, setTab]           = useState<"agents" | "issues" | "projects">("agents");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCreds()
      .then(async c => {
        if (!c) { setLoading(false); return; }
        // Validate creds are still working before trusting them
        api.setCreds(c);
        try {
          const res = await fetch(`${c.apiUrl}/api/health`, {
            signal: AbortSignal.timeout(4000),
            headers: { "Authorization": `Bearer ${c.apiKey}` },
          });
          if (res.ok) {
            setCreds(c);
          } else {
            await clearCreds();
            setLoading(false);
          }
        } catch {
          // Server unreachable — clear creds, show connect form
          await clearCreds();
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchAll = useCallback(async (c: PaperclipCreds) => {
    setRefreshing(true);
    try {
      const [agentsRes, issuesRes, projRes] = await Promise.allSettled([
        getAgents(c.companyId),
        getIssues(c.companyId, "?status=todo,in_progress,blocked&limit=40"),
        getProjects(c.companyId),
      ]);
      if (agentsRes.status === "fulfilled") setAgents(agentsRes.value.agents ?? []);
      if (issuesRes.status === "fulfilled") setIssues(issuesRes.value.issues ?? []);
      if (projRes.status === "fulfilled")   setProjects(projRes.value.projects ?? []);
    } finally { setRefreshing(false); setLoading(false); }
  }, []);

  useEffect(() => { if (creds) fetchAll(creds); }, [creds, fetchAll]);

  function handleConnect(c: PaperclipCreds) { setCreds(c); setLoading(true); }
  function handleDisconnect() { clearCreds(); setCreds(null); setAgents([]); setIssues([]); setLoading(false); }

  if (!loading && !creds) return <ConnectFlow onConnect={handleConnect} />;
  if (loading) return (
    <div className={styles.module}>
      <div className={pp.loadingState}>
        <span className={pp.loadingDot} /><span className={pp.loadingDot} /><span className={pp.loadingDot} />
      </div>
    </div>
  );

  const roots      = agents.filter(a => !a.managerId);
  const reports    = (id: string) => agents.filter(a => a.managerId === id);
  const openIssues = issues.filter(i => i.status !== "done" && i.status !== "cancelled");
  const liveCount  = agents.filter(a => a.isLive).length;

  function renderTree(a: Agent): React.ReactNode {
    const children = reports(a.id);
    return (
      <AgentNode key={a.id} agent={a}>
        {children.length > 0 && children.map(renderTree)}
      </AgentNode>
    );
  }

  return (
    <div className={styles.module}>
      <div className={pp.topBar}>
        <div>
          <h1 className={styles.moduleTitle}>Command Center</h1>
          <p className={styles.moduleSubtitle}>{creds?.apiUrl} · {agents.length} agents · {openIssues.length} open</p>
        </div>
        <div className={pp.topActions}>
          <button className={pp.refreshBtn} onClick={() => creds && fetchAll(creds)} disabled={refreshing}>↻ Refresh</button>
          <button className={pp.disconnectBtn} onClick={handleDisconnect}>Disconnect</button>
        </div>
      </div>

      <div className={pp.statsRow}>
        {[
          { val: agents.length, lbl: "Agents" },
          { val: liveCount, lbl: "Live", color: liveCount > 0 ? "var(--success)" : undefined },
          { val: openIssues.length, lbl: "Open Issues" },
          { val: issues.filter(i => i.status === "blocked").length, lbl: "Blocked", color: issues.filter(i => i.status === "blocked").length > 0 ? "var(--danger)" : undefined },
          { val: projects.length, lbl: "Projects" },
        ].map(s => (
          <div key={s.lbl} className={pp.stat}>
            <span className={pp.statVal} style={s.color ? { color: s.color } : {}}>{s.val}</span>
            <span className={pp.statLbl}>{s.lbl}</span>
          </div>
        ))}
      </div>

      <div className={pp.tabs}>
        {(["agents", "issues", "projects"] as const).map(t => (
          <button key={t} className={`${pp.tab} ${tab === t ? pp.tabActive : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "agents" && (
        <div className={pp.orgWrap}>
          {agents.length === 0
            ? <div className={styles.placeholder}>No agents found.</div>
            : <div className={pp.orgTree}>{roots.map(renderTree)}</div>
          }
        </div>
      )}

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
