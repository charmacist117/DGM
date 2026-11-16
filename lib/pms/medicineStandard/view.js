export const markup = `
<div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header"><strong>별표 1</strong><span>2026. 8. 6. 시행</span></div>
      <nav id="chapters" aria-label="장 선택"></nav>
    </aside>
    <div class="review-main">
      <label class="mobile-chapter" for="mobileChapter">장 선택<select id="mobileChapter"></select></label>
      <div class="heading">
        <div><div class="eyebrow" id="chapterIndex"></div><h1 id="chapterTitle"></h1></div>
        <div class="heading-actions"><a class="version" href="https://law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000283720" target="_blank" rel="noopener">고시 제2026-57호 ↗</a><button type="button" class="secondary" id="sourceButton">기준 원문</button></div>
      </div>
      <div class="tabs" role="group" aria-label="작업 화면">
        <button type="button" aria-pressed="true" data-tab="review">배합·용법 검토</button>
        <button type="button" aria-pressed="false" data-tab="catalog">허용 성분표 <span id="catalogCount"></span></button>
      </div>
      <section id="review"><div id="importSummary" aria-live="polite" hidden></div>
        <form id="reviewForm">
          <section class="card settings">
            <div class="card-heading"><div><h2>제형과 용법</h2><p id="settingsCaption"></p></div></div>
            <div class="fields" id="settingsFields"></div>
            <p id="regimen" class="info"></p>
          </section>
          <section class="card">
            <div class="card-heading">
              <div><h2>유효성분 구성</h2><p id="ingredientInstruction"></p></div>
              <div class="actions"><button class="text-button" type="button" id="example">예시 입력</button><button class="secondary" type="button" id="choose">＋ 성분 추가</button></div>
            </div>
            <p class="hint" id="roleHelp" hidden><strong>유효주성분</strong>은 제제의 표방 효능과 적용할 용법의 근거가 됩니다. <strong>유효부성분</strong>은 주성분에 함께 배합하며, 성분별 배합 한도와 조합 조건이 적용됩니다.</p>
            <div id="ingredients"></div>
            <div class="form-footer"><button type="button" class="text-button" id="reset">초기화</button><button class="primary" type="submit">배합·용법 검토 <span aria-hidden="true">→</span></button></div>
          </section>
        </form>
        <section class="card result" id="results" aria-live="polite" tabindex="-1">
          <h2>검토 결과</h2><p class="muted">제형과 유효성분을 입력해 검토를 시작하세요.</p>
        </section>
      </section>
      <section id="catalog" class="card" hidden>
        <div class="card-heading"><div><h2>허용 성분표</h2><p>별표의 성분별 분량과 표시 단위를 조회하고 배합에 추가할 수 있습니다.</p></div></div>
        <label class="search">성분명·분류명·항목 검색<input id="catalogSearch" type="search" placeholder="예: 스코폴리아 제산제, Ⅰ란"></label>
        <div id="catalogRows"></div>
      </section>
      <footer>시험성적서, 표시 문구와 품목허가·신고 요건은 고시 원문에서 확인하세요.</footer>
    </div>
  </div>
  <dialog id="picker" aria-labelledby="pickerTitle">
    <div class="dialog-heading"><div><h2 id="pickerTitle">유효성분 추가</h2><p id="pickerCaption"></p></div><button type="button" class="secondary" data-close="picker">닫기</button></div>
    <label class="search">성분명·분류명·항목 검색<input id="pickerSearch" type="search" placeholder="예: 스코폴리아 진통진경제" autofocus></label>
    <div id="pickerRows"></div>
  </dialog>
  <dialog id="source" aria-labelledby="sourceTitle">
    <div class="dialog-heading"><div><h2 id="sourceTitle">별표 1 기준 원문</h2><p id="sourceCaption"></p></div><button type="button" class="secondary" data-close="source">닫기</button></div>
    <div id="sourceBody"></div>
  </dialog>
`;

