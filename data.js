/* Versioned local-only model. Records own immutable nutrition snapshots. */
(function (root) {
  'use strict';
  const KEY = 'protein-diary:v2';
  const MEALS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
  const round = n => Math.round((n + Number.EPSILON) * 1000) / 1000;
  const clone = x => JSON.parse(JSON.stringify(x));
  const dateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).filter(x => ['year','month','day'].includes(x.type)).reduce((a,x) => ({...a,[x.type]:x.value}), {});
  function today(date = new Date()) { const p = dateKey(date); return `${p.year}-${p.month}-${p.day}`; }
  function offset(date, n) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s; }
  function number(value, label, positive = false) { const n = Number(value); if (value === '' || value === null || !Number.isFinite(n) || n < 0 || (positive && n === 0) || n > 1000000) throw new Error(`${label}请输入${positive ? '大于 0 的' : '非负'}有效数字（不超过 1000000）`); return n; }
  const id = () => root.crypto?.randomUUID?.() || 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  function defaults() {
    const rows = [
      ['milk','脱脂牛奶','瓶',8,90,'🥛','1 瓶',2],
      ['bread','全麦面包','片',4,80,'🍞','1 片',2],
      ['oats','燕麦','份',4,120,'🥣','1 份 = 80 ml',1],
      ['sausage','鸡胸肉肠','根',15,150,'🌭','1 根 = 100g',1],
      ['chicken','鸡胸肉','包',11,60,'🍗','1 包 = 50g',1],
      ['eggs','鸡蛋','个',6.5,70,'🥚','1 个',2],
      ['canteen','食堂肉菜','顿',20,350,'🍲','1 顿（份量因菜品而异）',1]
    ];
    return rows.map(([id,name,unit,protein,calories,icon,note,quickAmount]) => ({id,name,type:'portion',unit,protein,calories,baseAmount:1,favorite:false,createdAt:'2026-09-07T00:00:00+08:00',lastUsedAt:null,icon,note,quickAmount,builtin:true,caloriesEstimated:true}));
  }
  function fresh() { return {version:2,foods:defaults(),days:{},settings:{proteinTarget:110,calorieTarget:1800},migratedKeys:[]}; }
  function day(date, settings) { return {date,foods:[],totalProtein:0,totalCalories:0,proteinTarget:settings.proteinTarget,calorieTarget:settings.calorieTarget,caloriesIncomplete:false}; }
  function total(d) { d.totalProtein=round(d.foods.reduce((s,r)=>s+r.protein,0)); d.totalCalories=round(d.foods.reduce((s,r)=>s+(r.calories ?? 0),0)); d.caloriesIncomplete=d.foods.some(r=>r.calories===null); return d; }
  function snapshot(food, amount, mealType, at = new Date().toISOString()) {
    amount=number(amount,'食用份量',true);
    if (!MEALS[mealType]) throw new Error('请选择餐次');
    return {id:id(),foodId:food.id,snapshotName:food.name,snapshotType:food.type,snapshotUnit:food.unit,snapshotBaseAmount:food.baseAmount,snapshotProtein:food.protein,snapshotCalories:food.calories,snapshotNote:food.note || '',caloriesEstimated:!!food.caloriesEstimated,amount,protein:round(food.protein*amount/food.baseAmount),calories:food.calories===null?null:round(food.calories*amount/food.baseAmount),mealType,createdAt:at};
  }
  function validateFood(input, existing) {
    const name=String(input.name||'').trim(), unit=input.type==='weight'?'g':String(input.unit||'').trim();
    if (!name || name.length>60) throw new Error('食物名称需为 1～60 字');
    if (!unit || unit.length>12) throw new Error('记录单位需为 1～12 字');
    if (!['weight','portion'].includes(input.type)) throw new Error('请选择记录方式');
    return {...existing,id:existing?.id||id(),name,type:input.type,unit,protein:number(input.protein,'蛋白质'),calories:number(input.calories,'热量'),baseAmount:number(input.baseAmount,'基准数量',true),favorite:existing?.favorite||false,createdAt:existing?.createdAt||new Date().toISOString(),caloriesEstimated:false,note:input.note===undefined?(existing?.note||''):String(input.note).slice(0,100)};
  }
  function validState(s) {
    if (!s || s.version!==2 || !Array.isArray(s.foods) || !s.days || typeof s.days!=='object' || Array.isArray(s.days) || !Array.isArray(s.migratedKeys)) return false;
    try {
      number(s.settings.proteinTarget,'目标',true); number(s.settings.calorieTarget,'目标',true);
      for (const f of s.foods) { if (typeof f?.id!=='string' || !f.id || typeof f.name!=='string' || !f.name || typeof f.unit!=='string' || typeof f.createdAt!=='string' || !['portion','weight'].includes(f.type)) return false; number(f.baseAmount,'基准',true); number(f.protein,'蛋白质'); number(f.calories,'热量'); }
      for (const [date,d] of Object.entries(s.days)) {
        if (!validDate(date) || !d || d.date!==date || !Array.isArray(d.foods)) return false;
        number(d.proteinTarget,'目标',true); if(d.calorieTarget!==null) number(d.calorieTarget,'目标',true);
        for (const r of d.foods) { if (typeof r?.id!=='string' || !r.id || typeof r.snapshotName!=='string' || !r.snapshotName || typeof r.snapshotUnit!=='string' || !['portion','weight'].includes(r.snapshotType) || !Object.hasOwn(MEALS,r.mealType)) return false; number(r.amount,'数量',true); number(r.snapshotBaseAmount,'基准',true); number(r.snapshotProtein,'蛋白质'); number(r.protein,'蛋白质'); if(r.calories!==null) number(r.calories,'热量'); if(r.snapshotCalories!==null) number(r.snapshotCalories,'热量'); }
        total(d);
      }
      return true;
    } catch { return false; }
  }
  function migrate(storage, state, currentDate) {
    const warnings=[]; let changed=false;
    const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k && /^protein-checkin:\d{4}-\d{2}-\d{2}$/.test(k));
    for (const key of keys) {
      if(state.migratedKeys.includes(key)) continue;
      try {
        const date=key.slice(16), counts=JSON.parse(storage.getItem(key));
        if (!validDate(date) || !counts || typeof counts!=='object' || Array.isArray(counts)) throw new Error('旧记录格式错误');
        const records=[];
        for (const f of defaults()) {
          if(counts[f.id]===undefined) continue;
          const count=number(counts[f.id],'旧份量');
          if(count>0) records.push({...snapshot({...f,calories:null},count,'snack',date+'T12:00:00+08:00'),id:'legacy-'+date+'-'+f.id,legacy:true});
        }
        // Never replace a day that already exists in the new format.
        if (!state.days[date]) state.days[date]=total({...day(date,date===currentDate?state.settings:{proteinTarget:100,calorieTarget:null}),foods:records,legacy:true});
        state.migratedKeys.push(key); changed=true;
      } catch { warnings.push(`${key.slice(16)} 的旧记录暂未迁移，原数据仍保留`); }
    }
    return {changed,warnings};
  }
  class Store {
    constructor(storage, clock=()=>today()) { this.storage=storage; this.clock=clock; this.state=fresh(); this.blocked=false; this.warnings=[]; this.load(); }
    load() {
      this.warnings=[]; this.blocked=false;
      try {
        const raw=this.storage.getItem(KEY); const next=raw?JSON.parse(raw):fresh();
        if(!validState(next)) throw new Error('保存格式无法识别');
        const migration=migrate(this.storage,next,this.clock()); this.warnings=migration.warnings;
        this.state=next;
        if(migration.changed) this.storage.setItem(KEY,JSON.stringify(next));
      } catch { this.blocked=true; this.warnings.push('本地数据暂时无法读取或保存。原数据未清空；请先导出备份，检查浏览器存储空间或权限后重试。'); }
      return this.state;
    }
    commit(fn) {
      this.load();
      if(this.blocked) throw new Error('本地存储暂不可用，原数据已保留，请先导出备份后重试');
      const next=clone(this.state); const result=fn(next);
      if(!validState(next)) throw new Error('份量或计算结果超出可保存范围，请检查输入');
      try { this.storage.setItem(KEY,JSON.stringify(next)); } catch { throw new Error('保存失败，可能存储空间不足；本次更改未写入，请导出备份后重试'); }
      this.state=next; return result;
    }
    current(s=this.state) { const date=this.clock(); return s.days[date] || day(date,s.settings); }
    writable(s) { const d=this.current(s); s.days[d.date]=d; return d; }
    saveFood(input, foodId) { return this.commit(s=>{const old=s.foods.find(f=>f.id===foodId); if(foodId&&!old) throw new Error('该食物已删除'); const f=validateFood(input,old); if(old) s.foods[s.foods.indexOf(old)]=f; else s.foods.push(f); return f.id;}); }
    removeFood(foodId) { this.commit(s=>{s.foods=s.foods.filter(f=>f.id!==foodId);}); }
    favorite(foodId) { this.commit(s=>{const f=s.foods.find(f=>f.id===foodId); if(f) f.favorite=!f.favorite;}); }
    add(foodId,amount,mealType) { return this.commit(s=>{const f=s.foods.find(f=>f.id===foodId); if(!f) throw new Error('食物已删除，请重新选择'); const r=snapshot(f,amount,mealType); const d=this.writable(s); d.foods.push(r); total(d); f.lastUsedAt=r.createdAt; return r.id;}); }
    amount(recordId,amount,expectedDate) { this.commit(s=>{if(expectedDate && expectedDate!==this.clock()) throw new Error('已进入新的一天，请重新选择记录'); const d=this.writable(s); const r=d.foods.find(r=>r.id===recordId); if(!r) throw new Error('记录不存在或日期已切换'); amount=number(amount,'食用份量',true); r.amount=amount; r.protein=round(r.snapshotProtein*amount/r.snapshotBaseAmount); r.calories=r.snapshotCalories===null?null:round(r.snapshotCalories*amount/r.snapshotBaseAmount); total(d);}); }
    remove(recordId,expectedDate) { this.commit(s=>{if(expectedDate&&expectedDate!==this.clock()) throw new Error('日期已切换，请重新选择记录');const d=this.writable(s);d.foods=d.foods.filter(r=>r.id!==recordId);total(d);}); }
    targets(protein,calories) { this.commit(s=>{s.settings={proteinTarget:number(protein,'蛋白质目标',true),calorieTarget:number(calories,'热量目标',true)}; Object.assign(this.writable(s),s.settings);}); }
    copyYesterday() { return this.commit(s=>{const d=this.writable(s), source=s.days[offset(d.date,-1)]; if(d.copiedFrom===source?.date) throw new Error('今天已经复制过昨天的饮食，无需重复复制'); if(!source?.foods.length) throw new Error('昨天没有可复制的饮食记录'); d.foods.push(...source.foods.map(r=>({...clone(r),id:id(),createdAt:new Date().toISOString(),copiedFrom:r.id}))); d.copiedFrom=source.date; total(d); for(const r of source.foods){const f=s.foods.find(f=>f.id===r.foodId);if(f)f.lastUsedAt=new Date().toISOString();}return source.foods.length;}); }
    reset(expectedDate) { this.commit(s=>{if(expectedDate&&expectedDate!==this.clock())throw new Error('日期已切换，请重新确认');const d=this.writable(s);d.foods=[];total(d);}); }
    sortedFoods() { return [...this.state.foods].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||''))||a.createdAt.localeCompare(b.createdAt)); }
    stats(n) { const dates=Array.from({length:n},(_,i)=>offset(this.clock(),-i));const days=dates.map(date=>this.state.days[date]||null);const recorded=days.filter(Boolean),calorieDays=recorded.filter(d=>!d.caloriesIncomplete);return {dates,days,recorded:recorded.length,calorieDays:calorieDays.length,protein:recorded.length?round(recorded.reduce((s,d)=>s+d.totalProtein,0)/recorded.length):null,calories:calorieDays.length?round(calorieDays.reduce((s,d)=>s+d.totalCalories,0)/calorieDays.length):null}; }
    backup() { const data={}; for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key===KEY||key.startsWith('protein-checkin:'))data[key]=this.storage.getItem(key);}return JSON.stringify({exportedAt:new Date().toISOString(),data},null,2); }
  }
  const api={Store,KEY,MEALS,today,offset,defaults,snapshot,round,validState};
  if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.DietData=api;
})(typeof globalThis!=='undefined'?globalThis:this);
