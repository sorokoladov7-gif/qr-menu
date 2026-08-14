const SUPABASE_URL      = 'https://ulxfsozdryqrnlxzlblt.supabase.co';   // ← вставь
const SUPABASE_ANON_KEY = 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';                   // ← вставь
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DELIVERY_FEE = 150;
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400';