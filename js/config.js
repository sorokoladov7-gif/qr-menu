// ВАЖНО: вставьте СВОЙ настоящий anon ключ из Supabase Dashboard → Settings → API
// Он начинается с 'eyJ' и имеет длину около 200 символов!

const SUPABASE_URL = 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseGZzb3pkcnlxcm5seHpsYmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzAzMzgsImV4cCI6MjEwMjIwNjMzOH0.Ray02ePv1_EXMStpfaWWhw2BlRdOuTMniY8Ws1Ps0F8'; // ← ВСТАВЬТЕ СЮДА ДЛИННЫЙ КЛЮЧ ИЗ SUPABASE

window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
