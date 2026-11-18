
const {test} = require('node:test');
const assert = require('node:assert/strict');
const ANNEX = require('../lib/pms/medicineStandard/annex.json');
const {assess,chapters,fieldOptions,regimen}=require('../lib/pms/medicineStandard/rules.mjs');
const ingredient=(n,name,entries)=>({...ANNEX[n-1].ingredients.find(row=>row.name===name),entries,primary:true});
function check(n,rows,changes={}) {
  const {forms,variants}=chapters[n-1];
  return assess({n,rows,form:forms[0],variant:variants?.[0]||'',freq:3,perDose:2,increment:1,adultAge:15,...changes});
}
test('every chapter and form produces a review with source-backed records',()=>{
  assert.equal(ANNEX.length,14);
  for(const [i,c] of chapters.entries()) {
    const n=i+1;
    assert.ok(ANNEX[i].ingredients.length);
    const raw=ANNEX[i].ingredients[0];
    assert.ok(raw.tableIndex);
    for(const form of c.forms) for(const variant of c.variants??['']) {
      const fields=fieldOptions(n,raw,form,variant);
      const rows=[{...raw,entries:Object.fromEntries(fields.map(f=>[f.key,1])),primary:true}];
      const freq=regimen(n,form,variant,rows).counts?.[0]??null;
      assert.doesNotThrow(()=>check(n,rows,{form,variant,freq}));
    }
  }
});
test('whole tablets require fallback when 2/3 cannot be measured, with explicit vitamin minimum checked separately',()=>{
  const rows=[ingredient(1,'아스코르브산',{day:30}),ingredient(1,'티아민염산염',{day:2})];
  const result=check(1,rows,{freq:2});
  assert.equal(result.status,'pass');
  assert.deepEqual(result.profiles.map(p=>[p.first,p.last,p.exact,p.minStatus]),[
    [8,11,true,'pass'],[11,15,false,'pass'],[8,15,true,'pass']
  ]);
  assert.equal(check(1,rows,{perDose:6}).profiles.length,2);
  rows[0].entries.day=20;
  const rejected=check(1,rows,{freq:2});
  assert.equal(rejected.status,'pass');
  assert.equal(rejected.profiles[2].minStatus,'fail');
  assert.equal(rejected.profiles[2].ageStatus,'pass');
});
test('fractions honor physical increment instead of rounding',()=>{
  const rows=[ingredient(1,'아스코르브산',{day:20}),ingredient(1,'티아민염산염',{day:2})];
  const result=check(1,rows,{form:'경구용 액제',perDose:7.5,increment:.5});
  assert.deepEqual(result.profiles.map(p=>p.exact),[false,true]);
});
test('chapter 2 checks explicit pediatric prohibition and combination rules',()=>{
  const rows=[ingredient(2,'아스피린',{day:200}),ingredient(2,'카페인무수물',{day:10})];
  const result=check(2,rows,{freq:1});
  assert.equal(result.status,'pass');
  assert.equal(result.profiles[0].ageStatus,'fail');
  assert.match(result.profiles[0].checks[0].blocked,/아스피린/);
  rows.push(ingredient(2,'이부프로펜',{day:100}));
  assert.match(check(2,rows,{freq:1}).issues.find(i=>/동시에/.test(i.message)).message,/이부프로펜/);
});
test('mineral ceiling shifts at 12, including mg to µg conversion',()=>{
  const rows=[ingredient(1,'셀레늄으로서',{day:160}),ingredient(1,'티아민염산염',{day:1})];
  const result=check(1,rows,{perDose:1,increment:.25,freq:1});
  assert.equal(result.profiles[1].checks[0].values.find(v=>v.name.includes('셀레늄')).max,150);
  assert.equal(result.profiles[1].checks[1].values.find(v=>v.name.includes('셀레늄')).max,200);
});
test('chapter 10 applies active-dependent spray frequency and age concentration caps',()=>{
  const rows=[ingredient(10,'자일로메타졸린염산염',{conc:.075})];
  const result=check(10,rows);
  assert.deepEqual(result.rule.counts,[1,2,3]);
  assert.equal(result.status,'pass');
  assert.equal(result.profiles[0].checks[0].values[0].max,.05);
  assert.equal(result.profiles[0].checks[4].values[0].max,.1);
});
test('chapter 13 applies both patch bases and forbids a dash in either column',()=>{
  const rows=[ingredient(13,'피록시캄',{patch100:.5,patchM:.5}),ingredient(13,'l-멘톨',{patch100:1.1,patchM:1.48})];
  const result=check(13,rows,{form:'첩부제',freq:2});
  assert.equal(result.quantities.filter(q=>q.name==='피록시캄'&&q.maxState==='fail').length,2);
  assert.equal(result.status,'fail');
});


