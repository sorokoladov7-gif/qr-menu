module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'method_not_allowed'});
  const raw=String((req.query&&req.query.url)||(req.body&&req.body.url)||'').trim();
  if(!raw)return res.status(400).json({error:'url_required',message:'Введите адрес сайта заведения'});
  let target; try{target=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw)}catch(e){return res.status(400).json({error:'invalid_url',message:'Некорректный адрес сайта'})}
  const host=target.hostname.toLowerCase();
  if(!['http:','https:'].includes(target.protocol)||/^(localhost|127\.0\.0\.1|169\.254\.169\.254)$/.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host))return res.status(400).json({error:'private_url_not_allowed'});
  const clean=(v,n=1000)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
  const abs=(u,b)=>{try{return new URL(String(u||''),b||target.href).href}catch(e){return null}};
  const price=v=>{const m=String(v||'').replace(/\u00a0/g,' ').match(/\d[\d\s]*(?:[.,]\d{1,2})?/);return m?Number(m[0].replace(/\s/g,'').replace(',','.')):0};
  const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 QR-Menu-Importer/4.0','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'ru-RU,ru;q=0.9,en-US;q=0.7,en;q=0.5'};
  async function get(url){const r=await fetch(url,{redirect:'follow',headers,signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('http_'+r.status);const ct=r.headers.get('content-type')||'';if(!/html|xhtml|text/i.test(ct))throw Error('not_html');const b=Buffer.from(await r.arrayBuffer());return {html:b.subarray(0,10*1024*1024).toString('utf8'),url:r.url||url}}
  const pages=[]; let source='direct';
  try{pages.push(await get(target.href))}catch(e){try{const r=await fetch('https://r.jina.ai/'+target.href,{headers:{'User-Agent':'QR-Menu-Importer/4.0'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('reader_'+r.status);const t=await r.text();pages.push({html:'<html><body>'+t.replace(/</g,'&lt;').replace(/\n/g,'<br>')+'</body></html>',url:target.href});source='reader_fallback'}catch(x){return res.status(502).json({error:'site_fetch_failed',message:'Не удалось получить сайт. Сайт может блокировать автоматический доступ.',details:clean(e.message,180)})}}
  const same=u=>{try{return new URL(u).hostname===new URL(pages[0].url).hostname}catch(e){return false}};
  const links=[]; const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m; while((m=re.exec(pages[0].html))&&links.length<150){const u=abs(m[1],pages[0].url),txt=clean(m[2].replace(/<[^>]+>/g,' '),200);if(u&&same(u)&&!/[.]pdf(?:$|[?#])/i.test(u)&&/(menu|меню|catalog|каталог|food|dish|блюд|еда|price|цены|ассортимент|bar|бар)/i.test(u+' '+txt))links.push(u.split('#')[0])}
  for(const u of [...new Set(links)].slice(0,12)){try{pages.push(await get(u))}catch(e){}}
  const found={business:[],items:[],categories:new Set(),generic:[]};
  function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return}const t=Array.isArray(x['@type'])?x['@type'].join(' '):String(x['@type']||'');if(/restaurant|cafe|bar|bakery|foodestablishment|localbusiness|coffee|fastfood/i.test(t))found.business.push(x);if(/menuitem|product|offer|recipe|food/i.test(t)||x.offers||x.price||x.priceSpecification)found.items.push(x);Object.values(x).forEach(walk)}
  function structured(html){const ss=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];for(const s of ss){const q=s.replace(/^.*?>/,'').replace(/<\/script>.*$/i,'').trim();try{walk(JSON.parse(q))}catch(e){try{walk(JSON.parse(q.replace(/&quot;/g,'"')))}catch(x){}}}}
  function textLines(html){let s=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');s=s.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:div|p|li|section|article|h1|h2|h3|h4|h5|h6|tr|td|th|a)>/gi,'\n').replace(/<[^>]+>/g,' ');s=s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'");return s.split(/\n+/).map(x=>clean(x,500)).filter(Boolean)}
  function add(name,p,desc,cat,img){name=clean(name,180);p=price(p);if(!name||!p||p<1||p>1000000)return;if(products.some(x=>x.name.toLowerCase()===name.toLowerCase()))return;products.push({name,description:clean(desc,1200)||null,price:p,category:clean(cat,120)||'main',image_url:abs(img,pages[0].url)||null,is_available:true,applies_to:'all'})}
  const products=[];
  for(const pg of pages)structured(pg.html);
  const b=found.business[0]||{}; const a=b.address||{};
  const title=clean((pages[0].html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[,''])[1].replace(/<[^>]+>/g,''),180);
  const desc=clean((pages[0].html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)/i)||[,''])[1],1200);
  const og=abs((pages[0].html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']*)/i)||[,''])[1],pages[0].url);
  const phone=clean(b.telephone||(pages[0].html.match(/(?:\+7|8)[\s()\-\d]{9,}/)||['',''])[0],80);
  const address=clean(typeof a==='string'?a:[a.streetAddress,a.addressLocality,a.addressRegion,a.postalCode].filter(Boolean).join(', '),500);
  const logo=abs(typeof b.logo==='string'?b.logo:b.logo&&b.logo.url,pages[0].url)||og;
  // Structured products.
  for(const it of found.items){const o=Array.isArray(it.offers)?it.offers[0]:it.offers;const s=o&&o.priceSpecification;add(it.name||it.title,o&&(o.price||o.lowPrice)||it.price||s&&(s.price||s.minPrice),it.description,it.category,typeof it.image==='string'?it.image:it.image&&it.image.url)}
  // Universal text-menu parser. Handles pages like Lemon where the sequence is
  // category -> price -> weight -> image -> dish name -> description.
  for(const pg of pages){
    const lines=textLines(pg.html); let category='main';
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(line.length<=80&&/(закус|салат|суп|бургер|пицц|ролл|суш|десерт|соус|напит|бар|паст|горяч|детск|breakfast|burger|pizza|sushi|dessert|drink|menu|catalog)/i.test(line)&&!/(\d[\d\s]*[₽р])/i.test(line)){category=line;found.categories.add(line);continue}
      if(!/(?:^|\s)\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|р\.?|руб\.?|рублей|RUB)(?:\s|$)/i.test(line))continue;
      const p=price(line); let name=''; let desc2='';
      // In many menu layouts the price is printed before the dish name.
      for(let j=i+1;j<=Math.min(i+6,lines.length-1);j++){
        const x=lines[j]; if(!x||/(?:^|\s)\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|р\.?|руб\.?|RUB)/i.test(x)||/^\d+\s*(?:г|гр|кг|мл|шт)\.?$/i.test(x))continue;
        if(/^(добавить в корзину|калории|белки|жиры|углеводы)$/i.test(x))continue;
        if(!name){name=x;continue} if(desc2.length<700)desc2+=' '+x; else break;
      }
      if(name)add(name,p,desc2,category,null);
    }
  }
  // Generic card fallback for builders where text order is inside one element.
  if(!products.length){for(const pg of pages){const blocks=pg.html.match(/<(?:article|li|div|section)[^>]*>([\s\S]{0,6000}?)<\/(?:article|li|div|section)>/gi)||[];for(const block of blocks.slice(0,1000)){const t=textLines(block);const pi=t.findIndex(x=>/(?:₽|руб\.?|р\.?|RUB)/i.test(x));if(pi<0)continue;const p=price(t[pi]);const n=t.find((x,k)=>k!==pi&&x.length>2&&!/^\d/.test(x)&&!/(?:₽|руб|р\.|г$|гр$|мл$)/i.test(x));if(n)add(n,p,t.slice(0,8).filter(x=>x!==n&&x!==t[pi]).join(' '),'main',null);if(products.length>=500)break}if(products.length>=500)break}}
  const result={source_url:target.href,venue:{name:clean(b.name||title||host.split('.')[0],180),description:clean(b.description||desc,1200),address,phone,website_url:clean(b.url||target.href,500),logo_url:logo,opening_hours:b.openingHours||b.openingHoursSpecification||null},products:products.slice(0,500),meta:{products_found:products.length,structured_data:found.business.length>0||found.items.length>0,source,pages_checked:pages.length,menu_links_found:[...new Set(links)].length,categories_found:[...found.categories]}};
  return res.status(200).json(result);
};
