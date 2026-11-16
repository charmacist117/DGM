import ANNEX from "./annex.json";
import {chapters,assess,fieldOptions,regimen,basisNames,physical,isOral,fmt,normal,sourceFor,ratioLabel,spanLabel} from "./rules.mjs";
import {matchSupplyIngredients} from "./supplyImport.mjs";
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
  const statusText={pass:'충족',fail:'기준 이탈',manual:'추가 확인','ref-fail':'환산 참고 하한 미만','ref-pass':'환산 참고 충족',none:'별도 수치 없음'};
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

  const groupLabel=r=>[r.group,r.item?r.item+'항':''].filter(Boolean).join(' ');
  const rowSummary=r=>Object.entries(r.values).map(([key,d])=>
    (basisNames[key]??key)+' '+d.raw+(d.unit&&!d.raw.includes(d.unit)?' ['+d.unit+']':'')).join(' · ');

  function renderIngredients() {
    const {n,form,variant,rows}=state();
    byId('example').hidden=n!==1;
    if(!rows.length) {
      byId('ingredients').innerHTML=empty('이 장의 성분표에서 검토할 유효성분을 추가하세요.');
      return;
    }
    byId('ingredients').innerHTML=rows.map((r,index)=>{
      const key=String(index);
      const modes=['herb','powder'].filter(k=>r.values[k]&&!r.values[k].excluded);
      const source='표 '+r.table+(r.group?' · '+groupLabel(r):'');
      const metadata='<div class="entry-title">'+esc(r.name)+'</div><div class="entry-meta">'+esc(source+' · '+rowSummary(r))+'</div>'+(r.sourceText?'<div class="entry-meta">공급조건 '+esc(r.sourceText)+'</div>':'');
      const primary=[4,6].includes(n)?select('primary-'+key,'배합 역할',[[1,'유효주성분'],[0,'유효부성분']],r.primary?1:0):'';
      const mode=modes.length>1?select('basis-'+key,'원료 기준',modes.map(k=>[k,k==='herb'?'원생약·엑스 환산':'분말']),r.basis??modes[0]):'';
      const fields=fieldOptions(n,r,form,variant).map(({key:field,label,unit})=>number('val-'+key+'-'+field,label+' ('+unit+')',r.entries[field]??'')).join('');
      return '<div class="entry"><div>'+metadata+'</div><div class="entry-fields">'+primary+mode+fields+'</div><button class="remove" type="button" data-remove="'+key+'" aria-label="'+esc(r.name)+' 삭제">삭제</button></div>';
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
    const q=normal(byId(picker?'pickerSearch':'catalogSearch').value);
    const {rows}=state();
    const matches=annex().ingredients.filter(r=>normal(r.name+' '+groupLabel(r)+' '+r.group+'란 '+r.group+'항').includes(q));
    const markup=matches.map(r=>{
      const present=rows.some(x=>x.id===r.id);
      return '<tr><td><strong>'+esc(r.name)+'</strong><small>표 '+r.table+(r.group?' · '+esc(groupLabel(r)):'')+'</small></td><td>'+esc(rowSummary(r))+'</td><td><button type="button" class="secondary" data-add="'+esc(r.id)+'"'+(present?' disabled':'')+' aria-label="'+esc(r.name)+' 추가">'+(present?'추가됨':'추가')+'</button></td></tr>';
    }).join('');
    byId(picker?'pickerRows':'catalogRows').innerHTML=matches.length?table(['성분','별표 분량','배합'],markup,'catalog-table'):empty('일치하는 성분이 없습니다.');
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
    if(model.rows.some(r=>r.id===id)||!entry) return;
    model.rows.push({...entry, entries:{}, primary:!model.rows.some(r=>r.primary)});
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
      const src=annex().ingredients.find(r=>r.name===x.name&&sourceFor(chapterNo,r)===x.ref);
      const min=Number.isFinite(x.min)?resultCell(true,x.min,x.minState,x.unit)
        :Number.isFinite(x.inferred)?resultCell(true,x.inferred,x.minState,x.unit)+'<small>성인 하한 × 연령 계수</small>'
        :x.minState==='manual'?badge('manual'):'—';
      return '<tr><td><strong>'+esc(x.name)+'</strong><small>'+esc(x.label)+'</small></td><td>'+esc(amount(x.value,x.unit))+'</td><td>'+min+'</td><td>'+
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
      const groups=new Map();
      for(const check of profile.checks) {
        const key=JSON.stringify([check.blocked,check.values]);
        const group=groups.get(key);
        if(group) group.last=check.age+1;
        else groups.set(key,{first:check.age,last:check.age+1,values:check.values,blocked:check.blocked});
      }
      const content=[...groups.values()].map(g=>'<h3>'+esc(g.last===g.first+1?'만 '+g.first+'세':spanLabel(g.first,g.last))+'</h3>'+
        (g.blocked?'<p class="issue">'+esc(g.blocked)+'</p>':'')+quantitiesTable(g.values,true)).join('');
      return '<details><summary>'+esc(profile.label+' · '+spanLabel(profile.first,profile.last)+' 성분별 분량')+'</summary>'+content+'</details>';
    }).join('');
    return '<h3>연령별 용법</h3><p class="hint">'+esc(intro)+'</p>'+table(headers,result,'profile')+'<p class="hint">'+esc(foot)+'</p>'+details;
  }

  function showResults(result,input) {
    const {status,issues,quantities,profiles}=result;
    const summary=status==='pass'?'자동 확인 항목 충족':status==='fail'?'입력 조합에 기준 이탈 있음':'원문 추가 확인 필요';
    const notes=issues.map(i=>'<div class="issue">'+badge(i.severity)+' <b>'+esc(i.message)+'</b><small>'+esc(i.ref)+'</small></div>').join('');
    byId('results').innerHTML='<div class="summary"><h2>검토 결과</h2>'+badge(status,summary)+'</div>'+
      '<p class="muted">'+esc(input.form)+(input.variant?' · '+esc(input.variant):'')+(input.freq?' · 1일 최대 '+input.freq+'회':'')+'</p>'+
      notes+'<h3>'+ (isOral(input.n)?'성인 배합과 분량':'제형별 배합과 분량')+'</h3>'+quantitiesTable(quantities)+profilesMarkup(input,profiles);
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
    const result=assess({...input,perDose:+input.perDose,increment:+input.increment,diameter:+input.diameter});
    if(input.importSummary?.pending.length) {
      if(result.status==='pass') result.status='manual';
      result.issues.push({severity:'manual',message:'가져오기 목록에서 성분표와 대조할 항목이 남아 있습니다.',ref:'DGM 공급조건'});
    }
    showResults(result,input);
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
