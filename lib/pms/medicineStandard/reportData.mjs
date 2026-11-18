import { assess } from "./rules.mjs";

export const statusText = {
  pass: "충족",
  fail: "기준 이탈",
  manual: "추가 확인",
  "ref-fail": "환산 참고 하한 미만",
  "ref-pass": "환산 참고 충족",
  none: "별도 수치 없음",
};

export function assessReview(input) {
  const result = assess(input);
  if (input.importSummary?.pending.length) {
    if (result.status === "pass") result.status = "manual";
    result.issues.push({ severity: "manual", message: "가져오기 목록에서 성분표와 대조할 항목이 남아 있습니다.", ref: "DGM 공급조건" });
  }
  return result;
}

export function reviewAlternatives(input, result) {
  const sections = [
    { title: "가능한 방안", frequencies: [], profiles: [] },
    { title: "추가 확인 방안", frequencies: [], profiles: [] },
    { title: "기준을 벗어난 방안", frequencies: [], profiles: [] },
  ];

  if (input.n === 4 && input.rows.some(row => row.group === "IV")) {
    for (const freq of [1, 2, 3]) {
      const candidate = freq === input.freq ? result : assessReview({ ...input, freq });
      const allowed = candidate.rule.counts.includes(freq);
      const section = sections[!allowed || candidate.status === "fail" ? 2 : candidate.status === "manual" ? 1 : 0];
      section.frequencies.push({ ...candidate, freq, allowed });
    }
  }

  for (const profile of result.profiles) {
    const blocked = !profile.exact || profile.ageStatus === "fail" || profile.minStatus === "fail" || result.status === "fail";
    const pending = result.status === "manual" || profile.ageStatus === "manual" || ["manual", "ref-fail"].includes(profile.minStatus);
    sections[blocked ? 2 : pending ? 1 : 0].profiles.push(profile);
  }
  return sections;
}

export function ageCheckRanges(checks) {
  const ranges = [];
  let previous;
  for (const check of checks) {
    const key = JSON.stringify([check.blocked, check.values]);
    if (key === previous) ranges.at(-1).last = check.age + 1;
    else ranges.push({ first: check.age, last: check.age + 1, values: check.values, blocked: check.blocked });
    previous = key;
  }
  return ranges;
}
