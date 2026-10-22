// js/supabase-client.js
// =====================================================
// IMPORTANTE: aquí va SOLO la clave PÚBLICA (publishable / anon).
// NUNCA pegues aquí la clave service_role ni la «secret»:
// cualquiera que abra F12 podría copiarla y borrar toda tu base.
//
// Dónde copiarla: Supabase > Project Settings > API Keys
//   - «publishable» (empieza con sb_publishable_...)  <- preferida
//   - o la «anon» (empieza con eyJ...) si tu proyecto aún usa las antiguas
// =====================================================
const SUPABASE_URL = "https://tyhogygzjnyxvyvmozqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3TR4htwzZFJArc1s1Xm_Fw_RTvWgOl4";

const sup = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
