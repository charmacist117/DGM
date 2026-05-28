export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export const toStr = (d) => new Date(d).toISOString().split("T")[0];

export const fmt = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export const diff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

export const TODAY = toStr(new Date());
