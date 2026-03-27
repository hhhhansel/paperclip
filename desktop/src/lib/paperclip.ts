import { load } from "@tauri-apps/plugin-store";

// ── Credential storage ───────────────────────────────────────────────────
export interface PaperclipCreds {
  apiUrl: string;
  apiKey: string;
  companyId: string;
}

async function credsStore() {
  return load("paperclip-creds.bin", { defaults: {}, autoSave: true });
}

export async function saveCreds(creds: PaperclipCreds) {
  const s = await credsStore();
  await s.set("creds", creds);
}

export async function loadCreds(): Promise<PaperclipCreds | null> {
  const s = await credsStore();
  const v = await s.get<PaperclipCreds>("creds");
  return v ?? null;
}

export async function clearCreds() {
  const s = await credsStore();
  await s.delete("creds");
}

// ── API client ───────────────────────────────────────────────────────────
class PaperclipClient {
  private creds: PaperclipCreds | null = null;

  setCreds(c: PaperclipCreds) { this.creds = c; }

  private get headers() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.creds?.apiKey ?? ""}`,
    };
  }

  private url(path: string) {
    const base = (this.creds?.apiUrl ?? "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    return res.json();
  }

  get = <T>(path: string) => this.req<T>("GET", path);
  post = <T>(path: string, body: unknown) => this.req<T>("POST", path, body);
  patch = <T>(path: string, body: unknown) => this.req<T>("PATCH", path, body);
}

export const api = new PaperclipClient();

// ── Types ────────────────────────────────────────────────────────────────
export interface Agent {
  id: string;
  name: string;
  role: string;
  urlKey: string;
  status?: "active" | "idle" | "error";
  model?: string;
  managerId?: string | null;
  companyId: string;
  isLive?: boolean;
}

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  status: string;
  progress?: number;
}

export interface Project {
  id: string;
  name: string;
  urlKey: string;
  status?: string;
}

export interface DashboardData {
  liveAgents?: number;
  openIssues?: number;
  goals?: Goal[];
  recentActivity?: Issue[];
}

// ── API helpers ──────────────────────────────────────────────────────────
export async function getMe() {
  return api.get<Agent>("/api/agents/me");
}

export async function getAgents(companyId: string) {
  return api.get<{ agents: Agent[] }>(`/api/companies/${companyId}/agents`);
}

export async function getDashboard(companyId: string) {
  return api.get<DashboardData>(`/api/companies/${companyId}/dashboard`);
}

export async function getInbox() {
  return api.get<{ issues: Issue[] }>("/api/agents/me/inbox-lite");
}

export async function getIssues(companyId: string, params: string = "") {
  return api.get<{ issues: Issue[] }>(`/api/companies/${companyId}/issues${params}`);
}

export async function getProjects(companyId: string) {
  return api.get<{ projects: Project[] }>(`/api/companies/${companyId}/projects`);
}
