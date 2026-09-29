import { useMemo } from 'react';
import { baseProjects } from '../data/expenses';
import { uniq } from '../lib/format';
import { useApp } from './AppState';

/** Projects and orders of the active company, including ones created in this session. */
export function useProjects() {
  const { co, expenses, edits, setEdits } = useApp();
  const list = useMemo(
    () => uniq([...baseProjects(co.id), ...(edits.projects[co.id] || []), ...expenses.map((e) => e.proj).filter(Boolean)]),
    [co.id, edits.projects, expenses],
  );
  const add = (name: string) =>
    setEdits((s) => ({ ...s, projects: { ...s.projects, [co.id]: uniq([...(s.projects[co.id] || []), name]) } }));
  return { list, add };
}
