
const oral = ['정제', '캡슐제', '과립제', '산제', '경구용 액제', '환제', '추어블정', '발포정', '발포과립'];
const mouth = ['구강용 정제', '트로키제'];
const external = ['외용액제', '연고제', '크림제', '겔제'];

const chapters = [
  {name:'비타민·미네랄', forms:[...oral,...mouth,'시럽제','경구용젤리제','구강용해필름','구강붕해정','이중제형'], source:'2. 1)~3) · 표 1~5'},
  {name:'해열진통제', forms:[...oral,...mouth,'시럽제'], source:'2. (1)~(4) · 표 1~3'},
  {name:'감기약', forms:[...oral.filter(f=>f!=='환제'),...mouth,'시럽제'], source:'2. (1)~(4) · 표 1~3'},
  {name:'제산·건위·소화 등', forms:oral, source:'2. 1)~4) · 표 1~3'},
  {name:'진토제', forms:oral, source:'2. 1)~4) · 표 1~3'},
  {name:'하제', forms:oral, source:'2. 1)~4) · 표 1~5'},
  {name:'진해거담제', forms:[...oral,...mouth], source:'2. (1)~(4) · 표 1~2'},
  {name:'안과용약', forms:['점안제'], variants:['일반점안약','항균성점안약','인공누액','콘택트렌즈장착액','세안약','완화제'], source:'2. 1)~4) · 표 1·3·4'},
  {name:'비염용 경구제', forms:oral, source:'2. (가)~(라) · 표 1~3'},
  {name:'비염용 분무제', forms:['점비액제'], source:'2. (가)~(라) · 표 1~2'},
  {name:'외용치질용약', forms:[...external,'좌제','에어로솔제'], variants:['도포','직장 내 주입·삽입'], source:'2. 1)~4) · 표 1'},
  {name:'무좀·백선용제', forms:['외용고형제',...external,'에어로솔제'], source:'2. 1)~4) · 표 1'},
  {name:'외용 진통제', forms:[...external,'카타플라스마제','첩부제'], source:'2. 1)~4) · 표 1'},
  {name:'외용 진양제', forms:external, source:'2. 1)~4) · 표 1'},
];

const physical = form => /액제|시럽/.test(form) ? 'mL' : /과립제|산제/.test(form) ? 'g' : '개';
const isOral = n => n < 8 || n === 9;
const isLiquid = f => ['경구용 액제','시럽제'].includes(f);
const isPatch = f => ['첩부제','카타플라스마제'].includes(f);
const fmt = value => Number.isFinite(value) ? new Intl.NumberFormat('ko-KR',{maximumFractionDigits:9}).format(value) : '—';
const near = (a,b) => Math.abs(a-b) <= 1e-10 * Math.max(Math.abs(a),Math.abs(b),1e-12);
const under = (a,b) => a < b && !near(a,b);
const over = (a,b) => a > b && !near(a,b);
const normal = value => value.normalize('NFKC').toLowerCase().replace(/\s/g,'');
const ages = Array.from({length:8},(_,i)=>i+8);
const spanLabel = (first,last) => first===last ? '만 '+first+'세' : last===15 ? '만 '+first+'~14세' : '만 '+first+'~'+(last-1)+'세';

function regimen(n, form, variant, rows) {
  const has = part => rows.some(r=>r.name.includes(part));
  const group = g => rows.some(r=>r.group===g);
  const liquid = isLiquid(form);
  const oneTo = end => Array.from({length:end},(_,i)=>i+1);
  let counts = null;
  let timing = '';
  switch(n) {
    case 1: counts=oneTo(3); timing='복용량·횟수와 필요한 복용시기를 명기'; break;
    case 2: counts=oneTo(3); timing='공복을 피함 · 2회는 6시간 이상, 3회는 4시간 이상 간격'; break;
    case 3: counts=liquid?[3,4]:[3]; timing=liquid?'매 식후 및 필요시 취침 전 · 원칙적으로 4시간 간격':'식후 30분'; break;
    case 4: counts=liquid||rows.some(r=>r.primary&&['V','VI'].includes(r.group))?oneTo(3):[3]; timing='복용시기 또는 간격을 명기 · 예외 용법에서 2회 이상은 4시간 이상'; break;
    case 5: counts=oneTo(3); timing='복용시기 또는 간격을 명기 · 멀미 예방과 추가 복용에 관한 기재 예 확인'; break;
    case 6: counts=oneTo(3); timing='복용시기 또는 간격을 명기 · 2회 이상은 4시간 이상'; break;
    case 7: counts=form==='트로키제'||liquid?[3,4,5,6]:[3,4]; timing='복용시기 또는 간격 명기 · 5~6회는 트로키 2시간 이상, 내용액 약 4시간 간격'; break;
    case 8:
      if (variant==='콘택트렌즈장착액') timing='렌즈 착용 시 적용 · 구체적인 사용방법 명기';
      else if(variant==='완화제') {
        counts=group('I')?oneTo(4):null;
        timing='필요 시 1~2방울 · 충혈제거제 함유 시 1일 4회 이내';
      } else {
        counts=[3,4,5,6];
        timing=variant==='세안약'?'1회 세안량(mL) 명기':'1회 1~3방울';
      }
      break;
    case 9: counts=liquid?[3,4,5,6]:[3]; timing='4시간 이상 간격 · 내용액 6회 용법은 원칙적으로 약 4시간 간격'; break;
    case 10:
      counts=oneTo(has('옥시메타졸린')?2:has('자일로메타졸린')?3:6);
      timing=has('옥시메타졸린')?'10~12시간 간격 · 24시간에 최대 2회':has('자일로메타졸린')?'8시간 이상 간격':'3시간 이상 간격';
      break;
    case 11: counts=oneTo(3); timing=variant==='도포'?'환부에 직접 바름':'1회 1개 직장 내 삽입'; break;
    case 12: timing='1일 수회 외피에 적용 · 구체적인 사용방법 명기'; break;
    case 13:
      counts=rows.some(r=>r.group==='I'&&r.item==='4')?oneTo(isPatch(form)?2:4):null;
      timing='환부에 적당량 적용 · Ⅰ란 4항 함유 시 제형별 횟수 상한 적용';
      break;
    case 14: timing='원칙적으로 1일 수회 환부에 적당량 적용'; break;
  }
  const method = {
    '추어블정':'입안에서 녹이거나 씹어서 복용', '발포정':'물에 녹여 복용',
    '발포과립':'물에 녹여 복용', '트로키제':'입안에서 서서히 녹여 복용',
    '경구용젤리제':'반드시 씹어서 복용', '구강용해필름':'혀 위에서 녹인 후 삼킴',
    '구강붕해정':'혀 위에서 완전히 녹인 후 삼킴',
    '이중제형':'경구용 액제와 고형제 동시 복용',
  }[form];
  return {counts,timing,method};
}

