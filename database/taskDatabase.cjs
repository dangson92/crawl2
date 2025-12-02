const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class TaskDatabase {
  constructor() {
    // Get user data directory
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'data');

    // Create directory if not exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'tasks.db');

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.initTables();
  }

  initTables() {
    // Create tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        error TEXT,
        created_at INTEGER NOT NULL,
        finished_at INTEGER,
        result_json TEXT
      )
    `);

    // Create logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_task ON task_logs(task_id);
    `);
  }

  /**
   * Save or update a task
   */
  saveTask(task) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (id, url, status, progress, error, created_at, finished_at, result_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = task.result ? JSON.stringify(task.result) : null;

    stmt.run(
      task.id,
      task.url,
      task.status,
      task.progress,
      task.error || null,
      task.createdAt,
      task.finishedAt || null,
      result
    );

    // Save logs if present
    if (task.logs && task.logs.length > 0) {
      this.saveLogs(task.id, task.logs);
    }

    return task.id;
  }

  /**
   * Save logs for a task
   */
  saveLogs(taskId, logs) {
    // Delete existing logs for this task
    const deleteStmt = this.db.prepare('DELETE FROM task_logs WHERE task_id = ?');
    deleteStmt.run(taskId);

    // Insert new logs
    const insertStmt = this.db.prepare(`
      INSERT INTO task_logs (task_id, timestamp, message, type)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((logs) => {
      for (const log of logs) {
        insertStmt.run(taskId, log.timestamp, log.message, log.type);
      }
    });

    insertMany(logs);
  }

  /**
   * Get a task by ID
   */
  getTask(taskId) {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `);

    const row = stmt.get(taskId);
    if (!row) return null;

    return this.rowToTask(row);
  }

  /**
   * Get all tasks
   */
  getAllTasks(limit = 1000, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(status, limit);
    return rows.map(row => this.rowToTask(row));
  }

  /**
   * Get logs for a task
   */
  getTaskLogs(taskId) {
    const stmt = this.db.prepare(`
      SELECT timestamp, message, type
      FROM task_logs
      WHERE task_id = ?
      ORDER BY timestamp ASC
    `);

    return stmt.all(taskId);
  }

  /**
   * Delete a task
   */
  deleteTask(taskId) {
    // Delete logs first
    const deleteLogsStmt = this.db.prepare('DELETE FROM task_logs WHERE task_id = ?');
    deleteLogsStmt.run(taskId);

    // Delete task
    const deleteTaskStmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = deleteTaskStmt.run(taskId);

    return result.changes > 0;
  }

  /**
   * Delete all tasks
   */
  deleteAllTasks() {
    this.db.exec('DELETE FROM task_logs');
    this.db.exec('DELETE FROM tasks');
  }

  /**
   * Get statistics
   */
  getStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error
      FROM tasks
    `);

    return stmt.get();
  }

  /**
   * Convert database row to Task object
   */
  rowToTask(row) {
    const task = {
      id: row.id,
      url: row.url,
      status: row.status,
      progress: row.progress,
      error: row.error,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      logs: this.getTaskLogs(row.id),
      result: row.result_json ? JSON.parse(row.result_json) : undefined,
    };

    return task;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = TaskDatabase;
