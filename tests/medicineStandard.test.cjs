
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
