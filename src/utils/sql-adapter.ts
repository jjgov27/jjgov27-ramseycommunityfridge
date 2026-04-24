// SQL adapter - detects environment and routes to Tasklet bridge or Render API

const isTasklet = typeof window !== 'undefined' && !!(window as any).tasklet?.sqlExec;

async function apiExec(sql: string): Promise<void> {
  const res = await fetch('/api/sql/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'SQL exec failed');
  }
}

async function apiQuery(sql: string): Promise<Record<string, unknown>[]> {
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
}

export async function sqlExec(sql: string): Promise<void> {
  if (isTasklet) {
    await (window as any).tasklet.sqlExec(sql);
  } else {
    await apiExec(sql);
  }
}

export async function sqlQuery(sql: string): Promise<Record<string, unknown>[]> {
  if (isTasklet) {
    return (window as any).tasklet.sqlQuery(sql);
  } else {
    return apiQuery(sql);
  }
}
