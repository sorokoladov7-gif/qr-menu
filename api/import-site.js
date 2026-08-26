module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return res.status(400).json({ error: 'url_required', message: 'Введите адрес сайта заведения' });
  let target;
  try { target = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); }
  catch (_) { return res.status(400).json({ error: 'invalid_url', message: 'Некорректный адрес сайта' }); }
  const host = target.hostname.toLowerCase();
  if (!['http:','https:'].includes(target.protocol) || !host || host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === '169.254.169.254') return res.status(400).json({ error: 'private_url_not_allowed' });

  const clean = (v,max=1000) => String(v||'').replace(/\s+/g,' ').trim().slice(0,max);
  const absolute = (u,base) => { try { return new URL(String(u||''),base||target.href).href; } catch (_) { return null; } };
  const price = v => { const n=String(v||'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.]/g,''); const x=Number(n); return Number.isFinite(x)?x:0; };
  const strip = s => clean(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '),1200);

  const headers={
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 QR-Menu-Importer/3.0',
    'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language':'ru-RU,ru;q=0.9,en-US;q=0.7,en;q=0.5','Cache-Control':'no-cache'
  };
  async function fetchHtml(url){
    const r=await fetch(url,{redirect:'follow',headers,signal:AbortSignal.timeout(18000)});
    if(!r.ok) throw new Error('site_http_'+r.status);
    const type=r.headers.get('content-type')||'';
    if(!/html|xhtml|text/i.test(type)) throw new Error('site_not_html');
    const buf=Buffer.from(await r.arrayBuffer());
    return {html:buf.subarray(0,8*1024*1024).toString('utf8'),finalUrl:r.url||url};
  }
  function walkJson(value,out){
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.forEach(v=>walkJson(v,out));return;}
    const type=Array.isArray(value['@type'])?value['@type'].join(' ').toLowerCase():String(value['@type']||'').toLowerCase();
    if(/restaurant|cafe|bar|bakery|foodestablishment|localbusiness|coffee|fastfood/.test(type))out.business.push(value);
    if(/menuitem|product|offer|recipe|food/.test(type)||value.offers||value.price||value.priceSpecification||value.itemListElement)out.items.push(value);
    if(value.address)out.addresses.push(value.address);
    if(value.openingHours||value.openingHoursSpecification)out.hours.push(value.openingHours||value.openingHoursSpecification);
    Object.keys(value).forEach(k=>{if(k!=='@context'&&k!=='@type')walkJson(value[k],out);});
  }
  function parseStructured(html,base,found){
    const sm=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)||[];
    sm.forEach(s=>{const m=s.match(/>([\s\S]*?)<\/script>/i);if(!m)return;let raw=m[1].trim();try{walkJson(JSON.parse(raw),found);}catch(_){try{walkJson(JSON.parse(raw.replace(/&quot;/g,'\"')),found);}catch(_){}}});
    // Some builders put menu data into JSON-like application scripts rather than JSON-LD.
    const dataScripts=html.match(/<(?:script|template)[^>]*>([\s\S]*?)<\/(?:script|template)>/gi)||[];
    dataScripts.slice(0,80).forEach(s=>{
      const t=s.replace(/<\/?(?:script|template)[^>]*>/gi,' ');
      if(!/(menu|product|dish|price|food|restaurant)/i.test(t))return;
      const names=t.match(/["'](?:name|title)["']\s*:\s*["']([^"']{2,100})["']/gi)||[];
      const prices=t.match(/["'](?:price|amount|value)["']\s*:\s*["']?([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)["']?/gi)||[];
      for(let i=0;i<Math.min(names.length,prices.length,100);i++){
        const nm=names[i].replace(/^[\s\S]*?["']\s*:\s*["']/,'').replace(/["']$/,'');
        const pr=price(prices[i].replace(/^[\s\S]*?:\s*["']?/,'').replace(/["']?$/,''));
        if(nm&&pr>0)found.generic.push({name:clean(nm,160),price:pr});
      }
    });
  }

  let html,finalUrl=target.href,source='direct';
  try{const r=await fetchHtml(target.href);html=r.html;finalUrl=r.finalUrl;}
  catch(directError){
    try{
      const jr=await fetch('https://r.jina.ai/'+target.href,{headers:{'User-Agent':'QR-Menu-Importer/3.0','Accept':'text/plain'},signal:AbortSignal.timeout(22000)});
      if(!jr.ok)throw new Error('reader_http_'+jr.status);
      const text=await jr.text();if(!text||text.length<20)throw new Error('reader_empty');
      html='<html><head><title>'+clean(host.split('.')[0],120)+'</title></head><body>'+text.replace(/</g,'&lt;').replace(/\n/g,'<br>')+'</body></html>';source='reader_fallback';
    }catch(_){return res.status(502).json({error:'site_fetch_failed',message:'Не удалось получить сайт. Сайт может блокировать автоматический доступ или требовать JavaScript.',details:clean(directError&&directError.message,180)});}
  }

  // Also inspect likely menu/catalog pages. Many restaurant sites keep the actual menu
  // outside the homepage and expose only a navigation link to it.
  const pageHtml=[{html,base:finalUrl}];
  const links=[];
  const linkRe=/<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let lm;
  while((lm=linkRe.exec(html))&&links.length<80){
    const href=absolute(lm[1],finalUrl),txt=strip(lm[2],180);
    if(href&&new URL(href).hostname===new URL(finalUrl).hostname&&/(menu|меню|catalog|каталог|food|dish|блюд|еда|цены|price|restaurant)/i.test((href+' '+txt)))links.push(href.split('#')[0]);
  }
  const uniqueLinks=[...new Set(links)].slice(0,6);
  for(const u of uniqueLinks){try{const r=await fetchHtml(u);pageHtml.push({html:r.html,base:r.finalUrl});}catch(_){} }

  const found={business:[],items:[],addresses:[],hours:[],generic:[]};
  pageHtml.forEach(p=>parseStructured(p.html,p.base,found));
  const b=found.business[0]||{};
  const addr=b.address&&typeof b.address==='object'?b.address:(found.addresses.find(x=>x&&typeof x==='object')||{});
  const address=clean(typeof b.address==='string'?b.address:[addr.streetAddress,addr.addressLocality,addr.addressRegion,addr.postalCode].filter(Boolean).join(', '));
  const title=clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[,''])[1].replace(/<[^>]+>/g,''));
  const desc=clean((html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i)||[,''])[1]);
  const image=absolute((html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']*)["']/i)||[,''])[1],finalUrl);
  const phone=clean(b.telephone||(html.match(/(?:tel:|phone|telephone)[^>]*>\s*([^<+\d]*\+?[\d ()\-]{7,})/i)||[,''])[1],80);
  const logo=absolute(b.logo&&(typeof b.logo==='string'?b.logo:b.logo.url),finalUrl)||image;
  const website=clean(b.url||target.href,500);
  let openingHours=b.openingHours||b.openingHoursSpecification||found.hours[0]||null;if(openingHours&&!Array.isArray(openingHours))openingHours=[openingHours];

  const products=[],seen=new Set();
  function addProduct(name,p,description,category,img){name=clean(name,160);p=price(p);if(!name||p<=0||seen.has(name.toLowerCase()))return;seen.add(name.toLowerCase());products.push({name,description:clean(description)||null,price:p,category:clean(category,120)||'main',image_url:absolute(img,finalUrl),is_available:true,applies_to:'all'});}
  found.items.forEach(it=>{
    const offers=Array.isArray(it.offers)?it.offers[0]:it.offers;
    const spec=offers&&offers.priceSpecification?(Array.isArray(offers.priceSpecification)?offers.priceSpecification[0]:offers.priceSpecification):null;
    addProduct(it.name||it.title,(offers&&(offers.price||offers.lowPrice))||(spec&&(spec.price||spec.minPrice))||it.price,it.description,it.category,typeof it.image==='string'?it.image:it.image&&it.image.url);
  });
  found.generic.forEach(x=>addProduct(x.name,x.price,null,'main',null));

  // Broad HTML fallback: inspect repeated menu/product/card/article/list blocks and extract
  // a nearby price plus a human-looking heading/name. This works with many Tilda/WordPress/
  // custom restaurant layouts even when they have no structured data.
  if(!products.length){
    for(const pg of pageHtml){
      const h=pg.html;
      const blocks=h.match(/<(?:article|section|li|div)[^>]*(?:menu|product|dish|food|item|card|catalog|price)[^>]*>[\s\S]{0,5000}?<\/(?:article|section|li|div)>/gi)||[];
      for(const block of blocks.slice(0,500)){
        const text=strip(block,1600);
        const pm=text.match(/(?:^|\s)(\d[\d\s]{0,7}(?:[.,]\d{1,2})?)\s*(?:₽|руб(?:лей|ля)?\.?|р\.?|RUB)(?:\s|$)/i);
        if(!pm)continue;
        const p=price(pm[1]);
        const before=clean(text.slice(0,Math.max(0,text.indexOf(pm[0]))),260);
        const parts=before.split(/[|·•\n]+/).map(clean).filter(x=>x.length>=2);
        let name=parts[parts.length-1]||before;
        name=name.replace(/^(меню|цены|каталог|блюдо|товар)\s*[:\-]?\s*/i,'');
        if(name.length>2)addProduct(name,p,null,'main',null);
        if(products.length>=500)break;
      }
      if(products.length>=500)break;
    }
  }

  // Last-resort plain-text price scan for reader-fallback pages.
  if(!products.length&&source==='reader_fallback'){
    const text=strip(html,12000), lines=text.split(/\n|<br\s*\/?>/i).map(clean).filter(Boolean);
    for(let i=0;i<lines.length;i++){
      const pm=lines[i].match(/(\d[\d\s]{0,7}(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|р\.?|RUB)/i);if(!pm)continue;
      const p=price(pm[1]);const name=clean(lines[i].replace(pm[0],'').replace(/^[-–—:|·•\s]+|[-–—:|·•\s]+$/g,''),160);if(name&&p>0)addProduct(name,p,null,'main',null);
      if(products.length>=500)break;
    }
  }

  return res.status(200).json({source_url:target.href,venue:{name:clean(b.name||title||host.split('.')[0],180),description:clean(b.description||desc,1200),address,phone,website_url:website,logo_url:logo,opening_hours:openingHours},products:products.slice(0,500),meta:{products_found:products.length,structured_data:found.business.length>0||found.items.length>0,source,menu_pages_checked:pageHtml.length}});
};
