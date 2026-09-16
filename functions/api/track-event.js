/**
 * functions/api/track-event.js — P0.2 Attention Tracking
 */
const VALID_EVENT_TYPES = new Set(['view','scroll_25','scroll_50','scroll_75','scroll_100','click','exit']);
const VALID_SECTIONS = new Set(['review','comparison','faq','buying_guide','cta']);
const VALID_CHANNELS = new Set(['facebook','x','pinterest','website','direct','email','other']);
const BOT_PATTERN = /bot|crawler|spider|crawling|facebookexternalhit|google|bing|yandex|baidu|duckduck|slurp|teoma|ia_archiver/i;

function detectDevice(ua=''){
  if(/mobile|android|iphone|ipad|ipod/i.test(ua)) return /ipad|tablet/i.test(ua)?'tablet':'mobile';
  return 'desktop';
}

export async function onRequestOptions({ request }){
  return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
}

export async function onRequestPost({ request, env }){
  const ua = request.headers.get('User-Agent')||'';
  if(BOT_PATTERN.test(ua)) return Response.json({ok:false,error:'bot'},{status:400});

  let body;
  try{ body = await request.json(); }
  catch{ return Response.json({ok:false,error:'invalid JSON'},{status:400}); }

  const {session_id,product_id,variant_id,channel,event_type,section} = body;
  if(!session_id||typeof session_id!=='string'||session_id.length>128)
    return Response.json({ok:false,error:'session_id invalid'},{status:400});
  if(!event_type||!VALID_EVENT_TYPES.has(event_type))
    return Response.json({ok:false,error:'event_type invalid'},{status:400});

  const safeProductId = product_id&&Number.isInteger(Number(product_id))?Number(product_id):null;
  const safeVariantId = variant_id&&typeof variant_id==='string'?variant_id.slice(0,64):null;
  const safeChannel = channel&&VALID_CHANNELS.has(channel)?channel:'other';
  const safeSection = section&&VALID_SECTIONS.has(section)?section:null;

  try{
    await env.DB.prepare(
      `INSERT INTO attention_events (session_id,product_id,variant_id,channel,event_type,section,device,ts) VALUES (?,?,?,?,?,?,?,?)`
    ).bind(session_id,safeProductId,safeVariantId,safeChannel,event_type,safeSection,detectDevice(ua),new Date().toISOString()).run();
    return Response.json({ok:true},{'Access-Control-Allow-Origin':'*'});
  } catch(err){
    return Response.json({ok:false,error:err.message},{status:500});
  }
}
