import ANNEX from "./annex.json";
import {chapters,assess,adultSpecs,fieldOptions,regimen,basisNames,physical,isOral,fmt,normal,ratioLabel,spanLabel,categoryLabel,classificationRef,chapterFourPrimary,chapterFourClaims} from "./rules.mjs";
import {matchSupplyIngredients} from "./supplyImport.mjs";
import {ageCheckRanges,reviewAlternatives,statusText} from "./reportData.mjs";
import {downloadFile} from "../exporters";
import {css,markup} from "./view";

export function mountReview(root) {
  const listeners = new AbortController();
  const style = document.createElement('style');
  style.textContent = css;
  const template = document.createElement("template");
  template.innerHTML = markup;
  root.replaceChildren(style,template.content.cloneNode(true));
  const byId=id=>root.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options=(list,selected)=>list.map(item=>{
    const [id,label]=Array.isArray(item)?item:[item,item];
    return '<option value="'+esc(id)+'"'+(String(id)===String(selected)?' selected':'')+'>'+esc(label)+'</option>';
  }).join('');
  const select=(id,label,items,value)=>'<label class="field">'+esc(label)+'<select id="'+id+'">'+options(items,value)+'</select></label>';
  const number=(id,label,value,required=true)=>'<label class="field">'+esc(label)+'<input id="'+id+'" type="number" min="0" step="any" inputmode="decimal" value="'+esc(value)+'"'+(required?' required':'')+'></label>';
  const badge=(kind,label)=>'<span class="status '+esc(kind)+'">'+esc(label??statusText[kind])+'</span>';
  const amount=(value,unit)=>Number.isFinite(value)?fmt(value)+(unit==='%'?'%':unit?' '+unit:''):'—';
  const table=(headers,body,cls='')=>'<div class="table-wrap '+cls+'"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  const empty = message=>'<p class="empty">'+esc(message)+'</p>';
  const models=new Map();
  let chapterNo=1;
  let currentTab='review';

  function newModel(n) {
    const config=chapters[n-1];
    const form=config.forms[0];
    const variant=config.variants?.[0]??'';
    const counts=regimen(n,form,variant,[]).counts;
    return {n,form,variant,freq:counts?.includes(3)?3:counts?.[0]??null,perDose:'2',
      increment:physical(form)==='개'?'1':'0.1',adultAge:15,diameter:'',ring:false,rows:[]};
  }
  models.set(chapterNo,newModel(chapterNo));
  const state=()=>models.get(chapterNo);
  const annex=()=>ANNEX[chapterNo-1];
  const current=()=>chapters[chapterNo-1];

  function invalidate() {
    byId('results').innerHTML='<h2>검토 결과</h2><p class="muted">현재 구성의 배합과 용법을 검토할 수 있습니다.</p>';
  }

  function renderSettings() {
    const {n,form,variant,freq,perDose,increment,adultAge,diameter,ring,rows}=state();
    const config=current();
    const oralForm=isOral(n);
    const unit=physical(form);
    const rule=regimen(n,form,variant,rows);
    if(rule.counts&&!rule.counts.includes(freq)) state().freq=rule.counts.includes(3)?3:rule.counts[0];
    if(!rule.counts) state().freq=null;
    let html=select('formKind','제형',config.forms,form);
    if(config.variants) html+=select('variant',n===8?'제제 구분':'적용 방법',config.variants,variant);
    if(oralForm) html+=select('adultAge','성인 기준 연령',[[15,'만 15세부터'],[19,'만 19세부터']],adultAge);
    if(rule.counts) html+=select('frequency',oralForm?'1일 최대 복용 횟수':'1일 최대 적용 횟수',rule.counts.map(x=>[x,x+'회']),state().freq);
    if(oralForm) {
      html+=number('perDose','성인 1회량 ('+unit+')',perDose);
      html+=unit==='개'
        ?select('increment','최소 투여 단위',form==='캡슐제'?[[1,'1캡슐']]:[[1,'1개 · 분할 없음'],[.5,'½개 · 분할 가능'],[.25,'¼개 · 분할 가능']],increment)
        :number('increment','최소 계량 단위 ('+unit+')',increment);
    }
    if(['추어블정','트로키제','경구용젤리제'].includes(form)) {
      html+=number('diameter','직경 (cm)',diameter,false)
        +'<label class="field check"><input type="checkbox" id="ring"'+(ring?' checked':'')+'> 도넛형</label>';
    }
    byId('settingsFields').innerHTML=html;
    byId('settingsCaption').textContent=oralForm?'성인 용법과 실제 계량·분할 가능한 단위를 입력하세요.':'제형과 적용 방법에 따라 원문에서 정한 횟수·분량 기준을 적용합니다.';
    const choices=rule.counts?'1일 허용 횟수 '+rule.counts.join(' · ')+'회':'';
    byId('regimen').textContent=[choices,rule.timing,rule.method].filter(Boolean).join(' / ');
    byId('ingredientInstruction').textContent=oralForm?'1'+unit+'당 함량을 성분표의 환산 기준과 단위로 입력하세요.':'각 성분의 배합농도 또는 제형별 1회 함량을 입력하세요.';
  }

  const identity=r=>[r.name,categoryLabel(r)||classificationRef(chapterNo,r)].join(' · ');
  const rowSummary=r=>Object.entries(r.values).map(([key,d])=>
    ({day:'1일 최대분량',single:'1회 최대분량',herb:'1일 최대 원생약·엑스 환산량',powder:'1일 최대 분말량'}[key]??basisNames[key]??key)+' '+
    (Number.isFinite(d.max)&&/^\d+(?:\.\d+)?\s*(?:mg|g|µg)?$/.test(d.raw)?amount(d.max,d.unit):
      d.raw+(d.unit&&!d.raw.includes(d.unit)?' ['+d.unit+']':''))).join(' · ');

  function chapterFourDose(r,rows,form,variant,freq) {
    const basis=fieldOptions(4,r,form,variant)[0].key;
    const limits=adultSpecs(4,{...r,basis},rows,form,variant,freq);
    const daily=limits.find(limit=>limit.basis===basis);
    const single=limits.find(limit=>limit.basis==='single');
    return [
      Number.isFinite(daily?.min)&&'1일 최소 배합 '+amount(daily.min,daily.unit),
      Number.isFinite(daily?.max)&&'1일 상한 '+amount(daily.max,daily.unit),
      Number.isFinite(single?.max)&&'1회 상한 '+amount(single.max,single.unit),
    ].filter(Boolean).join(' · ');
  }

  function roleComparison(r,expanded) {
    if(chapterNo!==4) return '';
    if(!chapterFourPrimary(r)) return '<small>유효부성분으로 배합</small>';
    const scopes=annex().effectScopes;
    const primary={...r,primary:true};
    const adjunct={...r,primary:false};
    const [scope]=chapterFourClaims([primary],scopes);
    const rule=regimen(4,'정제','',[primary]);
    const use=rule.counts.length===3?'1일 1~3회 · 2회 이상이면 4시간 이상 간격':'원칙적으로 1일 3회';
    const mainDose=chapterFourDose(primary,[primary],'정제','',3);
    const adjunctDose=chapterFourDose(adjunct,[adjunct],'정제','',3);
    const scat=r.name==='스코폴리아엑스';
    const exception=scat&&r.group==='VI'?'지사제 유효부성분으로 배합하는 경우 1일 상한 30 mg.':'';
    return '<details class="role-comparison"'+(expanded?' open':'')+'><summary>주·부성분 기준 비교</summary>'+
      '<p><strong>유효주성분</strong> · 고형제 '+esc(use)+'</p>'+
      '<p>'+esc(scope.blocked??scope.text)+'</p>'+
      (scat?'<p>'+esc(mainDose)+'</p>':'')+
      '<p><strong>유효부성분</strong> · 제제의 표방 효능과 복용 횟수는 유효주성분과 제형에 따릅니다.</p>'+
      (scat?'<p>'+esc(adjunctDose)+'</p>':'')+
      (exception?'<p>'+esc(exception)+'</p>':'')+'</details>';
  }

  function renderIngredients() {
    const {n,form,variant,rows}=state();
    byId('example').hidden=n!==1;
    byId('roleHelp').hidden=![4,6].includes(n)||!rows.length;
    if(!rows.length) {
      byId('ingredients').innerHTML=empty('이 장의 성분표에서 검토할 유효성분을 추가하세요.');
      return;
    }
    byId('ingredients').innerHTML=rows.map((r,index)=>{
      const key=String(index);
      const modes=['herb','powder'].filter(k=>r.values[k]&&!r.values[k].excluded);
      const dose=n===4&&chapterFourPrimary(r)?chapterFourDose(r,rows,form,variant,state().freq):'';
      const metadata='<div class="entry-title">'+esc(r.name)+'</div><div class="entry-category">'+esc(categoryLabel(r))+'</div>'+
        '<div class="entry-meta">'+esc(classificationRef(n,r)+' · '+rowSummary(r))+'</div>'+
        (dose?'<div class="entry-meta">'+esc((r.primary?'유효주성분':'유효부성분')+' 기준 · '+dose)+'</div>':'')+
        (r.sourceText?'<div class="entry-meta">공급조건 '+esc(r.sourceText)+'</div>':'');
      const roles=n===4&&!chapterFourPrimary(r)?[[0,'유효부성분']]:[[1,'유효주성분'],[0,'유효부성분']];
      const primary=[4,6].includes(n)?select('primary-'+key,'배합 역할',roles,r.primary?1:0):'';
      const mode=modes.length>1?select('basis-'+key,'원료 기준',modes.map(k=>[k,k==='herb'?'원생약·엑스 환산':'분말']),r.basis??modes[0]):'';
      const fields=fieldOptions(n,r,form,variant).map(({key:field,label,unit})=>number('val-'+key+'-'+field,label+' ('+unit+')',r.entries[field]??'')).join('');
      return '<div class="entry"><div>'+metadata+'</div><div class="entry-fields">'+primary+mode+fields+'</div><button class="remove" type="button" data-remove="'+key+'" aria-label="'+esc(identity(r)+' 삭제')+'">삭제</button></div>';
    }).join('');
  }

  function renderNav() {
    byId('chapters').innerHTML=chapters.map((c,i)=>'<button type="button" data-chapter="'+(i+1)+'" aria-current="'+(i+1===chapterNo)+'"><span>제'+(i+1)+'장</span>'+esc(c.name)+'</button>').join('');
    byId('mobileChapter').innerHTML=options(chapters.map((c,i)=>[i+1,'제'+(i+1)+'장 '+c.name]),chapterNo);
    byId('chapterIndex').textContent='별표 1 · 제'+chapterNo+'장';
    byId('chapterTitle').textContent=annex().title.replace(/^제\s*\d+\s*장\s+/,'').replace(/\s+표준제조기준$/,'').replace(/의$/,'');
    byId('catalogCount').textContent=annex().ingredients.length;
  }

  function renderCatalog(picker=false) {
    const terms=byId(picker?'pickerSearch':'catalogSearch').value.trim().split(/\s+/).filter(Boolean).map(normal);
    const {rows}=state();
    const matches=annex().ingredients.filter(r=>{
      const haystack=normal([r.name,categoryLabel(r),classificationRef(chapterNo,r),r.group+'란',r.group+'항'].join(' '));
      return terms.every(term=>haystack.includes(term));
    });
    const markup=matches.map(r=>{
      const present=rows.some(x=>x.id===r.id);
      const other=rows.some(x=>x.id!==r.id&&normal(x.name)===normal(r.name));
      const label=categoryLabel(r);
      return '<tr><td><strong>'+esc(r.name)+'</strong></td><td>'+
        (label?'<strong>'+esc(label)+'</strong><small>'+esc(classificationRef(chapterNo,r))+'</small>':esc(classificationRef(chapterNo,r)))+
        '</td><td>'+esc(rowSummary(r))+roleComparison(r,terms.length>0&&matches.length<=4)+'</td>'+
        '<td><button type="button" class="secondary" data-add="'+esc(r.id)+'"'+(present||other?' disabled':'')+' aria-label="'+esc(identity(r)+' 추가')+'">'+(present?'추가됨':other?'다른 분류 선택됨':'추가')+'</button></td></tr>';
    }).join('');
    byId(picker?'pickerRows':'catalogRows').innerHTML=matches.length?table(['성분','분류·근거','별표 분량·용법','배합'],markup,'catalog-table'):empty('일치하는 성분이 없습니다.');
  }

  function switchTab(tab) {
    currentTab=tab;
    byId('review').hidden=tab!=='review';
    byId('catalog').hidden=tab!=='catalog';
    root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
    if(tab==='catalog') renderCatalog();
  }

  function changeChapter(n) {
    chapterNo=n;
    if(!models.has(n)) models.set(n,newModel(n));
    byId('catalogSearch').value='';
    renderNav();
    renderSettings();
    renderIngredients();
    renderImportSummary();
    invalidate();
    switchTab(currentTab);
  }

  function addIngredient(id,picker) {
    const model=state();
    const entry=annex().ingredients.find(r=>r.id===id);
    if(!entry||model.rows.some(r=>normal(r.name)===normal(entry.name))) return;
    const primary=(chapterNo!==4||chapterFourPrimary(entry))&&!model.rows.some(r=>r.primary);
    model.rows.push({...entry, entries:{}, primary});
    renderSettings();
    renderIngredients();
    invalidate();
    if(picker) {
      byId('picker').close();
      byId('ingredients').querySelector('.entry:last-child input')?.focus();
    } else renderCatalog();
  }

  function renderSource(focusTable) {
    const body=byId('sourceBody');
    let idx=0, heading='';
    const renderBlocks=blocks=>blocks.map(block=>{
      if(typeof block==='string') {
        if(/^<표\s*\d+>/.test(block)) heading=block;
        return '<p>'+esc(block)+'</p>';
      }
      const id=++idx;
      const title=heading||'본문 표';
      heading='';
      const tableRows=block.rows.map(row=>'<tr>'+row.map(([,cols,rows,values])=>
        '<td colspan="'+cols+'" rowspan="'+rows+'">'+values.map(v=>typeof v==='string'?esc(v):renderBlocks([v])).join('<br>')+'</td>').join('')+'</tr>').join('');
      return '<details id="source-table-'+id+'"'+(id===focusTable?' open':'')+'><summary>'+esc(title)+'</summary><div class="table-wrap"><table><tbody>'+tableRows+'</tbody></table></div></details>';
    }).join('');
    byId('sourceCaption').textContent=annex().title+' · 식품의약품안전처고시 제2026-57호';
    body.innerHTML='<p><a href="https://mfds.go.kr/brd/m_207/view.do?seq=15185" target="_blank" rel="noopener">식품의약품안전처 개정고시 ↗</a></p>'+renderBlocks(annex().blocks);
    const dialog=byId('source');
    if(!dialog.open) dialog.showModal();
    dialog.scrollTop=0;
    if(focusTable) byId('source-table-'+focusTable)?.scrollIntoView({block:'start'});
  }

  const resultCell=(limit,value,kind,unit,exclusive=false)=>amount(value,unit)+(limit&&kind?' '+badge(kind,exclusive&&kind==='fail'?'상한 미만 조건 위반':undefined):'');
  function quantitiesTable(list,age=false) {
    const grouped=list.map(x=>{
      const src=annex().ingredients.find(r=>r.id===x.id);
      const min=Number.isFinite(x.min)?resultCell(true,x.min,x.minState,x.unit)
        :Number.isFinite(x.inferred)?resultCell(true,x.inferred,x.minState,x.unit)+'<small>성인 하한 × 연령 계수</small>'
        :x.minState==='manual'?badge('manual'):'—';
      return '<tr><td><strong>'+esc(x.name)+'</strong>'+(src&&categoryLabel(src)?'<small>'+esc(categoryLabel(src))+'</small>':'')+'<small>'+esc(x.label)+'</small></td><td>'+esc(amount(x.value,x.unit))+'</td><td>'+min+'</td><td>'+
        (x.maxState==='manual'?badge('manual'):resultCell(true,x.max,x.maxState,x.unit,x.exclusive))+
        (x.exclusive?'<small>표시값 미만</small>':'')+'</td><td>'+
        (src?'<button type="button" class="text-button" data-source-table="'+src.tableIndex+'">표 '+src.table+' 보기</button>':'')+
        (x.raw?'<small>'+esc(x.raw)+'</small>':'')+(x.note?'<small>'+esc(x.note)+'</small>':'')+'</td></tr>';
    }).join('');
    return table(['성분·기준',age?'연령 적용량':'입력 환산량','최소 배합','상한','근거'],grouped);
  }

  function profilesMarkup(input,profiles) {
    if(!profiles.length) return '';
    const {n,form,freq}=input;
    const oralForm=isOral(n);
    const result=profiles.map(profile=>{
      const unit=physical(form);
      const dose=oralForm?amount(profile.dose,unit):'입력 농도·1회량 유지';
      const blocked=[...new Set(profile.checks.map(c=>c.blocked).filter(Boolean))];
      return '<tr><td>'+esc(spanLabel(profile.first,profile.last))+' <small>'+esc(profile.label+(oralForm?' · 성인 '+ratioLabel(profile.ratio):''))+'</small></td><td>'+
        esc(dose)+(oralForm?'<small>1일 '+esc(amount(profile.dose*freq,unit))+' · 최대 '+freq+'회</small>':'')+'</td>'+
        (oralForm?'<td>'+badge(profile.exact?'pass':'fail',profile.exact?'구현 가능':'단위 불일치')+'</td>':'')+
        '<td>'+badge(profile.ageStatus)+(blocked.length?'<small>'+esc(blocked.join(' · '))+'</small>':'')+'</td><td>'+badge(profile.minStatus)+'</td></tr>';
    }).join('');
    const intro=oralForm?'성인과 같은 최대 복용 횟수로 1회량과 1일량에 배수를 적용합니다. ⅔를 현재 투여 단위로 구현할 수 없으면 ½ 대안을 표시합니다.':'같은 농도나 1회량을 사용할 때 대상 연령의 별도 상한을 대조합니다.';
    const foot=oralForm?'환산 참고 하한은 성인 하한에 연령 계수를 적용한 비교값입니다. 고시에 명시된 연령별 하한과 구분해 표시합니다. 성인 배합 또는 제형에 기준 이탈이 있으면 아래 계산값으로 그 이탈이 해소되지 않습니다.':'원문에 최대분량만 연령별로 규정된 항목은 최소량의 환산값을 참고로 표시합니다.';
    const headers=['만 나이','1회량·1일량',...(oralForm?['투여 단위']:[]),'연령 제한·상한','최소 배합'];
    const details=profiles.map(profile=>{
      const content=ageCheckRanges(profile.checks).map(g=>'<h3>'+esc(g.last===g.first+1?'만 '+g.first+'세':spanLabel(g.first,g.last))+'</h3>'+
        (g.blocked?'<p class="issue">'+esc(g.blocked)+'</p>':'')+quantitiesTable(g.values,true)).join('');
      return '<details><summary>'+esc(profile.label+' · '+spanLabel(profile.first,profile.last)+' 성분별 분량')+'</summary>'+content+'</details>';
    }).join('');
    return '<h3>연령별 용법</h3><p class="hint">'+esc(intro)+'</p>'+table(headers,result,'profile')+'<p class="hint">'+esc(foot)+'</p>'+details;
  }

  function claimsMarkup(input) {
    if(input.n!==4) return '';
    const scopes=chapterFourClaims(input.rows,annex().effectScopes);
    const rows=scopes.map(scope=>'<div class="issue"><strong>'+esc(scope.name)+'</strong> · '+
      esc(scope.blocked??scope.text)+(scope.note?'<p>'+esc(scope.note)+'</p>':'')+'</div>').join('');
    return '<h3>유효주성분 기준 효능·효과</h3>'+
      (rows||'<p class="muted">표방 범위를 확인하려면 해당 분류의 유효주성분을 지정하세요.</p>')+
      '<button class="text-button" type="button" data-source-table="13">표 4의 효능·효과 보기</button>';
  }

  function frequencyMarkup(options) {
    if(!options.length) return '';
    const rows=options.map(option=>{
      const values=option.quantities.filter(q=>q.label!=='1회량').map(q=>
        '<small>'+esc(q.name+' '+amount(q.value,q.unit))+'</small>').join('');
      const verdict=option.allowed?badge(option.status):badge('fail','횟수 범위 밖');
      const note=option.allowed?'':'<small>현재 주성분·제형은 1일 3회 기준을 적용합니다.</small>';
      return '<tr><td><strong>1일 '+option.freq+'회</strong></td><td>'+values+'</td><td>'+verdict+note+'</td></tr>';
    }).join('');
    return '<h3>정장제 포함 배합의 복용 횟수 비교</h3><p class="hint">성인 1회량을 유지해 계산합니다. 제4장은 원칙적으로 1일 3회입니다. 지사제·진통진경제가 유효주성분인 제제 또는 제산제·건위제가 유효주성분인 내용액제는 1~3회이며, 2회 이상이면 4시간 이상 간격을 둡니다.</p>'+
      table(['복용 횟수','성인 1일 배합량','검토 결과'],rows)+
      options.map(option=>'<details><summary>1일 '+option.freq+'회 성분별 분량과 기준</summary>'+quantitiesTable(option.quantities)+'</details>').join('');
  }

  function alternativesMarkup(input,sections) {
    const contents=section=>frequencyMarkup(section.frequencies)+profilesMarkup(input,section.profiles);
    const [possible,...other]=sections;
    const lower=other.map(section=>{
      const count=section.frequencies.length+section.profiles.length;
      return count?'<details class="dose-alternatives"><summary>'+esc(section.title)+' ('+count+')</summary>'+contents(section)+'</details>':'';
    }).join('');
    const emptyState=!possible.profiles.length&&!possible.frequencies.length&&lower
      ?'<p class="hint">현재 입력에서 바로 적용 가능한 방안을 확인하지 못했습니다. 아래 항목에서 사유를 볼 수 있습니다.</p>':'';
    return emptyState+contents(possible)+lower;
  }

  function showResults(result,input) {
    const {status,issues,quantities}=result;
    const summary=status==='pass'?'자동 확인 항목 충족':status==='fail'?'입력 조합에 기준 이탈 있음':'원문 추가 확인 필요';
    const notes=issues.map(i=>'<div class="issue">'+badge(i.severity)+' <b>'+esc(i.message)+'</b><small>'+esc(i.ref)+'</small></div>').join('');
    const sections=reviewAlternatives(input,result);
    byId('results').innerHTML='<div class="summary"><h2>검토 결과</h2><div class="actions">'+badge(status,summary)+
      '<button class="secondary" id="exportReview" type="button">엑셀 다운로드 (A4)</button></div></div><p id="exportStatus" class="hint" role="status" hidden></p>'+
      '<p class="muted">'+esc(input.form)+(input.variant?' · '+esc(input.variant):'')+(input.freq?' · 1일 최대 '+input.freq+'회':'')+'</p>'+
      notes+claimsMarkup(input)+'<h3>'+ (isOral(input.n)?'성인 배합과 분량':'제형별 배합과 분량')+'</h3>'+quantitiesTable(quantities)+alternativesMarkup(input,sections);
    const exportButton=byId('exportReview');
    const exportStatus=byId('exportStatus');
    const chapter=annex();
    exportButton.addEventListener('click',async()=>{
      exportButton.disabled=true;
      exportStatus.hidden=false;
      exportStatus.textContent='엑셀 파일을 만드는 중입니다.';
      try {
        const {reviewWorkbook}=await import("./reviewWorkbook.mjs");
        const data=await reviewWorkbook({input,result,chapter,sections});
        const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        downloadFile('표준제조기준_제'+input.n+'장_'+today+'.xlsx',data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        exportStatus.textContent='엑셀의 인쇄 미리보기에서 A4 가로 양식을 확인할 수 있습니다.';
      } catch {
        exportStatus.textContent='엑셀 파일을 만들지 못했습니다. 다시 시도하세요.';
      } finally {
        exportButton.disabled=false;
      }
    });
    byId('results').focus({preventScroll:true});
    byId('results').scrollIntoView({block:'start'});
  }

  root.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button) return;
    const {chapter,tab,close,add,remove,sourceTable}=button.dataset;
    if(chapter) changeChapter(+chapter);
    if(tab) switchTab(tab);
    if(close) byId(close).close();
    if(add) addIngredient(add,Boolean(button.closest('#picker')));
    if(sourceTable) renderSource(+sourceTable);
    if(remove!==undefined) {
      state().rows.splice(+remove,1);
      renderSettings();
      renderIngredients();
      invalidate();
    }
  },{signal:listeners.signal});
  byId('mobileChapter').addEventListener('change',event=>changeChapter(+event.target.value));
  byId('catalogSearch').addEventListener('input',()=>renderCatalog());
  byId('pickerSearch').addEventListener('input',()=>renderCatalog(true));
  byId('choose').addEventListener('click',()=>{
    byId('pickerSearch').value='';
    byId('pickerCaption').textContent=annex().title;
    renderCatalog(true);
    byId('picker').showModal();
    byId('picker').scrollTop=0;
  });
  byId('sourceButton').addEventListener('click',()=>renderSource());
  byId('reset').addEventListener('click',()=>{
    models.set(chapterNo,newModel(chapterNo));
    renderImportSummary();
    renderSettings();
    renderIngredients();
    invalidate();
  });
  byId('example').addEventListener('click',()=>{
    const model=newModel(1);
    model.rows=[['아스코르브산',30],['티아민염산염',2]].map(([name,value])=>({
      ...annex().ingredients.find(r=>r.name===name),entries:{day:value}
    }));
    model.freq=2;
    models.set(1,model);
    renderImportSummary();
    renderSettings();
    renderIngredients();
    invalidate();
  });
  byId('reviewForm').addEventListener('input',event=>{
    const model=state();
    const field=event.target;
    const [prefix,row,key]=field.id.split('-');
    if(prefix==='val') model.rows[row].entries[key]=field.value;
    else if(['perDose','increment','diameter'].includes(field.id)) model[field.id]=field.value;
    else if(field.id==='ring') model.ring=field.checked;
    else return;
    invalidate();
  });
  byId('reviewForm').addEventListener('change',event=>{
    const model=state();
    const {id,value}=event.target;
    if(id==='formKind') {
      // A supplier amount such as mg/정 cannot carry over to a new dosage form.
      for (const row of model.rows) {
        row.entriesByForm ??= {};
        row.entriesByForm[model.form] = row.entries;
        row.entries = row.entriesByForm[value] ?? {};
      }
      if(physical(model.form)!==physical(value)) {
        model.increment=physical(value)==='개'?'1':'0.1';
        model.perDose='2';
      }
      model.form=value;
      if(value==='캡슐제') model.increment='1';
      if(chapterNo===11) model.variant=value==='좌제'?current().variants[1]:current().variants[0];
    } else if(id==='variant') model.variant=value;
    else if(id==='frequency') model.freq=+value;
    else if(id==='adultAge') model.adultAge=+value;
    else if(id.startsWith('basis-')) model.rows[+id.split('-')[1]].basis=value;
    else if(id.startsWith('primary-')) model.rows[+id.split('-')[1]].primary=value==='1';
    else return;
    renderSettings();
    renderIngredients();
    invalidate();
    byId(id)?.focus();
  });
  byId('reviewForm').addEventListener('submit',event=>{
    event.preventDefault();
    const input=state();
    if(!input.rows.length) { byId('choose').click(); return; }
    const failed=[...event.currentTarget.querySelectorAll('input[type=number]')]
      .find(f=>f.value!==''&&(!Number.isFinite(+f.value)||+f.value<=0));
    if(failed) {
      failed.setCustomValidity('0보다 큰 숫자를 입력하세요.');
      failed.reportValidity();
      failed.setCustomValidity('');
      return;
    }
    const reviewInput={...input,perDose:+input.perDose,increment:+input.increment,diameter:+input.diameter};
    const result=assess(reviewInput);
    if(input.importSummary?.pending.length) {
      if(result.status==='pass') result.status='manual';
      result.issues.push({severity:'manual',message:'가져오기 목록에서 성분표와 대조할 항목이 남아 있습니다.',ref:'DGM 공급조건'});
    }
    showResults(result,reviewInput);
  });


  function renderImportSummary() {
    const summary = state().importSummary;
    const panel = byId('importSummary');
    panel.hidden = !summary;
    if (!summary) { panel.replaceChildren(); return; }
    panel.innerHTML = '<div class="issue"><strong>'+esc(summary.label)+'</strong>'+esc(' · '+summary.added+'종 추가')+
      (summary.pending.length?'<p>성분표에서 다시 선택할 항목</p><ul>'+summary.pending.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>':'')+'</div>';
  }

  changeChapter(1);
  return {
    destroy() {
      listeners.abort();
      root.replaceChildren();
    },
    importSupply(item) {
      const model=state();
      const reviewed=matchSupplyIngredients(chapterNo, model.form, model.variant, annex().ingredients, item.ingredients, model.rows);
      model.rows.push(...reviewed.added);
      model.importSummary={label:item.productName||item.manufacturer||'공급조건',added:reviewed.added.length,pending:reviewed.pending};
      renderSettings();
      renderIngredients();
      renderImportSummary();
      invalidate();
      switchTab('review');
    }
  };



}
