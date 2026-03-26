import { useState } from "react";
import styles from "../shared.module.css";
import opsStyles from "./OpsPanel.module.css";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

export function OpsPanel() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", text: "Set up command center", done: true },
    { id: "2", text: "Connect agent OAuth", done: false },
    { id: "3", text: "Finish CAEL beta launch", done: false },
  ]);
  const [newTask, setNewTask] = useState("");

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now().toString(), text: newTask, done: false }]);
    setNewTask("");
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  return (
    <div className={styles.module}>
      <div className={styles.moduleHeader}>
        <h1 className={styles.moduleTitle}>Personal Ops</h1>
        <p className={styles.moduleSubtitle}>
          Tasks, notes, whiteboard, and your second brain
        </p>
      </div>

      <div className={styles.grid}>
        {/* Task Board */}
        <div className={opsStyles.taskBoard}>
          <h2 className={styles.sectionTitle}>Task Board</h2>
          <div className={opsStyles.taskInput}>
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Add a task..."
              className={opsStyles.input}
            />
            <button onClick={addTask} className={opsStyles.addBtn}>
              +
            </button>
          </div>
          <div className={opsStyles.taskList}>
            {tasks.map((task) => (
              <div key={task.id} className={`${opsStyles.task} ${task.done ? opsStyles.done : ""}`}>
                <button
                  className={opsStyles.checkbox}
                  onClick={() => toggleTask(task.id)}
                >
                  {task.done ? "✓" : ""}
                </button>
                <span className={opsStyles.taskText}>{task.text}</span>
                <button
                  className={opsStyles.deleteBtn}
                  onClick={() => deleteTask(task.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick tools */}
        <div className={opsStyles.tools}>
          <h2 className={styles.sectionTitle}>Tools</h2>
          <div className={opsStyles.toolGrid}>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>✏️</span>
              <span className={opsStyles.toolLabel}>Excalidraw</span>
              <span className={opsStyles.toolStatus}>Coming soon</span>
            </button>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>📓</span>
              <span className={opsStyles.toolLabel}>Obsidian</span>
              <span className={opsStyles.toolStatus}>Connect vault</span>
            </button>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>🎤</span>
              <span className={opsStyles.toolLabel}>Voice Notes</span>
              <span className={opsStyles.toolStatus}>Whisper.cpp</span>
            </button>
            <button className={opsStyles.toolCard}>
              <span className={opsStyles.toolIcon}>📅</span>
              <span className={opsStyles.toolLabel}>Calendar</span>
              <span className={opsStyles.toolStatus}>Coming soon</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
