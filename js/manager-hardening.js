// Production hardening helper for manager.html.
// Call this instead of performing venues/subscriptions/manager_venues/products inserts separately.
window.createVenueTransaction = async function(db, form, template, profile, planId, subscriptionEnd){
  if(!db || !form || !template || !profile) throw new Error('Недостаточно данных для создания заведения');
  var products=(template.products||[]).map(function(item){
    return {
      name:item.name,
      description:item.description||null,
      price:Number(item.price)||0,
      category:item.category||'main',
      image_url:item.image_url||null,
      applies_to:item.applies_to||'all',
      is_available:true
    };
  });
  var slug=String(form.slug||'').toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9а-яё_-]/gi,'').replace(/[а-яё]/gi,function(c){
    var m={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
    return m[c.toLowerCase()]||'';
  });
  if(!slug) throw new Error('Некорректный slug');
  var {data,error}=await db.rpc('create_venue_for_manager',{
    p_name:String(form.name||'').trim(),
    p_slug:slug,
    p_plan:planId||'start',
    p_subscription_end:subscriptionEnd,
    p_products:products
  });
  if(error) throw error;
  return data;
};
