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
  const [companyId, setCompanyId]   = useState("");
  const [agentId, setAgentId]       = useState("");
  const [agents, setAgents]         = useState<Array<{ id: string; name: string; urlKey: string }>>([]);
  const [fetching, setFetching]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [envOutput, setEnvOutput]   = useState("");
  const [error, setError]           = useState("");
  const [apiKey, setApiKey]         = useState("");

  // Try to auto-populate agents when company ID looks valid
  async function fetchAgents() {
    if (!companyId.trim()) { setError("Enter your Company ID first."); return; }
    setFetching(true); setError("");
    const res = await runCLI(["agent", "list", "--company-id", companyId.trim(), "--api-base", apiBase, "--json"]);
    if (res.ok) {
      try {
        const parsed = JSON.parse(res.stdout);
        const list = parsed.agents ?? parsed ?? [];
        const arr = Array.isArray(list) ? list : [];
        setAgents(arr);
        if (arr.length === 1) setAgentId(arr[0].id);
        else if (arr.length === 0) setError("No agents found — enter agent ID manually below.");
      } catch { setError("Couldn't parse agents — enter agent ID manually."); }
    } else {
      setError("CLI failed — enter agent ID manually below.");
    }
    setFetching(false);
  }

  async function generateKey() {
    const cid = companyId.trim();
    const aid = agentId.trim();
    if (!cid) { setError("Enter your Company ID."); return; }
    if (!aid) { setError("Enter your Agent ID."); return; }
    setGenerating(true); setError("");
    const res = await runCLI(["agent", "local-cli", aid, "--company-id", cid, "--api-base", apiBase]);
    if (res.ok) {
      // Try to extract key from JSON output, or just grab it from stdout
      const raw = res.stdout;
      try {
        const parsed = JSON.parse(raw);
        const key = parsed.apiKey ?? parsed.PAPERCLIP_API_KEY ?? parsed.key;
        if (key) { setApiKey(key); setEnvOutput(""); return; }
      } catch {}
      // Non-JSON — look for a key-like value in the output
      const match = raw.match(/PAPERCLIP_API_KEY[=\s:]+([A-Za-z0-9._-]{20,})/);
      if (match) { setApiKey(match[1]); setEnvOutput(""); return; }
      // Show raw output so user can copy-paste
      setEnvOutput(raw.slice(0, 600));
    } else {
      setError(res.stderr.slice(0, 300) || "Failed to generate API key.");
      if (res.stderr) setEnvOutput(res.stderr.slice(0, 300));
    }
    setGenerating(false);
  }

  async function connect() {
    const key = apiKey.trim();
    const cid = companyId.trim();
    if (!key) { setError("API key required."); return; }
    if (!cid) { setError("Company ID required."); return; }
    const creds: PaperclipCreds = { apiUrl: apiBase, apiKey: key, companyId: cid };
    api.setCreds(creds);
    try {
      await getAgents(cid);
      await saveCreds(creds);
      onConnect(creds);
    } catch { setError("Could not connect — check your API key and company ID."); }
  }

  return (
    <div className={pp.setupCard}>
      <div className={pp.setupStep}>
        <div className={pp.stepNum}>2</div>
        <div className={pp.stepContent}>
          <div className={pp.stepTitle}>Company ID</div>
          <div className={pp.stepDesc}>Find this in your Paperclip UI under Settings → Company.</div>
          <div className={pp.inputRow}>
            <input className={pp.input} value={companyId}
              onChange={e => { setCompanyId(e.target.value); setAgents([]); }}
              placeholder="e.g. my-company or UUID" />
            <button className={pp.stepBtnSmall} onClick={fetchAgents} disabled={fetching || !companyId.trim()}>
              {fetching ? "…" : "Fetch agents"}
            </button>
          </div>
        </div>
      </div>

      <div className={pp.setupDivider} />

      <div className={pp.setupStep}>
        <div className={pp.stepNum}>3</div>
        <div className={pp.stepContent}>
          <div className={pp.stepTitle}>Agent ID</div>
          <div className={pp.stepDesc}>Your agent's ID or URL key (e.g. <code style={{ fontFamily: "monospace", opacity: 0.7 }}>claudecoder</code>).</div>
          {agents.length > 0 && (
            <select className={pp.select} value={agentId} onChange={e => setAgentId(e.target.value)} style={{ marginBottom: 8 }}>
              <option value="">Select agent…</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.urlKey})</option>)}
            </select>
          )}
          <input className={pp.input} value={agentId}
            onChange={e => setAgentId(e.target.value)}
            placeholder={agents.length > 0 ? "Or paste agent ID manually…" : "Agent ID or URL key"} />
        </div>
      </div>

      <div className={pp.setupDivider} />

      <div className={pp.setupStep}>
        <div className={pp.stepNum}>4</div>
        <div className={pp.stepContent}>
          <div className={pp.stepTitle}>Get API key</div>
          <div className={pp.stepDesc}>Run this in your terminal (from the repo root):</div>
          <div className={pp.codeBlock} style={{ userSelect: "text" }}>
            pnpm run paperclipai agent local-cli {agentId.trim() || "<agent-id>"} --company-id {companyId.trim() || "<company-id>"}
          </div>
          <button className={pp.stepBtn} onClick={generateKey} disabled={generating || !companyId.trim() || !agentId.trim()}>
            {generating ? "Generating…" : "Generate API key for me"}
          </button>
          {envOutput && (
            <div className={pp.logBox}>
              <div className={pp.logLine} style={{ opacity: 0.6, fontSize: 10, marginBottom: 4 }}>
                Copy your PAPERCLIP_API_KEY from below:
              </div>
              <pre style={{ margin: 0, fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{envOutput}</pre>
            </div>
          )}
          <div className={pp.orDivider}>— or paste key directly —</div>
          <input className={pp.input} type="password" value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && connect()}
            placeholder="Paste API key…" />
        </div>
      </div>

      {error && <div className={pp.errorBox}>{error}</div>}

      <button className={pp.connectBtn} onClick={connect} disabled={!apiKey.trim() || !companyId.trim()}>
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
