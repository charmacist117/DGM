import { addDays, diff, toStr } from "@/lib/pms/date";

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

function topoSort(tasks) {
  const visited = new Set();
  const result = [];
  const map = Object.fromEntries(tasks.map((t) => [t.id, t]));

  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    if (!map[id]) return;
    (map[id].pred || []).filter((p) => map[p]).forEach(visit);
    result.push(id);
  }

  tasks.forEach((t) => visit(t.id));
  return result;
}

export function applyDelay(tasks, targetId, delayDays) {
  const newTasks = tasks.map((t) => ({ ...t, pred: [...(t.pred || [])] }));
  const map = Object.fromEntries(newTasks.map((t) => [t.id, t]));
  if (!map[targetId]) return newTasks;

  map[targetId].scheduledEnd = toStr(addDays(map[targetId].scheduledEnd, delayDays));
  map[targetId].taskStatus = "delayed";

  topoSort(newTasks).forEach((id) => {
    const t = map[id];
    const validPreds = (t.pred || []).filter((p) => map[p]);
    if (validPreds.length === 0) return;

    const latestEnd = validPreds.map((p) => new Date(map[p].scheduledEnd)).reduce((mx, d) => (d > mx ? d : mx));
    const currentStart = new Date(t.scheduledStart);
    if (latestEnd <= currentStart) return;

    const shift = diff(toStr(currentStart), toStr(latestEnd));
    t.scheduledStart = toStr(latestEnd);
    t.scheduledEnd = toStr(addDays(t.scheduledEnd, shift));
    if (id !== targetId) t.taskStatus = "delayed";
  });

  return newTasks;
}

export function applyDurationChange(tasks, targetId, newDuration) {
  const newTasks = tasks.map((t) => ({ ...t, pred: [...(t.pred || [])] }));
  const map = Object.fromEntries(newTasks.map((t) => [t.id, t]));
  if (!map[targetId]) return newTasks;

  map[targetId].duration = newDuration;
  map[targetId].scheduledEnd = toStr(addDays(map[targetId].scheduledStart, newDuration));

  topoSort(newTasks).forEach((id) => {
    const t = map[id];
    const validPreds = (t.pred || []).filter((p) => map[p]);
    if (validPreds.length === 0) return;

    const latestEnd = validPreds.map((p) => new Date(map[p].scheduledEnd)).reduce((mx, d) => (d > mx ? d : mx));
    const currentStart = new Date(t.scheduledStart);
    if (latestEnd <= currentStart) return;

    const shift = diff(toStr(currentStart), toStr(latestEnd));
    t.scheduledStart = toStr(latestEnd);
    t.scheduledEnd = toStr(addDays(t.scheduledEnd, shift));
  });

  return newTasks;
}

export function applyStartDateChange(tasks, targetId, newStartDate) {
  const newTasks = tasks.map((t) => ({ ...t, pred: [...(t.pred || [])] }));
  const map = Object.fromEntries(newTasks.map((t) => [t.id, t]));
  if (!map[targetId]) return newTasks;

  map[targetId].scheduledStart = toStr(newStartDate);
  map[targetId].scheduledEnd = toStr(addDays(map[targetId].scheduledStart, map[targetId].duration || 1));

  topoSort(newTasks).forEach((id) => {
    if (id === targetId) return;
    const t = map[id];
    const validPreds = (t.pred || []).filter((p) => map[p]);
    if (validPreds.length === 0) return;

    const latestEnd = validPreds.map((p) => new Date(map[p].scheduledEnd)).reduce((mx, d) => (d > mx ? d : mx));
    t.scheduledStart = toStr(latestEnd);
    t.scheduledEnd = toStr(addDays(t.scheduledStart, t.duration || 1));
  });

  return newTasks;
}