function ageBlock(n, form, variant, rows, age) {
  const has = rx => rows.some(r=>rx.test(r.name));
  if (n===4 && age<19 && has(/카올린/)) return '카올린 함유 제제는 만 19세 미만 용법 불인정';
  if (age>=15) return '';
  if (n===1 && has(/아미노에틸설폰산\(타우린\)/)) return '아미노에틸설폰산은 만 15세 이상에 한함';
  if ([2,3,4,7].includes(n) && has(/히드로탈시트/)) return '히드로탈시트 함유 제제는 만 15세 미만 용법 불인정';
  if ([2,3].includes(n) && has(/아스피린/)) return '아스피린 계열 함유 제제는 만 15세 미만 용법 불인정';
  if (n===2 && has(/살리실산나트륨/)) return '살리실산나트륨 함유 제제는 만 15세 미만 용법 불인정';
  if ([3,9].includes(n) && has(/메퀴타진/)) return '메퀴타진 함유 제제는 만 15세 미만 용법 불인정';
  if ([5,7,9].includes(n) && has(/프로메타진염산염|염산프로메타진/)) return '프로메타진염산염 함유 제제는 만 15세 미만 용법 불인정';
  if (n===9 && isLiquid(form)) return '비염용 경구 액제 용법은 만 15세 이상에 한함';
  return '';
}

