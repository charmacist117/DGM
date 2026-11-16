import ExcelJS from "exceljs";
import { categoryLabel, chapterFourClaims, classificationRef, isOral, physical, ratioLabel, spanLabel } from "./rules.mjs";
import { ageCheckRanges, statusText } from "./reportData.mjs";

const officialSource = "https://law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000283720";
const ink = "FF18333A";
const teal = "FF075E57";
const light = "FFE6F3EF";
const issueTone = { fail: "FF9B3022", manual: "FF795109", "ref-fail": "FF795109" };
const verdict = key => statusText[key] ?? "";
const numberValue = value => Number.isFinite(value) ? value : null;
const rowBasis = { day:"1일", single:"1회", herb:"원생약·엑스 환산", powder:"분말", conc:"농도", activity:"역가", cat100:"카타플라스마제 g/100g", catM:"카타플라스마제 g/㎡", patch100:"첩부제 g/100g", patchM:"첩부제 g/㎡" };
const span = range => range.last===range.first+1 ? "만 "+range.first+"세" : spanLabel(range.first,range.last);

function sheetFor(workbook,name,widths) {
  const sheet = workbook.addWorksheet(name,{
    pageSetup:{
      paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,
      margins:{left:0.32,right:0.32,top:0.42,bottom:0.42,header:0.1,footer:0.16},
      horizontalCentered:true,
    },
    views:[{showGridLines:false}],
    headerFooter:{oddFooter:"&LDGM&R&P / &N"},
  });
  sheet.columns=widths.map(width=>({width}));
  sheet.properties.defaultRowHeight=20;
  return sheet;
}

function lines(value,width) {
  return String(value??"").split("\n").reduce((count,line)=>{
    const size=[...line].reduce((total,char)=>total+(char.charCodeAt(0)>255?2:1),0);
    return count+Math.max(1,Math.ceil(size/Math.max(width-3,1)));
  },0);
}

function addRow(sheet,values,{fill,color=ink,bold=false,merge=false,size=10}={}) {
  const row=sheet.addRow(values.map(value=>value===""?null:value));
  const width=sheet.columns.reduce((total,column)=>total+column.width,0);
  if(merge) sheet.mergeCells(row.number,1,row.number,sheet.columns.length);
  row.height=Math.min(120,Math.max(20,7+13*Math.max(...values.map((value,i)=>lines(value,merge?width:sheet.getColumn(i+1).width)))));
  row.eachCell({includeEmpty:true},cell=>{
    cell.font={name:"맑은 고딕",size,bold,color:{argb:color}};
    cell.alignment={vertical:"middle",horizontal:typeof cell.value==="number"?"right":"left",wrapText:true};
    if(typeof cell.value==="number") cell.numFmt=Number.isInteger(cell.value)?"#,##0":"#,##0.#########";
    if(fill) cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};
  });
  return row;
}

const labelRow=(sheet,text)=>addRow(sheet,[text],{merge:true,fill:light,color:teal,bold:true});
const headingRow=(sheet,headers)=>addRow(sheet,headers,{fill:teal,color:"FFFFFFFF",bold:true});

function titleRows(sheet,title,subtitle) {
  const titleRow=addRow(sheet,[title],{merge:true,fill:teal,color:"FFFFFFFF",bold:true,size:16});
  titleRow.height=31;
  addRow(sheet,[subtitle],{merge:true,fill:light,color:teal});
}