export const css = `
:host {display:block;
  color-scheme: light;
  --ink:#17262c; --sub:#52656b; --line:#dbe4e5; --panel:#fff;
  --bg:#f4f7f7; --teal:#075e57; --teal-deep:#064d47; --mint:#e6f3ef;
  --fail:#992f22; --fail-bg:#fceeea; --warn:#795109; --warn-bg:#fff3d7;
  font: 15px/1.55 Inter,"맑은 고딕","Malgun Gothic",system-ui,sans-serif;
}
* {box-sizing:border-box}
.layout {background:var(--bg);color:var(--ink);border-radius:12px;overflow:clip;border:1px solid var(--line)}
h1,h2,h3,p {margin:0}
h1 {font-size:clamp(25px,3.2vw,39px); letter-spacing:-.075em; line-height:1.2}
h2 {font-size:18px; letter-spacing:-.04em}
h3 {font-size:15px; letter-spacing:-.025em}
a {color:var(--teal);text-underline-offset:3px}
button,input,select {font:inherit}
button {cursor:pointer}
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, a:focus-visible {outline:3px solid #1c887e; outline-offset:2px}
button[disabled] {cursor:default; opacity:.55}
input,select {min-width:0;width:100%;height:42px;padding:7px 10px;color:var(--ink);background:#fff;border:1px solid #bfcdd0;border-radius:7px}
input[type=checkbox] {width:17px;height:17px}

.version {border:1px solid var(--line);padding:6px 12px;border-radius:999px;color:var(--sub);text-decoration:none;font-size:12px;white-space:nowrap}
.version:hover {border-color:var(--teal);color:var(--teal)}
.layout {max-width:1440px;margin:0 auto;display:grid;grid-template-columns:230px minmax(0,1fr);min-height:550px}
.sidebar {border-right:1px solid var(--line);padding:28px 14px 28px 16px;background:#f9fbfa}
.sidebar-header {padding:0 10px 13px;display:flex;align-items:baseline;justify-content:space-between}
.sidebar-header span {color:var(--sub);font-size:11px}
#chapters {display:grid;gap:2px}
#chapters button {display:grid;grid-template-columns:38px 1fr;gap:5px;border:1px solid transparent;text-align:left;padding:7px 10px;border-radius:7px;background:none;color:var(--sub);font-size:13px;font-weight:630}
#chapters button span {font-size:11px;color:var(--sub);align-self:center}
#chapters button:hover {background:#edf3f2}
#chapters button[aria-current=true] {background:var(--mint);color:var(--teal-deep);border-color:#c7e3da}
.review-main {min-width:0;padding:29px clamp(18px,3.5vw,55px) 18px}
.mobile-chapter {display:none}
.heading {display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}
.heading h1 {margin-top:5px}
.eyebrow {color:var(--teal);font-size:12px;font-weight:730;letter-spacing:.015em}
.tabs {display:flex;gap:22px;border-bottom:1px solid var(--line);margin-bottom:19px}
.tabs button {border:0;border-bottom:2px solid transparent;background:transparent;color:var(--sub);padding:7px 1px 10px;font-weight:650}
.tabs button[aria-pressed=true] {border-color:var(--teal);color:var(--teal)}
.tabs span {display:inline-block;font-size:11px;font-weight:650;background:#e8eeed;color:var(--sub);padding:0 6px;border-radius:5px;margin-left:4px}
.card {border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:19px 21px;margin-bottom:14px;box-shadow:0 1px 2px #182b3010}
.card-heading,.dialog-heading {display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:13px}
.card-heading p,.dialog-heading p,.muted {color:var(--sub);font-size:13px;margin-top:3px}
.fields {display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(min(145px,100%),1fr))}
.field,.search {display:grid;gap:4px;color:var(--sub);font-size:12px;font-weight:680}
.field.check {display:flex;align-items:center;align-self:end;height:42px}
.fields input,.fields select {font-size:14px}
.info {padding:9px 12px;margin-top:12px;background:#eff6f4;border-radius:6px;color:#295c55;font-size:12px}
.secondary,.primary,.text-button {padding:7px 12px;border-radius:7px;font-weight:720;white-space:nowrap;min-height:36px}
.secondary {border:1px solid #c9d7d8;background:white;color:var(--teal-deep)}
.secondary:hover,.text-button:hover {background:var(--mint)}
.primary {border:1px solid var(--teal);background:var(--teal);color:#fff}
.primary:hover {background:var(--teal-deep)}
.primary span {margin-left:8px}
.text-button {background:transparent;border:1px solid transparent;color:var(--teal)}
.actions {display:flex;gap:5px;flex-wrap:wrap}
.form-footer {display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding-top:13px;margin-top:13px}
.empty {border:1px dashed #bacacb;border-radius:8px;color:var(--sub);font-size:13px;text-align:center;padding:19px 12px;background:#fafcfb}
.entry {display:grid;grid-template-columns:minmax(180px,1.5fr) minmax(180px,1.2fr) auto;gap:12px;align-items:center;border-bottom:1px solid var(--line);padding:10px 0}
.entry:last-child {border-bottom:0}
.entry-title {font-size:14px;font-weight:750;overflow-wrap:anywhere}
.entry-fields {display:flex;align-items:end;gap:8px;flex-wrap:wrap}
.entry-fields label {flex:1;min-width:105px}
.entry-meta {font-size:11px;color:var(--sub);margin-top:1px}
.entry-category {font-size:12px;font-weight:700;color:var(--teal-deep)}
.entry-category:empty {display:none}
.role-comparison {margin:5px 0 0;padding:3px 0 0;border:0;min-width:185px}
.role-comparison summary {font-size:12px}
.role-comparison p {margin:3px 0 0;color:var(--sub)}
.dose-alternatives {background:#f5f8f7;border:1px solid var(--line);padding:8px 10px;border-radius:7px}
.remove {color:var(--fail);border:none;background:none;border-radius:5px;font-size:13px;padding:8px}
.remove:hover {background:var(--fail-bg)}
.result:focus {outline:none}
.result h3 {margin:15px 0 6px}
.status {display:inline-flex;width:max-content;max-width:100%;align-items:center;font-weight:730;font-size:11px;padding:3px 8px;line-height:1.5;border-radius:5px;background:#ebf0f0;color:var(--sub);white-space:nowrap}
.status.pass {color:var(--teal-deep);background:var(--mint)}
.status.fail {color:var(--fail);background:var(--fail-bg)}
.status.manual,.status.ref-fail {color:var(--warn);background:var(--warn-bg)}
.summary {display:flex;align-items:center;justify-content:space-between;gap:10px}
.issue {font-size:13px;margin-top:7px;padding:8px 10px;border-radius:6px;background:#f5f8f7}
.issue b {margin-right:6px}
.issue small {color:var(--sub);white-space:normal}
table {width:100%;border-collapse:collapse;font-size:12px;text-align:left}
th,td {padding:8px 9px;border-bottom:1px solid var(--line);vertical-align:top}
th {background:#f2f6f5;white-space:nowrap;color:#3b555a;font-weight:740}
td small {display:block;color:var(--sub);margin-top:3px}
tr:last-child td {border-bottom:0}
.table-wrap {overflow:auto;border:1px solid var(--line);border-radius:7px}
.catalog-table {margin-top:10px}
.search {margin:2px 0 8px}
.search input {font-size:14px}
.hint {font-size:12px;color:var(--sub);margin:8px 0}
details {border-bottom:1px solid var(--line);margin:8px 0;padding:8px 0}
summary {cursor:pointer;color:var(--teal-deep);font-weight:700;font-size:13px}
details .table-wrap {margin:9px 0}
.profile tbody tr:last-child td {border-bottom:0}
.profile tbody td {border-bottom:1px solid var(--line)}
.profile td:first-child {font-weight:700}
footer {margin:15px 0;color:var(--sub);font-size:11px}
dialog {border:1px solid var(--line);border-radius:12px;padding:18px 21px;width:min(960px,calc(100% - 26px));max-height:88vh;color:var(--ink);box-shadow:0 10px 60px #27383b33}
dialog::backdrop {background:#18353870}
#sourceBody p {font-size:13px;margin:7px 0;overflow-wrap:anywhere}
#sourceBody details {padding:9px 0}
[hidden] {display:none!important}
@media(max-width:800px) {
  .layout {display:block}
  .sidebar {display:none}
  .mobile-chapter {display:grid;gap:4px;margin:0 0 15px;color:var(--sub);font-size:12px}


  .version {padding:5px 8px;font-size:10px}
  .review-main {padding:17px 13px}
  .card {padding:14px}
}
@media(max-width:520px) {
  .entry {grid-template-columns:1fr auto}
  .entry-fields {grid-row:2;grid-column:1/-1}
  .entry .remove {grid-column:2;grid-row:1}
  .card-heading .actions {justify-content:flex-end}


  th,td {padding:7px 8px}
}
.heading-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
#importSummary .issue{margin:0 0 11px}

`;