function adultSpecs(n, r, rows, form, variant, freq, age=15) {
  const {group:g,item:i,values:v,table:t} = r;
  const members=(...groups)=>rows.filter(x=>groups.includes(x.group));
  const specs=[];
  const add=(basis,data,options={})=>{
    if(data) specs.push({basis,...data,...options});
  };
  const get=(basis, ratio, limits={})=>{
    const data=v[basis];
    if(!data) return;
    const max=limits.max ?? data.max;
    const min=limits.min ?? (ratio===undefined ? data.min : max*ratio);
    add(basis,data,{...limits,max,min:Number.isFinite(min)?min:undefined});
  };
  const doseKey = r.basis || 'day';
  const ratioBy=(variants,otherwise)=>variants[g]??otherwise;
  if(n===1) {
    const max=v[doseKey];
    const altAge=r.name==='폴산'||/우르소데옥시콜산|콘드로이틴설페이트/.test(r.name)?19:15;
    get(doseKey,undefined,{max:age>=altAge?max?.alt:undefined,min:v.minimum?.max,childMin:'same'});
  } else if(n===2) {
    const count=members('I').filter(x=>x.table===1).length;
    get('single',ratioBy({I:count===1?1/2:1/5,III:1/5}));
    get(doseKey,t===2?1/10:undefined,{min:g==='IV'?v.day?.alt:undefined});
    if(g==='V'&&v.day?.max) add('single',{unit:v.day.unit,min:v.day.max/15,raw:v.day.raw});
  } else if(n===3) {
    const count=members('I').length;
    const data=v[doseKey];
    const liquid=isLiquid(form);
    const ratio=ratioBy({I:count>1?1/5:1/2,XII:1/5,XIV:1/5,XV:1/10,가:1/10,나:1/10,다:1/10,라:1/5},1/2);
    const max=liquid?(data?.liquid??data?.max):data?.max;
    const min=(g==='I'&&count===1&&r.name==='아세트아미노펜')?600:data?.alt;
    get(doseKey,g==='라'?undefined:ratio,{max:g==='라'?max/2:max,min:g==='라'?max/5:min,exclusive:g==='라'});
    if(liquid&&g==='XII'&&r.name!=='벤조산나트륨카페인') add('single',{unit:'mg',max:30,raw:'내용액제 카페인 1회량'});
  } else if(n===4) {
    const fellow=members(g).filter(x=>x.item===i&&x.primary===r.primary);
    let ratio;
    if(g==='I'&&i==='3') ratio=1/5;
    if(g==='II'&&i==='1') ratio=r.primary&&fellow.length===1?1/2:1/10;
    if(g==='II'&&['2','3'].includes(i)) ratio=r.primary?1/2:1/5;
    if(g==='III'&&i==='2') ratio=r.primary&&fellow.length===1?1/2:1/5;
    if(g==='IV'&&i==='2') ratio=r.primary&&fellow.length===1?1/2:1/10;
    if(g==='V'&&['1','2','3','4'].includes(i)) ratio=r.primary&&members('V').filter(x=>x.primary&&x.item!=='5').length===1?1/2:1/5;
    if(g==='VI'&&i!=='4') ratio=r.primary?1/2:1/5;
    if(g==='VII') ratio=i==='8'?1/10:1/5;
    get(doseKey,ratio,{min:g==='VIII'?0.036:undefined});
    if(v[doseKey]?.max&&t===1) add('single',{unit:v[doseKey].unit,max:v[doseKey].max/3,raw:v[doseKey].raw});
    if(v.minimum?.max) add('day',{unit:'개',min:v.minimum.max,childMin:'same'});
    if(v.activity) add('activity',v.activity);
  } else if(n===5) {
    const essential=rows.filter(x=>x.group==='I'||x.group==='II'&&x.item==='1');
    get('single',g==='VII'?1/10:essential.includes(r)&&essential.length===1?1/2:1/5);
    get(doseKey);
  } else if(n===6) {
    if(v.day?.unit==='개') add('day',{unit:'개',min:v.day.max,childMin:'same'});
    else {
      get(doseKey);
      const amount=freq===1?v.single?.alt:undefined;
      get('single',undefined,{max:amount});
    }
  } else if(n===7) {
    const adjusted=g==='8'&&members('2','4','가').length>0?1/2:1;
    const high=form==='트로키제'&&freq>=5;
    const paired=members('2').length&&members('4').length;
    const ratio=g==='8'||g==='10'?1/5:t===1&&['가','나','다'].includes(g)?1/10:1/2;
    get(doseKey,high?1/2:paired&&['2','4'].includes(g)?undefined:ratio,{max:v[doseKey]?.max*adjusted});
    const singleMax=isLiquid(form)&&v[doseKey]?.max?v[doseKey].max*adjusted/6:v.single?.max*adjusted;
    if(v.single||Number.isFinite(singleMax)) add('single',v.single||v[doseKey],{max:singleMax,min:!high&&!paired&&v.single?.max?singleMax*ratio:undefined});
  } else if(n===8) {
    const hasBasic=x=>['I','II','III','IV'].includes(x.group)||x.group==='V'&&Number(x.item)<=3||x.group==='VI'&&x.item==='1';
    const max=v.conc?.max*+(variant==='세안약'&&['III','IV','V','VI'].includes(g)?0.1:1);
    const ratio = variant==='일반점안약' ? (hasBasic(r)?(rows.filter(hasBasic).length===1?1/2:1/5):1/10)
      : variant==='항균성점안약' ? (g==='VII'?1/2:hasBasic(r)?1/5:1/10)
      : variant==='인공누액' ? (g==='VI'||g==='IX'&&i==='1-1'?1/10:undefined)
      : variant==='콘택트렌즈장착액' ? (g==='IX'&&i==='1-1'?(members('IX').filter(x=>x.item==='1-1').length===1?1/2:1/5):g==='VI'?1/10:undefined)
      : variant==='세안약' ? (['III','IV','X'].includes(g)?1/5:['V','VI'].includes(g)?1/10:undefined)
      : g==='I'?1/5:undefined;
    get('conc',ratio,{max});
  } else if(n===9) {
    const max=v[doseKey]?.max * (g==='V'&&members('II').some(x=>x.item==='1')?1/2:1);
    const min=v[doseKey]?.max*ratioBy({I:1/2,II:1/5,III:1/5,IV:1/10,V:1/5,VI:1/10});
    get(doseKey,undefined,{max,min});
    if(Number.isFinite(max)) add('single',{unit:v[doseKey].unit,max:max/(isLiquid(form)?6:3)});
  } else if(n===10) {
    const reduced=r.name.includes('자일로메타졸린')&&age<12;
    get('conc',undefined,{max:reduced?v.conc?.max/2:undefined,min:v.conc?.max*(g==='I'?1/2:1/5),childMin:'same'});
  } else if(n===11) {
    const key=variant==='도포'?'conc':'single';
    get(key,g==='IX'||g==='VII'&&i==='2'?1/10:1/5);
  } else if(n===12) {
    const core = g==='II'||g==='I'&&!['8','9'].includes(i);
    const value=v.conc;
    const min=core?(value?.alt??value?.max)/5:value?.max/10;
    const special=r.name==='벤잘코늄염화물';
    get('conc',undefined,{min:special?value?.max:min});
  } else if(n===13) {
    if(isPatch(form)) {
      const key=form==='첩부제'?'patch':'cat';
      for (const suffix of ['100','M']) {
        const data=v[key+suffix];
        get(key+suffix,undefined,{min:data?.alt??data?.max});
      }
    } else get('conc',undefined,{min:v.conc?.min??v.conc?.alt??v.conc?.max});
  } else if(n===14) {
    const max=v.conc?.max;
    const ratio=g==='I-1'?i==='1'?1:1/2:ratioBy({'I-2':1/2,III:1/10,IV:1/5,V:1,VI:1/10,VIII:1/10,X:i==='2'?1:undefined});
    get('conc',ratio,{min:v.conc?.alt});
  }
  return specs.filter(spec=>spec.manual||spec.excluded||Number.isFinite(spec.max)||Number.isFinite(spec.min));
}

