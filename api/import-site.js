module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'method_not_allowed'});
  const raw=String((req.query&&req.query.url)||(req.body&&req.body.url)||'').trim();
  if(!raw)return res.status(400).json({error:'url_required',message:'Введите адрес сайта заведения'});
  let target;try{target=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw)}catch(e){return res.status(400).json({error:'invalid_url',message:'Некорректный адрес сайта'})}
  const host=target.hostname.toLowerCase();
  if(!['http:','https:'].includes(target.protocol)||/^(localhost|127\.0\.0\.1|169\.254\.169\.254|0\.0\.0\.0)$/.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host))return res.status(400).json({error:'private_url_not_allowed'});
  const clean=(v,n=1500)=>String(v||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim().slice(0,n);
  const abs=(u,b)=>{try{return new URL(String(u||''),b||target.href).href}catch(e){return null}};
  const price=v=>{const m=String(v||'').replace(/\u00a0/g,' ').match(/(?:^|\s)(\d{1,6}(?:[\s]\d{3})*(?:[.,]\d{1,2})?)\s*(?:₽|р\.?|руб\.?|рублей|RUB)(?=\s|$)/i);return m?Number(m[1].replace(/\s/g,'').replace(',','.')):0};
  const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 QR-Menu-Importer/9.0','Accept':'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8','Accept-Language':'ru-RU,ru;q=0.9,en-US;q=0.7'};
  async function getHtml(url){const r=await fetch(url,{redirect:'follow',headers,signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('http_'+r.status);const ct=r.headers.get('content-type')||'';if(!/html|xhtml|text/i.test(ct))throw Error('not_html');const b=Buffer.from(await r.arrayBuffer());return {html:b.subarray(0,12*1024*1024).toString('utf8'),url:r.url||url,mode:'html'};}
  async function getReader(url){const r=await fetch('https://r.jina.ai/'+url,{headers:{'User-Agent':'QR-Menu-Importer/9.0','Accept':'text/plain'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('reader_'+r.status);return {text:(await r.text()).slice(0,12*1024*1024),url,mode:'text'};}
  const pages=[];let source='direct';
  try{pages.push(await getHtml(target.href))}catch(e){try{pages.push(await getReader(target.href));source='reader_fallback'}catch(x){return res.status(502).json({error:'site_fetch_failed',message:'Не удалось получить сайт. Сайт может блокировать автоматический доступ.',details:clean(e.message,180)})}}
  const same=u=>{try{return new URL(u).hostname.replace(/^www\./,'')===new URL(target.href).hostname.replace(/^www\./,'')}catch(e){return false}};
  const candidates=[];const menuWords=/(menu|меню|catalog|каталог|food|dish|блюд|еда|price|цены|ассортимент|bar|бар|пицц|суш|ролл|напит|dessert|десерт)/i;
  if(pages[0].mode==='html'){const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(pages[0].html))&&candidates.length<250){const u=abs(m[1],pages[0].url),txt=clean(m[2].replace(/<[^>]+>/g,' '),250);if(u&&same(u)&&menuWords.test(u+' '+txt))candidates.push(u.split('#')[0])}}
  for(const p of ['/menu','/Menu','/menu/','/Menu/','/menyu','/menyu/','/catalog','/catalog/','/food','/food/','/dishes','/dishes/','/restaurant/menu','/restaurant/menu/']){const u=abs(p,target.href);if(u&&!candidates.includes(u))candidates.push(u)}
  const uniqueCandidates=[...new Set(candidates)].slice(0,24);
  for(const u of uniqueCandidates){try{pages.push(await getHtml(u))}catch(e){try{pages.push(await getReader(u))}catch(x){}}}
  function decode(s){return String(s).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')}
  function lines(pg){if(pg.mode==='text')return decode(pg.text).split(/\r?\n+/).map(x=>clean(x,600)).filter(Boolean);let s=pg.html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');s=s.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:div|p|li|section|article|h1|h2|h3|h4|h5|h6|tr|td|th|a|button|label)>/gi,'\n').replace(/<[^>]+>/g,' ');return decode(s).split(/\r?\n+/).map(x=>clean(x,600)).filter(Boolean)}
  const categoriesRe=/^(новинки|закуски|салаты|супы|горячие блюда(?: из (мяса|рыбы))?|паста|бургеры|пицца|специи и соусы|соусы|суши|классические роллы|авторские роллы|жаренные роллы|запеченные роллы|роллы|десерты|детское меню|детское|барная карта|карта бара|напитки|завтраки|основные блюда|горячее|рыба|мясо)$/i;
  const noise=/^(меню|главная|о нас|интерьер|доставка|акции|контакты|резерв стола|забронировать|заказать|добавить в корзину|калории|белки|жиры|углеводы|наш адрес|адрес|телефон|разработка сайта|вход|регистрация|0|1)$/i;
  const weight=/^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/i;
  const products=[],seen=new Set(),categories=new Set();
  function add(name,p,desc,cat,img){name=clean(name,180);p=Number(p||0);if(!name||!p||p<1||p>1000000||noise.test(name)||weight.test(name)||categoriesRe.test(name))return;const key=(cat+'|'+name).toLowerCase();if(seen.has(key))return;seen.add(key);products.push({name,description:clean(desc,1200)||null,price:p,category:clean(cat,120)||'main',image_url:img||null,is_available:true,applies_to:'all'})}
  const menuPage=pages.filter(pg=>/\/(menu|menyu|catalog|food|dishes)(?:\/|$)/i.test(pg.url||''));
  const sourcePages=menuPage.length?menuPage:pages;
  for(const pg of sourcePages){
    const ls=lines(pg);let category='main';
    for(let i=0;i<ls.length;i++){
      const current=ls[i];
      if(categoriesRe.test(current)){category=current;categories.add(current);continue}
      const p=price(current);if(!p)continue;
      // Real Lemon-style DOM/text order: PRICE -> WEIGHT -> IMAGE -> NAME -> DESCRIPTION.
      let name='';let nameIndex=-1;
      for(let j=i+1;j<Math.min(i+12,ls.length);j++){
        const x=ls[j];
        if(!x||price(x)||weight.test(x)||noise.test(x)||/^\d+$/.test(x))continue;
        if(categoriesRe.test(x)){break;}
        if(x.length>=2&&x.length<=180){name=x;nameIndex=j;break}
      }
      // Some sites put NAME before PRICE. Use a short backward scan only when no forward title exists.
      if(!name){for(let j=i-1;j>=Math.max(0,i-8);j--){const x=ls[j];if(!x||price(x)||weight.test(x)||noise.test(x)||categoriesRe.test(x))continue;if(x.length>=2&&x.length<=180){name=x;nameIndex=j;break}}}
      if(name){let desc='';if(nameIndex>i){for(let j=nameIndex+1;j<Math.min(nameIndex+6,ls.length);j++){const x=ls[j];if(price(x)||weight.test(x)||categoriesRe.test(x)||noise.test(x))break;if(x.length>=8&&x.length<=1200)desc+=(desc?' ':'')+x}}add(name,p,desc,category,null)}
    }
  }
  // Structured data remains a supplementary source.
  for(const pg of pages.filter(x=>x.mode==='html')){const ss=pg.html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];for(const s of ss){try{const q=s.replace(/^.*?>/,'').replace(/<\/script>.*$/i,'');const d=JSON.parse(q),walk=x=>{if(!x)return;if(Array.isArray(x)){x.forEach(walk);return}if(typeof x!=='object')return;const t=String(x['@type']||'');if(/product|menuitem|recipe/i.test(t)||x.price||x.offers){const o=Array.isArray(x.offers)?x.offers[0]:x.offers;add(x.name||x.title,o?.price||o?.lowPrice||x.price,x.description,x.category,typeof x.image==='string'?abs(x.image,pg.url):null)}Object.values(x).forEach(walk)};walk(d)}catch(e){}}}
  let business={};for(const pg of pages.filter(x=>x.mode==='html')){const ss=pg.html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];for(const s of ss){try{const q=s.replace(/^.*?>/,'').replace(/<\/script>.*$/i,'');const d=JSON.parse(q),stack=Array.isArray(d)?[...d]:[d];while(stack.length){const x=stack.shift();if(!x||typeof x!=='object')continue;if(Array.isArray(x['@graph']))stack.push(...x['@graph']);if(/restaurant|cafe|bar|foodestablishment|localbusiness/i.test(String(x['@type']||''))){business=x;break}}}catch(e){}}}
  const home=lines(pages[0]).join('\n');const title=pages[0].mode==='html'?clean((pages[0].html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[,''])[1].replace(/<[^>]+>/g,''),180):'';
  const phone=clean(business.telephone||(home.match(/(?:\+7|8)[\s()\-\d]{9,}/)||['',''])[0],80);
  const address=clean(typeof business.address==='string'?business.address:[business.address?.streetAddress,business.address?.addressLocality,business.address?.addressRegion,business.address?.postalCode].filter(Boolean).join(', '),500);
  return res.status(200).json({source_url:target.href,venue:{name:clean(business.name||title||host.split('.')[0],180),description:clean(business.description||'',1200),address,phone,website_url:target.href,logo_url:typeof business.logo==='string'?abs(business.logo,target.href):business.logo?.url?abs(business.logo.url,target.href):null,opening_hours:business.openingHours||business.openingHoursSpecification||null},products:products.slice(0,500),meta:{products_found:products.length,menu_found:products.length>=3,structured_data:!!business.name,source,pages_checked:pages.length,menu_links_found:uniqueCandidates.length,categories_found:[...categories]}});
};