export async function reviewWorkbook({input,result,chapter,sections}) {
  const workbook = new ExcelJS.Workbook();
  const summary = sheetFor(workbook,"검토 요약",[28,16,13,13,14,18,18,36]);
  const detail = sheetFor(workbook,"성분별 분량",[28,22,25,13,11,11,11,10,19,25]);
  const scope = chapter.title+" · 식품의약품안전처고시 제2026-57호 별표 1";
  const oral = isOral(input.n);
  const unit = oral?physical(input.form):"";
  const selected = new Map(result.normalized.map(row=>[row.id,row]));
  const roles = [4,6].includes(input.n);
  const role = row => roles?(row.primary?"유효주성분":"유효부성분"):"";
  const category = row => categoryLabel(row)||classificationRef(input.n,row);

  titleRows(summary,"의약품 표준제조기준 검토",scope);
  addRow(summary,["제형 · 적용 방법",[input.form,input.variant].filter(Boolean).join(" · "),"1일 최대 횟수",input.freq,"성인 1회량",oral?input.perDose:null,"투여 단위",unit]);
  addRow(summary,["성인 기준 연령",oral?input.adultAge:null,"최소 투여 단위",oral?input.increment:null,"검토 상태",verdict(result.status)]);
  if(result.rule.timing) addRow(summary,[result.rule.timing],{merge:true});
  for (const section of sections) {
    if(!section.frequencies.length&&!section.profiles.length) continue;
    labelRow(summary,section.title);
    headingRow(summary,["방안","대상","1회량","단위","1일 횟수","1일량","투여 단위·횟수","연령·상한·최소 배합 / 사유"]);
    for (const option of section.frequencies) {
      const reasons=option.issues.map(issue=>issue.message).filter((message,i,all)=>all.indexOf(message)===i);
      addRow(summary,["정장제 포함 횟수 비교","성인",input.perDose,unit,option.freq,input.perDose*option.freq,
        option.allowed?"횟수 범위 내":"횟수 범위 밖",[verdict(option.status),...reasons].join(" · ")],
      {color:issueTone[option.status]??ink});
    }
    for (const profile of section.profiles) {
      const blocked=[...new Set(profile.checks.map(check=>check.blocked).filter(Boolean))];
      const states=["상한 "+verdict(profile.ageStatus),"최소 배합 "+verdict(profile.minStatus),...blocked];
      if(result.status==='fail') states.push("입력 조합에 기준 이탈 있음");
      addRow(summary,[profile.label+(oral?" · 성인 "+ratioLabel(profile.ratio):""),span(profile),numberValue(profile.dose),unit,
        input.freq,oral?profile.dose*input.freq:null,oral?(profile.exact?"구현 가능":"단위 불일치"):"동일 제제",states.join(" · ")],
      {color:issueTone[profile.ageStatus]??ink});
    }
  }
  if(input.n===4) {
    labelRow(summary,"유효주성분 기준 효능·효과");
    const claims=chapterFourClaims(input.rows,chapter.effectScopes);
    for (const claim of claims) addRow(summary,[[claim.name,claim.blocked??claim.text,claim.note].filter(Boolean).join(" · ")],{merge:true});
    if(!claims.length) addRow(summary,["표방 범위를 확인할 유효주성분을 지정하세요."],{merge:true});
  }
  if(result.issues.length) {
    labelRow(summary,"배합과 제형 검토");
    for (const issue of result.issues) addRow(summary,[[verdict(issue.severity),issue.message,issue.ref].join(" · ")],{merge:true,color:issueTone[issue.severity]??ink});
  }
  labelRow(summary,"입력한 유효성분");
  headingRow(summary,["성분","분류","배합 역할","기준","입력값","단위","별표 위치","공급조건 원문"]);
  for (const row of selected.values()) {
    for (const [key,value] of Object.entries(row.entries)) {
      if(key!==row.basis && !(input.n===13&&key.endsWith("M"))) continue;
      const basis=oral?["1"+unit+"당",key!=="day"?rowBasis[key]:null].filter(Boolean).join(" · "):rowBasis[key]??key;
      addRow(summary,[row.name,category(row),role(row),basis,numberValue(Number(value)),
        row.values[key]?.unit??row.values.minimum?.unit??"",classificationRef(input.n,row),row.sourceText??""]);
    }
  }
  addRow(summary,["출처 · "+officialSource],{merge:true,color:teal});

  titleRows(detail,"성분별 분량과 적용 기준",scope);
  headingRow(detail,["방안·대상","성분","분류 · 배합 역할","분량 기준","적용량","최소","최대","단위","판정","근거"]);
  const addQuantities=(label,values)=>{
    for (const check of values) {
      const row=selected.get(check.id);
      const checks=[check.minState&&"최소 "+verdict(check.minState),check.maxState&&"상한 "+verdict(check.maxState),check.note].filter(Boolean).join("\n");
      const ref=[check.ref,check.raw,check.inferred!=null?"최소란은 연령 계수 환산 참고값":null].filter(Boolean).join("\n");
      addRow(detail,[label,check.name,row?[category(row),role(row)].filter(Boolean).join(" · "):"",check.label,
        numberValue(check.value),numberValue(check.min??check.inferred),numberValue(check.max),check.unit,checks,ref],
      {color:issueTone[check.maxState]??issueTone[check.minState]??ink});
    }
  };
  addQuantities(oral?"입력한 성인 용법":"입력한 적용 방법",result.quantities);
  for (const section of sections) {
    if(!section.frequencies.length&&!section.profiles.length) continue;
    labelRow(detail,section.title);
    for (const option of section.frequencies) addQuantities("성인 · 1일 "+option.freq+"회",option.quantities);
    for (const profile of section.profiles) {
      for (const range of ageCheckRanges(profile.checks)) addQuantities(profile.label+" · "+span(range),range.values);
    }
  }
  summary.pageSetup.printArea="A1:H"+summary.rowCount;
  summary.pageSetup.printTitlesRow="1:2";
  detail.pageSetup.printArea="A1:J"+detail.rowCount;
  detail.pageSetup.printTitlesRow="1:3";
  return workbook.xlsx.writeBuffer();
}
