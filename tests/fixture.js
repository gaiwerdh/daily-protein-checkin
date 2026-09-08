// Browser test fixture served ONLY on the separate local test origin :8767.
// Synthetic data never goes to GitHub Pages or the user's production storage.
(() => {
  const RealDate=Date;
  let now=Number(sessionStorage.getItem('fixture-clock'))||Date.parse('2026-09-08T04:00:00Z');
  window.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  if(!sessionStorage.getItem('fixture-seeded')){
    for(let i=1;i<=30;i++){const date=new RealDate(Date.parse('2026-09-08T04:00:00Z')-i*86400000).toISOString().slice(0,10);localStorage.setItem('protein-checkin:'+date,JSON.stringify({eggs:2}));}
    localStorage.setItem('protein-checkin:2026-09-08',JSON.stringify({milk:1}));
    sessionStorage.setItem('fixture-seeded','yes');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const panel=document.createElement('div');panel.style='padding:15px;background:#23321b;position:relative;z-index:1';
    panel.innerHTML='<p>仅本地测试：30 天旧数据 + 模拟北京时间</p><button id="fixtureNext">测试：跨到下一天</button><p id="fixtureEvidence"></p>';
    document.body.prepend(panel);
    document.getElementById('fixtureNext').onclick=()=>{now+=86400000;sessionStorage.setItem('fixture-clock',String(now));window.dispatchEvent(new Event('focus'));};
    const old=localStorage.getItem('protein-checkin:2026-09-07');document.getElementById('fixtureEvidence').textContent='旧数据仍保留：'+old;
  });
})();