test('DGM imports only an unambiguous amount for the selected form',()=>{
  const {matchSupplyIngredients}=require('../lib/pms/medicineStandard/supplyImport.mjs');
  const catalog=ANNEX[0].ingredients;
  const inputs=[
    {name:'아스코르브산',content:'0.03 g / 1정'},
    {name:'티아민염산염',content:'98%'},
    {name:'원료명 미확인',content:'1 mg/정'},
  ];
  const imported=matchSupplyIngredients(1,'정제','',catalog,inputs,[]);
  assert.equal(imported.added[0].entries.day,30);
  assert.deepEqual(imported.added[1].entries,{});
  assert.match(imported.pending[0],/원료명 미확인/);
  const mismatch=matchSupplyIngredients(1,'캡슐제','',catalog,inputs,[]);
  assert.deepEqual(mismatch.added[0].entries,{});
});

const { categoryLabel, classificationRef, adultSpecs, chapterFourClaims } = require('../lib/pms/medicineStandard/rules.mjs');
const { assessReview, reviewAlternatives } = require('../lib/pms/medicineStandard/reportData.mjs');
const chapterFour = ANNEX[3];
const scopolia = group => chapterFour.ingredients.find(row=>row.name==='스코폴리아엑스'&&row.group===group);

test('scopolia is identified by its statutory category and both maxima are in milligrams',()=>{
  const antacid={...scopolia('I'),primary:true};
  const antispasmodic={...scopolia('VI'),primary:true};
  assert.equal(classificationRef(4,antacid),'표 1 · Ⅰ란 3항목');
  assert.equal(categoryLabel(antispasmodic),'진통진경제 · 부교감신경차단제');
  assert.deepEqual([antacid,antispasmodic].map(r=>[r.values.day.max,r.values.day.unit]),[[30,'mg'],[60,'mg']]);
  assert.match(chapterFourClaims([antacid],chapterFour.effectScopes)[0].blocked,/표방할 수 없습니다/);
  assert.match(chapterFourClaims([antispasmodic],chapterFour.effectScopes)[0].text,/복통.*산통/);
  assert.deepEqual(regimen(4,'정제','',[antacid]).counts,[3]);
  assert.deepEqual(regimen(4,'정제','',[antispasmodic]).counts,[1,2,3]);
  const basis=fieldOptions(4,antispasmodic,'정제','')[0];
  assert.equal(basis.unit,'mg');
  const base = adultSpecs(4,antispasmodic,[antispasmodic],'정제','',3);
  assert.equal(base.find(limit=>limit.basis==='day').min,30);
  assert.equal(base.find(limit=>limit.basis==='single').max,20);
  const adjunct={...antispasmodic,primary:false};
  const caps=adultSpecs(4,adjunct,[adjunct,{group:'V',primary:true}],'정제','',3);
  assert.deepEqual(caps.filter(limit=>limit.basis==='day').map(limit=>[limit.min,limit.max,limit.unit]),[[12,30,'mg']]);
});