function combinations(n, rows, form, variant, freq) {
  const issues=[];
  const ref=chapters[n-1].source;
  const fail=message=>issues.push({severity:'fail',message,ref});
  const manual=message=>issues.push({severity:'manual',message,ref});
  const list=(...groups)=>rows.filter(x=>groups.includes(x.group));
  const sub=(g,i)=>list(g).filter(x=>x.item===i);
  const has=rx=>rows.some(r=>rx.test(r.name));
  const count=(selection,max,label)=>{if(selection.length>max)fail(label+'은 최대 '+max+'종까지 배합할 수 있습니다.');};
  const need=(condition,label)=>{if(!condition)fail(label);};
  const banned=(a,b,label)=>{if(a&&b)fail(label);};
  const singleGroups=(...groups)=>groups.forEach(g=>count(list(g),1,g+' 그룹'));
  const dup = rows.find((x,i)=>rows.slice(0,i).some(y=>normal(x.name)===normal(y.name)));
  if(dup) fail(dup.name+'이 중복 입력되었습니다. 동일 성분의 양을 합산해 한 행에 입력하세요.');
  const comboMin = ![8,10].includes(n);
  if(comboMin&&rows.length<2) fail('이 장의 적용 범위는 의약품 복합제입니다. 유효성분을 2종 이상 입력하세요.');
  const qty=(r,b)=>r.amounts[b]??((r.basis??'day')===b||b==='single'&&isOral(n)?r.amount:undefined);
  const sum=(set,key,lo,hi,label)=>{
    if(set.length<2) return;
    const weights=set.map(r=>{
      const basis=key==='day'?(r.basis??'day'):key;
      const max=r.values[basis]?.max;
      return max?(qty(r,basis)*(basis==='single'||basis==='conc'?1:freq))/max:NaN;
    });
    if(weights.some(x=>!Number.isFinite(x))) {manual(label+' 비례배합 계수는 원문으로 확인하세요.');return;}
    const total=weights.reduce((a,b)=>a+b,0);
    if(under(total,lo)||over(total,hi)) fail(label+' 비례배합 계수 합 '+fmt(total)+'에 허용 범위 '+fmt(lo)+'~'+fmt(hi)+'을 적용합니다.');
  };
  const liquid=isLiquid(form);
  if(n===1) {
    need(rows.some(r=>r.table===1),'표 1의 비타민을 1종 이상 배합해야 합니다.');
    if(form==='이중제형') manual('경구용 액제와 허용 고형제의 조합, 동시 복용, 포장 및 제형별 분할 가능량을 확인하세요.');
    for (const r of rows) {
      const same=rows.filter(x=>x!==r&&x.table===r.table&&x.group===r.group);
      if(same.some(x=>x.values[x.basis??'day']?.unit!==r.values[r.basis??'day']?.unit)
        ||same.some(x=>x.values[x.basis??'day']?.max!==r.values[r.basis??'day']?.max)) {
        manual(r.group+' 항목에 여러 성분이 있어 환산량과 합산 상한을 확인해야 합니다.');
      } else if(same.length) {
        const key=r.basis??'day';
        const max=adultSpecs(n,r,rows,form,variant,freq).find(s=>s.basis===key)?.max;
        if(max&&over((r.amount+same.reduce((t,x)=>t+x.amount,0))*freq,max)) fail(r.group+' 항목 합계가 1일 최대량을 초과합니다.');
      }
    }
  } else if(n===2) {
    need(list('I','II').some(r=>r.table===1),'표 1의 Ⅰ항 또는 Ⅱ항 성분이 필요합니다.');
    count(list('I').filter(r=>r.table===1),3,'Ⅰ항');
    singleGroups('III');
    banned(list('II').length,list('I').some(r=>r.table===1),'이부프로펜과 Ⅰ항 성분은 동시에 배합할 수 없습니다.');
    sum(list('I').filter(r=>r.table===1),'single',1/2,3/2,'Ⅰ항');
    if(rows.some(r=>r.group==='IV')) manual('비타민 유도체의 원료와 고시 기준 환산량을 대조하세요.');
  } else if(n===3) {
    need(list('I','II').length,'Ⅰ항 또는 Ⅱ항 성분이 필요합니다.');
    count(list('I'),3,'Ⅰ항');
    singleGroups('III','IV','V-1','VI','VII','XI','XII','XV','라');
    banned(list('V-1').length,has(/마황|갈근탕|소청룡탕|계지탕|시호계지탕/),'마황 또는 마황 함유 한약처방과 Ⅴ-1항은 함께 배합할 수 없습니다.');
    banned(list('라').length,list('가','나','다').length,'라란 한약처방은 가·나·다란 생약과 함께 배합할 수 없습니다.');
    banned(list('II').length,list('I','IX','가','라').length||has(/지룡/),'이부프로펜에 적용되는 병용 제한에 해당합니다.');
    banned(list('VIII').length,list('X','가','라').length,'Ⅷ항과 Ⅹ항·가란·라란은 함께 배합할 수 없습니다.');
    banned(list('IX').length,list('II','X','가','라').length,'Ⅸ항과 Ⅱ항·Ⅹ항·가란·라란은 함께 배합할 수 없습니다.');
    banned(has(/메퀴타진/),liquid||list('라').length,'메퀴타진은 내용액제 또는 라란 한약처방에 적용할 수 없습니다.');
    banned(list('XV').length,list('가','라').length||list('나').some(r=>r.name==='감초'),'ⅩⅤ항에는 가란·라란·감초 배합 제한이 있습니다.');
    banned(has(/아스피린$/),list('V-1').length,'아스피린과 Ⅴ-1항 성분을 함께 배합할 수 없습니다.');
    sum(list('I'),'day',1/2,1,'Ⅰ항');
    sum(list('가','나'),'day',0,1,'가·나란 생약');
    if(list('XII').length) sum(list('V-1','가','XII'),'day',0,1.5,'Ⅴ-1항·가란·Ⅻ항');
    if(list('I').length) sum([...list('I'),...rows.filter(r=>['지룡','갈근탕','마황탕'].includes(r.name))],'day',0,1,'Ⅰ항과 지정 생약·처방');
    if(list('가','나').length) manual('기침·가래 효능을 가·나란 생약에만 근거하는 경우의 최소 배합 및 비례배합을 확인하세요.');
    if(list('XI','라','XIII').length) manual('효소 역가·안정성, 한약처방의 구성 및 규격, 비타민 유도체 환산 중 해당 사항을 확인하세요.');
    if(liquid&&has(/벤조산나트륨카페인/)) manual('내용액제는 카페인 환산 기준으로 1회 30 mg 이하인지 확인하세요.');
  } else if(n===4) {
    const main=rows.filter(r=>r.primary);
    need(main.some(r=>['I','II','III','IV','V','VI'].includes(r.group)),'Ⅰ~Ⅵ란 중 유효주성분을 지정하세요.');
    if(liquid) {
      need(main.some(r=>['I','II'].includes(r.group)),'내용액제는 제산제 또는 건위제를 유효주성분으로 배합해야 합니다.');
      banned(true,has(/스코폴리아엑스|호미카엑스/),'내용액제에 스코폴리아엑스·호미카엑스를 배합할 수 없습니다.');
    }
    banned(main.length&&main.every(r=>r.group==='I'),sub('IV','2').length||sub('V','5').length,'제산제만이 주성분인 경우 정장생약·지사생약을 배합할 수 없습니다.');
    banned(main.length&&main.every(r=>r.group==='IV'),list('VII').length,'정장제만이 주성분인 경우 점막수복제를 배합할 수 없습니다.');
    banned(list('I').some(r=>r.item!=='3'),sub('II','4').length,'제산제와 건위제 산제의 동시 배합 제한에 해당합니다.');
    banned(has(/베르베린염화물|베르베린탄닌산/),has(/황련|황백/),'베르베린 살균제와 황련·황백은 함께 배합할 수 없습니다.');
    banned(sub('VII','3').length,sub('VII','8').some(r=>r.name==='감초'),'점막수복제의 글리시리진산과 감초는 함께 배합할 수 없습니다.');
    manual('주·부성분 조합표, 효능별 비례배합 및 제산력·pH·소화효소 역가 시험 등 해당 조건을 확인하세요.');
  } else if(n===5) {
    need(list('I').length||sub('II','1').length,'Ⅰ란 또는 Ⅱ란 1항목이 필요합니다.');
    count(list('I'),2,'Ⅰ란'); count(list('V'),2,'Ⅴ란');
    singleGroups('II','III','IV','VI','VII');
    for(const i of ['1','2']) count(sub('V',i),1,'Ⅴ란 '+i+'항목');
    if(liquid) need(rows.every(r=>['I','V','VII'].includes(r.group)||r.group==='II'&&r.item==='1'),'진토제 내용액제에 허용되지 않는 성분군이 있습니다.');
    sum(list('I'),'single',1/2,1,'Ⅰ란');
    if(sub('II','1').length) sum([...list('I'),...sub('II','1')],'single',1/2,2,'Ⅰ란·Ⅱ란 1항목');
    sum(list('V'),'single',0,1,'Ⅴ란');
    if(rows.some(r=>r.table===2)) manual('비타민 유도체의 종류와 환산량은 표 2와 제1장을 함께 확인하세요.');
  } else if(n===6) {
    const main=rows.filter(r=>r.table===1&&r.primary);
    need(main.length,'표 1의 하제 성분을 유효주성분으로 지정하세요.');
    if(liquid) need(main.some(r=>r.group==='I'),'경구용 액제는 염류하제가 유효주성분이어야 합니다.');
    manual('최소·최대 복용량의 용량폭과 표 4의 비례배합·성분수·개별 최소분량을 원문으로 확인하세요.');
  } else if(n===7) {
    need(list('1','2','3','가').length,'1~3항 또는 가란의 성분이 필요합니다.');
    singleGroups(...Array.from({length:9},(_,i)=>String(i+1)));
    count(list('나'),5,'나란');count(list('다'),5,'다란');
    if(form==='트로키제') need(rows.every(r=>r.mark),'트로키제에는 △ 표시 성분만 허용됩니다.');
    else if(list('9').length) fail('9항 성분은 트로키제만 허용됩니다.');
    if(list('8').length) need(list('1','7').length,'8항 성분에는 1항 또는 7항 성분이 필요합니다.');
    banned(list('가').length,list('2','4').length,'가란과 2·4항은 함께 배합할 수 없습니다.');
    if(list('2').length&&list('4').length) {
      sum(list('2','4'),'day',0,1,'2·4항');
      manual('2·4항의 최소량은 표방 효능에 따라 달라지므로 원문을 확인하세요.');
    }
    sum(list('가','나'),'day',0,1,'가·나란');
    if(list('가','나','다').length) manual('생약 효능을 표시할 때의 별도 배합 하한을 확인하세요.');
    if(list('9').length) manual('9항 함유 트로키의 소아용 배합분량은 성인과 동일하게 설정하는 조건을 확인하세요.');
  } else if(n===8) {
    const basic=r=>['I','II','III','IV'].includes(r.group)||r.group==='V'&&Number(r.item)<=3||r.group==='VI'&&r.item==='1';
    const policies={
      '일반점안약':[basic,r=>basic(r)||['V','VI'].includes(r.group)],
      '항균성점안약':[r=>r.group==='VII',r=>['I','II','III','IV','V','VI','VII'].includes(r.group)],
      '인공누액':[r=>r.group==='VIII'||r.group==='VI'&&['2','3'].includes(r.item),r=>['VI','VIII'].includes(r.group)||r.group==='IX'&&['1-1','2'].includes(r.item)],
      '콘택트렌즈장착액':[r=>r.group==='IX'&&r.item==='1-1',r=>['VI','VIII'].includes(r.group)||r.group==='IX'&&['1-1','2'].includes(r.item)],
      '세안약':[r=>['III','IV','VIII','X'].includes(r.group),r=>['III','IV','V','VI','VIII','X'].includes(r.group)],
      '완화제':[r=>r.group==='XI',r=>['I','XI'].includes(r.group)],
    };
    const [required,allowed]=policies[variant];
    need(rows.some(required),'선택한 안과용약 제제의 필수 성분이 필요합니다.');
    need(rows.every(allowed),'선택한 안과용약 제제에 허용되지 않는 성분군이 있습니다.');
    singleGroups('I','IV','VII');
    for(const g of ['III','V','VI']) {
      count(list(g),3,g+'란');
      for(const i of new Set(list(g).map(r=>r.item))) count(sub(g,i),1,g+'란 '+i+'항');
    }
    if(variant==='항균성점안약') count(list('I','II','III','IV','V','VI'),3,'비항균 보조성분');
    if(variant==='세안약'&&list('VIII','X').length) count(rows,1,'Ⅷ·Ⅹ란을 주성분으로 한 세안약');
    if(variant==='완화제') count(list('XI'),3,'Ⅺ란');
    manual('안과 제제별 표 3·4의 비례배합, 무기염·점조제 조건과 해당 pH·삼투압 시험을 확인하세요.');
  } else if(n===9) {
    need(list('I').length,'Ⅰ란의 항히스타민제 성분이 필요합니다.');
    singleGroups('I','III','IV','V');
    count(sub('II','1'),2,'Ⅱ란 1항'); count(sub('II','2'),1,'Ⅱ란 2항');
    banned(has(/메틸에페드린/),has(/슈도에페드린/),'dl-메틸에페드린과 슈도에페드린은 함께 배합할 수 없습니다.');
    banned(sub('I','2').length,liquid||list('VI').length,'메퀴타진은 내용액제나 Ⅵ란 생약에 적용할 수 없습니다.');
    sum(list('II'),'day',0,2,'Ⅱ란');
    if(liquid||list('IV','VI').some(x=>x.basis==='herb')) manual('내용액제 용기·포장 조건과 생약엑스 추출 조건 중 해당 사항을 확인하세요.');
  } else if(n===10) {
    need(list('I').length,'Ⅰ란 혈관수축제를 배합해야 합니다.');
    singleGroups('I','II','III','IV');
  } else if(n===11) {
    need(list('I').length,'Ⅰ란 성분이 필요합니다.');
    singleGroups('II','III','V','VI');
    count(sub('I','1'),2,'Ⅰ란 1항');
    for(const g of ['VIII','IX']) for(const i of new Set(list(g).map(r=>r.item))) count(sub(g,i),1,g+'란 '+i+'항');
    banned(has(/^디부카인$/),has(/디부카인염산염/),'디부카인과 디부카인염산염은 동시에 배합할 수 없습니다.');
    banned(has(/^리도카인$/),has(/리도카인염산염/),'리도카인과 리도카인염산염수화물은 동시에 배합할 수 없습니다.');
    banned(has(/^알란토인$/),has(/^알란토인클로[르로]/),'알란토인과 알란토인클로로히드록시알루미늄은 함께 배합할 수 없습니다.');
    banned(has(/^건조황산알루미늄칼륨$/),has(/^황산알루미늄칼륨수화물$/),'두 황산알루미늄칼륨 성분은 함께 배합할 수 없습니다.');
    const key=variant==='도포'?'conc':'single';
    sum(sub('I','1'),key,0,1,'Ⅰ란 1항');
    const selected=list('I');
    if(selected.length&&selected.every(r=>r.values[key]?.max)&&selected.every(r=>under(qty(r,key),r.values[key].max/2))) fail('Ⅰ란 성분 중 하나는 최대량의 1/2 이상이어야 합니다.');
    if(form==='에어로솔제'||has(/위치헤이즐/)) manual('에어로솔 용법 또는 위치헤이즐의 추출 조건을 원문에서 확인하세요.');
  } else if(n===12) {
    const core=list('I','II').filter(r=>r.group==='II'||!['8','9'].includes(r.item));
    need(core.length,'Ⅰ란(8·9항 제외) 또는 Ⅱ란 성분이 필요합니다.');
    count(list('I'),3,'Ⅰ란');
    for(const i of new Set(list('I').map(r=>r.item))) {
      const group=sub('I',i);
      if(i!=='1') count(group,1,'Ⅰ란 '+i+'항');
    }
    if(list('I').some(r=>r.mark)) count(list('I'),1,'△ 표시가 포함된 Ⅰ란');
    count(sub('III','1'),1,'Ⅲ란 1항'); count(sub('IV','1'),1,'Ⅳ란 1항');
    count(sub('III','2'),3,'Ⅲ란 2항');
    if(has(/^아세트산$/)) count(sub('III','2'),1,'아세트산이 포함된 Ⅲ란 2항');
    for(const i of new Set(list('V').map(r=>r.item))) count(sub('V',i),1,'Ⅴ란 '+i+'항');
    banned(list('VI').some(r=>/알란토인|알디옥사|에녹솔론/.test(r.name)),list('VII').length,'지정된 Ⅵ란 성분과 Ⅶ란 성분은 함께 배합할 수 없습니다.');
    if(core.length&&core.every(r=>r.values.conc?.max)&&core.every(r=>under(r.amount,r.values.conc.alt??r.values.conc.max/2))) fail('필수 성분 중 하나가 성분별 핵심 최소농도에 도달해야 합니다.');
  } else if(n===13) {
    const nsaid=sub('I','4');
    need(nsaid.length||sub('I','3').length&&(sub('I','1').length||sub('I','2').length),'Ⅰ란 1·3항, 2·3항 또는 4항 조합이 필요합니다.');
    for(const i of ['1','2','3','4']) count(sub('I',i),1,'Ⅰ란 '+i+'항');
    singleGroups('II','III','IV','V','VI');
    if(nsaid.length) {
      const blocked=has(/인도메타신|피록시캄/)?[...sub('I','1'),...sub('I','3'),...list('II','III'),...list(...(form==='첩부제'?['VI','VII']:[]))]
        :form==='카타플라스마제'?[...sub('I','1'),...sub('I','2'),...sub('I','3'),...list('II','III','VI')]:[...sub('I','1'),...sub('I','3'),...list('III','VII')];
      if(blocked.length) fail('Ⅰ란 4항 성분을 선택 제형에 배합할 때 금지되는 조합입니다.');
    }
    manual(isPatch(form)?'부착제의 형상·1매 면적과 제형별 동시 배합 시의 추가 농도 상한을 확인하세요.':'배합에 따른 추가 농도 상한 및 w/w·w/v 기준을 확인하세요.');
  } else if(n===14) {
    need(list('I-1','I-2').length===1,'Ⅰ-1란 또는 Ⅰ-2란에서 필수 성분 1종을 선택해야 합니다.');
    singleGroups('II','III','IV','V','VI','VII','VIII');
    for(const g of ['IX','X']) for(const i of new Set(list(g).map(r=>r.item))) count(sub(g,i),1,g+'란 '+i+'항');
  }
  return issues;
}


