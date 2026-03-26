import { useEffect, useState } from "react";
import { load } from "@tauri-apps/plugin-store";
import styles from "../shared.module.css";
import opsStyles from "./OpsPanel.module.css";

interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

async function getStore() {
  return load("ops.bin", { defaults: {}, autoSave: true });
}
async function loadTasks(): Promise<Task[]> {
  const s = await getStore();
  const val = await s.get<Task[]>("tasks");
  return val ?? [];
}
async function saveTasks(tasks: Task[]) {
  const s = await getStore();
  await s.set("tasks", tasks);
}

export function OpsPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadTasks().then((t) => {
      // Seed defaults on first launch
      if (t.length === 0) {
        const defaults: Task[] = [
          { id: "1", text: "Set up Command Center", done: true, createdAt: Date.now() },
          { id: "2", text: "Connect agent OAuth (Claude + Gemini)", done: false, createdAt: Date.now() },
          { id: "3", text: "Finish CAEL TestFlight submission", done: false, createdAt: Date.now() },
          { id: "4", text: "Wire RevenueCat → CAEL metrics", done: false, createdAt: Date.now() },
        ];
        saveTasks(defaults);
        setTasks(defaults);
      } else {
        setTasks(t);
      }
      setLoaded(true);
    });
  }, []);

  function update(next: Task[]) {
    setTasks(next);
    saveTasks(next);
  }

  function addTask() {
    if (!newTask.trim()) return;
    update([
      ...tasks,
      { id: Date.now().toString(), text: newTask.trim(), done: false, createdAt: Date.now() },
    ]);
    setNewTask("");
  }

  function toggleTask(id: string) {
    update(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function deleteTask(id: string) {
    update(tasks.filter((t) => t.id !== id));
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h1 className={styles.moduleTitle}>Personal Ops</h1>
        <p className={styles.moduleSubtitle}>
          Tasks, notes, tools — your second brain
        </p>
      </div>

      <div className={opsStyles.layout}>
        {/* ── Task Board ── */}
        <div className={opsStyles.taskBoard}>
          <div className={opsStyles.taskBoardHeader}>
            <h2 className={styles.sectionTitle}>Task Board</h2>
            <span className={opsStyles.taskCount}>{open.length} open</span>
          </div>

          <div className={opsStyles.taskInput}>
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="New task…"
              className={opsStyles.input}
            />
            <button onClick={addTask} className={opsStyles.addBtn}>+</button>
          </div>

          {!loaded ? (
            <div className={opsStyles.empty}>Loading…</div>
          ) : (
            <div className={opsStyles.taskList}>
              {open.map((task) => (
                <div key={task.id} className={opsStyles.task}>
                  <button className={opsStyles.checkbox} onClick={() => toggleTask(task.id)} />
                  <span className={opsStyles.taskText}>{task.text}</span>
                  <button className={opsStyles.deleteBtn} onClick={() => deleteTask(task.id)}>×</button>
                </div>
              ))}
              {done.length > 0 && (
                <>
                  <div className={opsStyles.divider}>Completed · {done.length}</div>
                  {done.map((task) => (
                    <div key={task.id} className={`${opsStyles.task} ${opsStyles.done}`}>
                      <button className={`${opsStyles.checkbox} ${opsStyles.checked}`} onClick={() => toggleTask(task.id)}>✓</button>
                      <span className={opsStyles.taskText}>{task.text}</span>
                      <button className={opsStyles.deleteBtn} onClick={() => deleteTask(task.id)}>×</button>
                    </div>
                  ))}
                </>
              )}
              {tasks.length === 0 && (
                <div className={opsStyles.empty}>No tasks yet — add one above</div>
              )}
            </div>
          )}
        </div>

        {/* ── Tools ── */}
        <div className={opsStyles.tools}>
          <h2 className={styles.sectionTitle}>Tools</h2>
          <div className={opsStyles.toolGrid}>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>✏️</span>
              <span className={opsStyles.toolLabel}>Excalidraw</span>
              <span className={opsStyles.toolStatus}>v2</span>
            </button>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>📓</span>
              <span className={opsStyles.toolLabel}>Obsidian</span>
              <span className={opsStyles.toolStatus}>Connect vault</span>
            </button>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>🎤</span>
              <span className={opsStyles.toolLabel}>Voice Notes</span>
              <span className={opsStyles.toolStatus}>Whisper — v2</span>
            </button>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>📅</span>
              <span className={opsStyles.toolLabel}>Calendar</span>
              <span className={opsStyles.toolStatus}>v2</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
