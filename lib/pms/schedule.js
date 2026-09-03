import { addDays, toStr } from "@/lib/pms/date";

export function calcSchedule(tasks, start) {
  const map = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const cache = {};

  function get(id) {
    if (cache[id]) return cache[id];
    const task = map[id];
    if (!task) {
      cache[id] = { start: toStr(start), end: toStr(start) };
      return cache[id];
    }

    const validPreds = (task.pred || []).filter((p) => map[p]);
    const plannedStart = validPreds.length === 0
      ? new Date(start)
      : validPreds.map((p) => new Date(get(p).end)).reduce((mx, d) => (d > mx ? d : mx));

    cache[id] = {
      start: toStr(plannedStart),
      end: toStr(addDays(plannedStart, task.duration || 1))
    };
    return cache[id];
  }

  tasks.forEach((t) => get(t.id));
  return cache;
}