const basisNames = {day:'1일량',single:'1회량',herb:'1일 원생약·엑스 환산량',powder:'1일 분말량',conc:'농도',cat100:'고체 100g 중',catM:'고체 1㎡ 중',patch100:'고체 100g 중',patchM:'고체 1㎡ 중',activity:'소화효소 역가',minimum:'1일 최소량'};
const coefficient = age => age>=15?1:age>=11?2/3:1/2;
const ratioLabel = ratio=>ratio===2/3?'⅔':ratio===1/2?'½':'1';
const sourceFor=(n,r)=>'제'+n+'장 표 '+r.table+' · '+(r.group?r.group+(r.item?' '+r.item+'항':'')+' · ':'')+r.name;
const mass={g:1,mg:1/1000,'µg':1/1000000};
const converted = (value,from,to) => from===to?value:mass[from]&&mass[to]?value*mass[from]/mass[to]:NaN;

function fieldOptions(n,r,form,variant) {
  const make=(basis,label,unit)=>({key:basis,label,unit});
  if(isOral(n)) {
    if(r.values.activity) return [make('activity','단위량당 역가','단위')];
    const selects=['herb','powder'].filter(k=>r.values[k]&&!r.values[k].excluded);
    const basis = selects.includes(r.basis)?r.basis:selects[0]||'day';
    const value = r.values[basis]??r.values.single??r.values.minimum;
    const unit = value?.unit||'mg';
    return [make(basis,'단위량당 함량',unit)];
  }
  if(n===13&&isPatch(form)) {
    const type=form==='첩부제'?'patch':'cat';
    return [make(type+'100','고체 100g 중의 양','g/100g'),make(type+'M','고체 1㎡ 중의 양','g/㎡')];
  }
  const basis=n===11&&variant!=='도포'?'single':'conc';
  return [make(basis,basis==='conc'?'농도':'1회량',r.values[basis]?.unit||(basis==='conc'?'%':'mg'))];
}

