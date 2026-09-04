'use strict';

const pos = require('../integrations/pos');
const SUPABASE_URL = 'https://ulxfsozdryqrnlxzlblt.supabase.co';

function headers(){
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if(!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' };
}

async function sb(path){
  const r = await fetch(`${SUPABASE_URL}${path}`, { headers:headers() });
  const t = await r.text();
  let d=null;
  try{ d=t?JSON.parse(t):null; }catch(_){ d={raw:t}; }
  if(!r.ok) throw new Error((d&&(d.message||d.error))||`Supabase ${r.status}`);
  return d;
}

module.exports = async function(req,res){
  if(req.method!=='GET' && req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
  const secret = process.env.CRON_SECRET;
  if(!secret) return res.status(503).json({error:'cron_secret_not_configured'});
  if(String(req.headers.authorization||'') !== `Bearer ${secret}`) return res.status(401).json({error:'unauthorized'});
  try{
    const rows = await sb('/rest/v1/venue_integrations?status=eq.connected&provider=in.(quick_resto,r_keeper)&select=venue_id,provider&order=venue_id.asc');
    const results = await Promise.all((rows||[]).map(async row=>{
      try{
        const result = await pos.autoSync(String(row.venue_id),String(row.provider));
        return {venue_id:row.venue_id,provider:row.provider,ok:!result.error_count,received:result.received,created:result.created,updated:result.updated,unchanged:result.unchanged,errors:result.error_count};
      }catch(e){
        return {venue_id:row.venue_id,provider:row.provider,ok:false,error:e.message||String(e)};
      }
    }));
    return res.status(200).json({ok:true,count:results.length,results});
  }catch(e){
    return res.status(500).json({ok:false,error:e.message||'integration_sync_error'});
  }
};