test('intestinal-regulator scenarios follow the actual active role and show the applicable frequency first',()=>{
  const probiotic={...chapterFour.ingredients.find(r=>r.group==='IV'&&r.item==='1'),entries:{day:600000},primary:true};
  const antacid={...scopolia('I'),entries:{day:4},primary:false};
  const input={n:4,form:'정제',variant:'',freq:3,perDose:2,increment:1,adultAge:15,rows:[probiotic,antacid]};
  const [possible,manual,blocked]=reviewAlternatives(input,assess(input));
  assert.deepEqual(possible.frequencies,[]);
  assert.deepEqual(manual.frequencies.map(option=>option.freq),[3]);
  assert.deepEqual(blocked.frequencies.map(option=>[option.freq,option.allowed]),[[1,false],[2,false]]);
  assert.deepEqual(blocked.frequencies.map(option=>option.quantities.find(q=>q.id===probiotic.id).value),[1200000,2400000]);
  const diarrhea={...chapterFour.ingredients.find(r=>r.group==='V'&&r.item==='2'),entries:{day:1},primary:true};
  const flexible={...input,perDose:1,rows:[{...probiotic,entries:{day:1000000},primary:false},diarrhea]};
  const verdict=assess(flexible);
  assert.deepEqual(verdict.rule.counts,[1,2,3]);
  assert.ok(!reviewAlternatives(flexible,verdict)[2].frequencies.some(option=>!option.allowed));
});

test('unresolved imports keep all otherwise valid alternatives in additional review',()=>{
  const probiotic={...chapterFour.ingredients.find(r=>r.group==='IV'&&r.item==='1'),entries:{day:600000},primary:true};
  const antacid={...scopolia('I'),entries:{day:4},primary:false};
  const input={n:4,form:'정제',variant:'',freq:1,perDose:2,increment:1,adultAge:15,rows:[probiotic,antacid],importSummary:{pending:['미확인 성분']}};
  const [possible,manual,blocked]=reviewAlternatives(input,assessReview(input));
  assert.deepEqual(possible.frequencies,[]);
  assert.deepEqual(manual.frequencies.map(option=>[option.freq,option.status]),[[3,'manual']]);
  assert.ok(manual.frequencies[0].issues.some(issue=>issue.ref==='DGM 공급조건'));
  assert.deepEqual(blocked.frequencies.map(option=>option.freq),[1,2]);
});

test('A4 workbook places possible results above blocked results and stores numeric doses',async()=>{
  const ExcelJS=require('exceljs');
  const {reviewWorkbook}=require('../lib/pms/medicineStandard/reviewWorkbook.mjs');
  const rows=[ingredient(1,'아스코르브산',{day:30}),ingredient(1,'티아민염산염',{day:2})];
  const input={n:1,form:'정제',variant:'',freq:2,perDose:2,increment:1,adultAge:15,rows};
  const result=assess(input);
  const bytes=await reviewWorkbook({input,result,chapter:ANNEX[0],sections:reviewAlternatives(input,result)});
  const roundtrip=new ExcelJS.Workbook();
  await roundtrip.xlsx.load(bytes);
  assert.deepEqual(roundtrip.worksheets.map(sheet=>sheet.name),['검토 요약','성분별 분량']);
  for (const sheet of roundtrip.worksheets) {
    assert.equal(sheet.pageSetup.paperSize,9);
    assert.equal(sheet.pageSetup.orientation,'landscape');
    assert.equal(sheet.pageSetup.fitToPage,true);
    assert.equal(sheet.pageSetup.fitToWidth,1);
    assert.equal(sheet.pageSetup.fitToHeight,0);
    assert.match(sheet.pageSetup.printArea,/^A1:[HJ]\d+$/);
  }
  const summary=roundtrip.getWorksheet('검토 요약');
  const labels=summary.getColumn(1).values;
  assert.ok(labels.indexOf('가능한 방안')<labels.indexOf('기준을 벗어난 방안'));
  assert.ok(labels.indexOf('기준을 벗어난 방안')>0);
  assert.equal(summary.getCell('C'+labels.indexOf('대안 · 성인 ½')).value,1);
  const ingredientRow=labels.indexOf('아스코르브산');
  assert.equal(summary.getCell('D'+ingredientRow).value,'1개당');
  assert.equal(summary.getCell('H'+ingredientRow).value,null);
  const detail=roundtrip.getWorksheet('성분별 분량');
  assert.equal(detail.getCell('E4').value,120);
  assert.equal(detail.getCell('H4').value,'mg');
});