function rowFor(n,r,form,variant,perDose) {
  const fields=fieldOptions(n,r,form,variant);
  const normalized={...r,basis:fields[0].key,amounts:{}};
  for(const {key} of fields) {
    const multiplier = isOral(n)?perDose:1;
    normalized.amounts[key]=r.entries[key]*multiplier;
  }
  normalized.amount=normalized.amounts[normalized.basis];
  return normalized;
}

function valueFor(n,r,spec,freq) {
  const direct = r.amounts[spec.basis];
  const value = direct ?? r.amount;
  const basis=r.basis??spec.basis;
  const unit=r.values[basis]?.unit??r.values.single?.unit??r.values.minimum?.unit??(r.basis==='activity'?'단위':spec.unit);
  return converted(value,unit,spec.unit)*(isOral(n)&&spec.basis!=='single'?freq:1);
}

function checkQuantities(n,rows,form,variant,freq,age,child=false) {
  const checks=[];
  for(const r of rows) {
    const ref=sourceFor(n,r);
    let specs=adultSpecs(n,r,rows,form,variant,freq,age);
    if(!specs.length && !(n===8&&r.values.conc?.raw==='')) specs=[{basis:r.basis,manual:true,raw:'제형별 표와 주석 확인'}];
    for(const spec of specs) {
      const {basis,unit}=spec;
      const label=basisNames[basis];
      let max=spec.max;
      let min=spec.min;
      let inferred;
      let maxFactor=1;
      if(child&&([2,3,4,5,6,7,9].includes(n))) {
        maxFactor=coefficient(age);
        if(n===7&&r.group==='9') maxFactor=1;
        if([2,5].includes(n)&&r.table===2) maxFactor=NaN;
        if(max!=null) max *= maxFactor;
        if(min!=null&&spec.childMin!=='same') { inferred=min*maxFactor; min=undefined; }
      }
      if(child&&n===11&&variant!=='도포') {
        if(max!=null) max *= 1/2;
        if(min!=null) { inferred=min/2; min=undefined; }
      }
      if(child&&n===1&&r.table===2&&age<12) {
        const childMax={구리:2.5,요오드:0.4,마그네슘:250,셀레늄:.15,아연:25};
        const name=Object.keys(childMax).find(key=>r.name.startsWith(key));
        if(name) max=converted(childMax[name],'mg',unit);
      }
      const actual=valueFor(n,r,spec,freq);
      const result={name:r.name,label,ref,value:actual,max,min,inferred,unit,raw:spec.raw,exclusive:spec.exclusive};
      if(spec.excluded) {
        result.maxState='fail'; result.note='선택한 기준 또는 제형에 허용량이 설정되어 있지 않습니다.';
      } else if(spec.manual||!Number.isFinite(actual)) {
        result.maxState='manual'; result.minState='manual'; result.note='분량, 기준 단위 또는 원문 주석 확인이 필요합니다.';
      } else {
        if(Number.isFinite(max)) result.maxState=over(actual,max)||(spec.exclusive&&near(actual,max))?'fail':'pass';
        else if(spec.max!=null) result.maxState='manual';
        if(Number.isFinite(min)) result.minState=under(actual,min)?'fail':'pass';
        else if(Number.isFinite(inferred)) result.minState=under(actual,inferred)?'ref-fail':'ref-pass';
        else if(spec.min!=null) result.minState='manual';
      }
      checks.push(result);
    }
  }
  return checks;
}

