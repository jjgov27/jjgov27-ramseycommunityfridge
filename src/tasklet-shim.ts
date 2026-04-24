// This shim replaces Tasklet's built-in sqlExec/sqlQuery with HTTP API calls
// So all existing db.ts code works without any changes

declare global {
  interface Window {
    tasklet: {
      sqlExec: (sql: string) => Promise<void>;
      sqlQuery: (sql: string) => Promise<Record<string, unknown>[]>;
    };
  }
}

window.tasklet = {
  async sqlExec(sql: string): Promise<void> {
    const res = await fetch('/api/sql/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'SQL exec failed');
    }
  },

  async sqlQuery(sql: string): Promise<Record<string, unknown>[]> {
    const res = await fetch('/api/sql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'SQL query failed');
    }
    return res.json();
  },
};

export {};
