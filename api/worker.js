// FaunaSantiago API — Cloudflare Worker
// Deploy separately with: npx wrangler deploy -c api/wrangler.toml
const ALLOWED_ORIGIN = "https://neo172023.github.io";
const MAX_IMAGES = 3;
const MAX_BYTES = 4 * 1024 * 1024;
function cors(origin) {
  return {"Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods":"POST, OPTIONS, GET",
    "Access-Control-Allow-Headers":"Content-Type",
    "Vary":"Origin"};
}
function json(body, status=200, origin="") {
  return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...cors(origin)}});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "GET" && url.pathname === "/health")
      return json({service:"FaunaSantiago API",status:"ok",aiConfigured:!!env.OPENAI_API_KEY},200,origin);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
    if (url.pathname !== "/identify") return json({error:"Ruta no encontrada",hint:"GET /health o POST /identify"},404,origin);
    if (request.method !== "POST") return json({error:"Método no permitido"},405,origin);
    if (origin !== ALLOWED_ORIGIN) return json({error:"Origen no autorizado"},403,origin);
    if (!env.OPENAI_API_KEY) return json({error:"Identificación no configurada todavía"},503,origin);
    const len = Number(request.headers.get("Content-Length") || 0);
    if (len > 13 * 1024 * 1024) return json({error:"Solicitud demasiado grande"},413,origin);
    let payload;
    try { payload=await request.json(); } catch { return json({error:"JSON inválido"},400,origin); }
    const images=payload?.images;
    if (!Array.isArray(images)||images.length<1||images.length>MAX_IMAGES)
      return json({error:"Adjuntá entre una y tres imágenes"},400,origin);
    for (const data of images) {
      if(typeof data!=="string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data) || data.length>Math.ceil(MAX_BYTES*4/3)+64)
        return json({error:"Solo JPEG, PNG o WebP de hasta 4 MB por imagen"},400,origin);
    }
    const group=typeof payload.group==="string" ? payload.group.slice(0,80) : "";
    const location=typeof payload.location==="string" ? payload.location.slice(0,180) : "";
    const prompt="Analizá las fotos de un posible animal de Santiago del Estero, Argentina. Son fotos del mismo ejemplar. No inventes certeza. Respondé exclusivamente JSON con las claves candidates (array de hasta 3 objetos con scientific_name, common_name, explanation, confidence como baja/media/alta), observed_features (array de strings), risk (desconocido/posible_riesgo), caution (string). Si no se distingue, candidates vacío. No afirmes jamás que un animal es inofensivo ni descartes peligrosidad. No presentes la respuesta como identificación científica validada. Contexto de grupo: "+group+"; localidad: "+location;
    let upstream;
    try {
      upstream=await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({model:env.VISION_MODEL||"gpt-4o-mini",temperature:0.2,max_tokens:650,
          response_format:{type:"json_object"},messages:[{role:"user",content:[
            {type:"text",text:prompt},...images.map(image_url=>({type:"image_url",image_url:{url:image_url,detail:"low"}}))
          ]}]})
      });
    } catch { return json({error:"No se pudo conectar con el servicio de análisis"},502,origin); }
    if(!upstream.ok) return json({error:"El servicio de análisis no está disponible",status:upstream.status},502,origin);
    try {
      const result=await upstream.json();
      const parsed=JSON.parse(result.choices?.[0]?.message?.content||"{}");
      return json({status:"preliminary",disclaimer:"Sugerencias generadas por IA; no constituyen identificación confirmada ni evaluación de seguridad.",...parsed},200,origin);
    } catch {return json({error:"Respuesta de análisis inválida"},502,origin);}
  }
};