function assess(input) {
  const {n,form,variant,freq,perDose,increment,adultAge,rows}=input;
  const oralForm=isOral(n);
  const normalized=rows.map(r=>rowFor(n,r,form,variant,oralForm?perDose:1));
  const rule=regimen(n,form,variant,normalized);
  const issues=combinations(n,normalized,form,variant,freq);
  const verdict=(severity,message)=>issues.push({severity,message,ref:chapters[n-1].source});
  if(rule.counts&&!rule.counts.includes(freq)) verdict('fail','선택한 적용 횟수는 이 제형·배합의 범위를 벗어납니다.');
  if(oralForm&&!near(perDose/increment,Math.round(perDose/increment))) verdict('fail','성인 1회 투여량이 입력한 계량·분할 단위의 정수배가 아닙니다.');
  const ageRestriction=ageBlock(n,form,variant,normalized,adultAge);
  if(ageRestriction) verdict('fail',ageRestriction);
  if(['추어블정','트로키제','경구용젤리제'].includes(form)) {
    if(!input.diameter) verdict('manual','직경 1.5 cm 초과 제형의 도넛형 조건을 확인하세요.');
    else if(input.diameter>1.5&&!input.ring) verdict('fail','직경이 1.5 cm를 초과하므로 도넛형 조건을 적용합니다.');
  }
  if(n===7&&isLiquid(form)&&over(perDose,20)) verdict('fail','경구용 액제의 1회 최대용량은 20 mL입니다.');
  if(n===9&&isLiquid(form)&&over(perDose,10)) verdict('fail','경구용 액제 1개 내용량은 10 mL 이하입니다.');
  if(n===5&&isLiquid(form)&&over(perDose,30)) verdict('fail','액제 1회분 용기는 원칙적으로 30 mL 이하입니다.');
  if(n===9&&isLiquid(form)&&!near(perDose,increment)) verdict('fail','경구용 액제는 1회 1개 용법입니다. 1개 내용량과 1회량을 같게 입력하세요.');
  if(n===11&&(variant==='도포'&&form==='좌제'||variant!=='도포'&&!['좌제','연고제','크림제'].includes(form))) verdict('fail','선택한 제형과 사용 경로 조합은 이 장의 용법에 기재되어 있지 않습니다.');
  const quantities=checkQuantities(n,normalized,form,variant,freq,adultAge);
  const status=issues.some(x=>x.severity==='fail')||quantities.some(x=>x.minState==='fail'||x.maxState==='fail')?'fail':
    issues.length||quantities.some(x=>x.minState==='manual'||x.maxState==='manual')?'manual':'pass';

  function profile(label,first,last,ratio) {
    const dose=oralForm?perDose*ratio:null;
    const exact=!oralForm||near(dose/increment,Math.round(dose/increment));
    const checks=[];
    for(let age=first;age<last;age++) {
      const adjusted=oralForm?rows.map(r=>rowFor(n,r,form,variant,dose)):normalized;
      const blocked=ageBlock(n,form,variant,adjusted,age);
      const values=checkQuantities(n,adjusted,form,variant,freq,age,true);
      checks.push({age,blocked,values});
    }
    const legalFail=checks.some(c=>c.blocked||c.values.some(v=>v.maxState==='fail'));
    const below=checks.some(c=>c.values.some(v=>v.minState==='fail'));
    const minStates=checks.flatMap(c=>c.values.map(v=>v.minState)).filter(Boolean);
    const allValues=checks.flatMap(c=>c.values);
    const ageStatus=legalFail?'fail':allValues.some(v=>v.maxState==='manual')?'manual':'pass';
    let minStatus=below?'fail':minStates.includes('manual')?'manual':minStates.includes('ref-fail')?'ref-fail':minStates.includes('ref-pass')?'ref-pass':minStates.includes('pass')?'pass':'none';
    return {label,first,last,ratio,dose,exact,checks,ageStatus,minStatus};
  }

  let profiles=[];
  if(oralForm) {
    profiles=[profile('기본',8,11,1/2),profile('기본',11,15,2/3)];
    if(!profiles[1].exact) profiles.push(profile('대안',8,15,1/2));
  } else if(n===10||n===11) {
    profiles=[profile('동일 제제',8,15,1)];
  }
  return {rule,issues,quantities,status,profiles,normalized};
}

export {chapters,assess,fieldOptions,regimen,ageBlock,adultSpecs,valueFor,combinations,basisNames,physical,isOral,fmt,normal,sourceFor,converted,ratioLabel,spanLabel};
