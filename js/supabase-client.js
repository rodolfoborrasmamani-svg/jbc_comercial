// js/supabase-client.js
const SUPABASE_URL = "https://tyhogygzjnyxvyvmozqi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aG9neWd6am55eHZ5dm1venFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5MjU2NCwiZXhwIjoyMTA0NDY4NTY0fQ.FLaKnr1ko--qdOaUBdZxobQHIBTCP6wkaXw4e8jfkbk";
const sup = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
