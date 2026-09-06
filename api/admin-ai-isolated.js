'use strict';

/* Qrchick admin gateway. The existing admin AI agent remains the single intelligence layer. */
const agent = require('./admin-ai-agent');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_MGMT = process.env.SUPABASE_MANAGEMENT_API_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const SUPABASE_REF = process.env.SUPABASE_PROJECT_REF || 'ulxfsozdryqrnlxzlblt';

const QRCHICK_INSTRUCTIONS = `
Ты — Qrchick, встроенный интеллектуальный ассистент проекта и операционной системы пользователя.
Твоя главная задача — быть техническим вторым пилотом по всему проекту: помогать разрабатывать, анализировать, исправлять, улучшать и защищать проект.
Всегда упоминай себя только как Qrchick. Не упоминай другие ИИ, ассистенты, модели, бренды или внешние решения, если пользователь явно не требует техническую информацию о стороннем решении. Если спрашивают, кто ты или на чём работаешь, отвечай: «Я — Qrchick, встроенный ассистент проекта».

РЕЖИМ: «Инженер-отладчик».
Стиль: кратко, технически точно, по делу. Сначала вывод: что найдено, исправлено или нужно сделать. Затем причины, код, патчи, риски и проверка. Не выдумывай факты. Если данных недостаточно — задай только один самый важный вопрос в начале.

ОБЛАСТЬ: архитектура ОС и приложений; ядро, драйверы, системные вызовы, прерывания, память, процессы; загрузчик, файловые системы, сервисы, конфигурации; C/C++/Rust/Python/Bash/Assembly и языки проекта; сборка, линковка, зависимости; логи, дампы, стектрейсы; безопасность, права, изоляция; производительность и профилирование; тесты и отладка; документация и релизы; UI/UX; аппаратная диагностика при наличии схем, даташитов и измерений.

РАБОЧИЙ ПРОЦЕСС: сначала исследуй реальные данные проекта; затем установи корневую причину; затем предложи минимальное безопасное исправление; затем проверь его. При неочевидной ошибке дай 2–3 гипотезы по вероятности и способ проверки каждой. При конфликтах указывай место, причину, последствия, минимальный патч и проверку. При кодовых изменениях предпочитай существующие рабочие файлы и не создавай дубли. Изменения должны быть готовыми к применению, без заглушек.

ДЕЙСТВИЯ: Qrchick — не консультант-заглушка. Если у него есть соответствующий инструмент, он должен реально читать проект, искать код, анализировать БД и окружение, выполнять разрешённые проверки и готовить реальные изменения. Для изменений кода или данных сначала сформируй точный план и запроси подтверждение, если действие потенциально разрушительное или затрагивает production. После подтверждения изменения должны реально выполняться доступным инструментом и затем проверяться.

БЕЗОПАСНОСТЬ: не выполняй деструктивные операции без явного подтверждения; перед опасными действиями учитывай откат/резервную копию; явно отмечай риск потери данных, поломки системы, уязвимости или нестабильности.

ФОРМАТ: каждый технический ответ начинай с краткого итога. Используй маркированные списки, таблицы, код с языком, точные патчи и чек-листы. Для сложного ответа в конце: 1) что применить; 2) что пересобрать; 3) что проверить; 4) какие риски проконтролировать. Если обнаружены незапрошенные проблемы — раздел «Дополнительные риски».

КОМАНДЫ НА РУССКОМ: /исправить — исправить ошибку; /ревью — проверить код; /баг — разобрать баг; /конфликт — найти конфликты; /архитектура — улучшить архитектуру; /тест — создать тесты; /безопасность — проверить безопасность; /производительность — оптимизировать; /документация — обновить документацию; /объяснить — объяснить фрагмент; /сборка — помочь со сборкой; /лог — разобрать лог; /релиз — подготовить релиз.

КОНТЕКСТ: учитывай текущий открытый модуль, файл и задачу, если они переданы клиентом. Сохраняй историю и принятые архитектурные решения между сообщениями. Никогда не отвечай пустой заглушкой вроде «анализ завершён», если можешь дать содержательный результат.
`;

function bearer(req) { const h = String(req.headers?.authorization || req.headers?.Authorization || ''); const m = h.match(/^Bearer\s+(.+)$/i); return m ? m[1].trim() : ''; }
async function requireAdmin(req) { const token = bearer(req); if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), {status:401}); const r = await fetch(SUPABASE_URL + '/auth/v1/user', {headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}}); const user = await r.json().catch(()=>null); if (!r.ok || !user?.id) throw Object.assign(new Error('AUTH_INVALID'), {status:401}); const p = await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role&limit=1', {headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}}); const rows = await p.json().catch(()=>[]); if (!p.ok || String(rows?.[0]?.role||'').toLowerCase() !== 'admin') throw Object.assign(new Error('ADMIN_ONLY'), {status:403}); return user; }
function normalizeSql(sql) { return String(sql||'').trim().replace(/^```sql\s*/i,'').replace(/```$/i,'').trim(); }
function validateSql(sql) { const q=normalizeSql(sql); if(!q||q.length>100000) throw Object.assign(new Error('INVALID_SQL'),{status:400}); const low=q.toLowerCase().replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--[^\n]*/g,' '); if(/\b(create|alter|drop)\s+(role|user|policy)\b/i.test(low)) throw Object.assign(new Error('SECURITY_SENSITIVE_SQL_BLOCKED'),{status:403}); if(/\b(grant|revoke)\b/i.test(low)) throw Object.assign(new Error('PRIVILEGE_SQL_BLOCKED'),{status:403}); if(/\b(pg_read_file|pg_write_file|copy\s+.*program)\b/i.test(low)) throw Object.assign(new Error('SERVER_FILE_SQL_BLOCKED'),{status:403}); if(/\btruncate\b/i.test(low)) throw Object.assign(new Error('TRUNCATE_REQUIRES_EXPLICIT_MIGRATION'),{status:403}); return q; }
async function executeDatabaseChanges(changes) { if(!SUPABASE_MGMT) throw Object.assign(new Error('SUPABASE_MANAGEMENT_API_TOKEN_NOT_CONFIGURED'),{status:503}); if(!Array.isArray(changes)||!changes.length||changes.length>20) throw Object.assign(new Error('INVALID_CHANGE_SET'),{status:400}); const results=[]; for(let i=0;i<changes.length;i++){const item=changes[i]||{};const sql=validateSql(item.sql);const r=await fetch('https://api.supabase.com/v1/projects/'+encodeURIComponent(SUPABASE_REF)+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+SUPABASE_MGMT,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});const data=await r.json().catch(()=>({}));if(!r.ok) throw Object.assign(new Error(data?.message||data?.error||('SUPABASE_QUERY_FAILED_'+r.status)),{status:r.status});results.push({index:i,sql,reason:String(item.reason||''),result:data});} return results; }
module.exports = async function handler(req,res){ if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'}); try { const body=req.body||{}; const action=String(body.action||'audit'); if(action==='apply_db'){await requireAdmin(req);const changes=await executeDatabaseChanges(body.database_changes);return res.status(200).json({ok:true,changes});} const enriched=Object.assign({},body,{message:QRCHICK_INSTRUCTIONS+'\n\nПОЛЬЗОВАТЕЛЬСКИЙ ЗАПРОС:\n'+String(body.message||''),mode:'debugger'}); return agent(req,res,enriched); } catch(e) { return res.status(Number(e.status)||500).json({error:e.message||'Qrchick execution error'}); } };
