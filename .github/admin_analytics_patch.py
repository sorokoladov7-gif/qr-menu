from pathlib import Path

p = Path('admin.html')
s = p.read_text(encoding='utf-8')
marker = "\n<!-- ===================== АКТИВНОСТЬ ===================== -->"
if 'data-admin-analytics-expanded="1"' in s:
    raise SystemExit(0)
if marker not in s:
    raise SystemExit('analytics insertion marker not found')

block = r'''
<!-- ===================== РАСШИРЕННАЯ АНАЛИТИКА ===================== -->
<div v-if="tab==='analytics'" data-admin-analytics-expanded="1" style="margin-top:14px">
  <div class="glass card" style="margin-bottom:14px">
    <div class="spread" style="margin-bottom:12px">
      <div>
        <h4 style="margin:0">📊 Расширенные показатели</h4>
        <div class="muted" style="font-size:12px;margin-top:4px">Детализация по текущему выбранному периоду</div>
      </div>
    </div>
    <div class="kpi-grid" style="margin-bottom:0">
      <div class="kpi"><div class="n">{{ adminAnalytics.newClients }}</div><div class="l">Новых клиентов</div></div>
      <div class="kpi"><div class="n">{{ adminAnalytics.repeatClients }}</div><div class="l">Повторных клиентов</div></div>
      <div class="kpi"><div class="n">{{ adminAnalytics.orders ? Math.round(adminAnalytics.orders / Math.max(adminAnalytics.clients,1) * 10) / 10 : 0 }}</div><div class="l">Заказов на клиента</div></div>
      <div class="kpi"><div class="n">{{ adminAnalytics.avgCookTime }} мин</div><div class="l">Среднее приготовление</div></div>
      <div class="kpi"><div class="n">{{ adminAnalytics.trialConversion }}%</div><div class="l">Конверсия trial → платный</div></div>
    </div>
  </div>

  <div class="row" style="margin-bottom:14px;align-items:stretch;flex-wrap:wrap">
    <div class="glass card" style="flex:1;min-width:320px">
      <h4 style="margin:0 0 12px">📅 Динамика заказов по дням</h4>
      <div v-if="!adminAnalytics.daily.length" class="muted">Нет данных за выбранный период</div>
      <div v-for="d in adminAnalytics.daily" v-bind:key="d.date" style="display:flex;align-items:center;gap:10px;margin:7px 0">
        <span style="width:48px;font-size:12px;color:#94a3b8">{{ d.label }}</span>
        <div class="bar" style="flex:1;margin:0"><div class="bar-fill" v-bind:style="{width:(Math.max.apply(null,adminAnalytics.daily.map(function(x){return x.count}))?Math.max(6,Math.round(d.count*100/Math.max.apply(null,adminAnalytics.daily.map(function(x){return x.count})))):0)+'%'}"></div></div>
        <b style="width:34px;text-align:right">{{ d.count }}</b>
      </div>
    </div>

    <div class="glass card" style="flex:1;min-width:320px">
      <h4 style="margin:0 0 12px">🕐 Пиковые часы</h4>
      <div v-if="!adminAnalytics.topHours.length" class="muted">Нет данных</div>
      <div v-for="h in adminAnalytics.topHours" v-bind:key="h.h" style="display:flex;align-items:center;gap:10px;margin:9px 0">
        <b style="width:90px">{{ h.label }}</b>
        <div class="bar" style="flex:1;margin:0"><div class="bar-fill" v-bind:style="{width:(Math.max.apply(null,adminAnalytics.topHours.map(function(x){return x.count}))?Math.max(6,Math.round(h.count*100/Math.max.apply(null,adminAnalytics.topHours.map(function(x){return x.count})))):0)+'%'}"></div></div>
        <span>{{ h.count }}</span>
      </div>
    </div>
  </div>

  <div class="glass card tblwrap" style="margin-bottom:14px">
    <div class="spread" style="margin-bottom:12px"><h4 style="margin:0">🍽️ Самые продаваемые блюда</h4><span class="muted" style="font-size:12px">ТОП-15</span></div>
    <table class="tbl">
      <tr><th>#</th><th>Блюдо</th><th>Продано</th><th>Выручка</th><th>Доля продаж</th></tr>
      <tr v-for="(item,i) in adminAnalytics.topItems" v-bind:key="item.name">
        <td>{{ i+1 }}</td><td><b>{{ item.name }}</b></td><td>{{ item.count }}</td><td style="color:#34d399">{{ fmt(item.revenue) }} ₽</td>
        <td style="min-width:160px"><div class="bar"><div class="bar-fill" v-bind:style="{width:(adminAnalytics.topItems.reduce(function(a,x){return a+x.count},0)?Math.round(item.count*100/adminAnalytics.topItems.reduce(function(a,x){return a+x.count},0)):0)+'%'}"></div></div></td>
      </tr>
      <tr v-if="!adminAnalytics.topItems.length"><td colspan="5" class="muted" style="text-align:center;padding:20px">Нет данных по блюдам</td></tr>
    </table>
  </div>

  <div class="row" style="margin-bottom:14px;align-items:stretch;flex-wrap:wrap">
    <div class="glass card tblwrap" style="flex:1;min-width:320px">
      <h4 style="margin:0 0 12px">🏢 Эффективность заведений</h4>
      <table class="tbl">
        <tr><th>Заведение</th><th>Заказы</th><th>Выручка</th><th>Статус</th></tr>
        <tr v-for="v in adminAnalytics.venueActivity" v-bind:key="v.id"><td><b>{{ v.name }}</b></td><td>{{ v.orders }}</td><td style="color:#34d399">{{ fmt(v.revenue) }} ₽</td><td>{{ v.status==='active'?'Активно':'Пауза' }}</td></tr>
        <tr v-if="!adminAnalytics.venueActivity.length"><td colspan="4" class="muted" style="text-align:center;padding:20px">Нет данных</td></tr>
      </table>
    </div>
    <div class="glass card tblwrap" style="flex:1;min-width:320px">
      <h4 style="margin:0 0 12px">👥 Эффективность персонала</h4>
      <table class="tbl">
        <tr><th>Сотрудник</th><th>Заведение</th><th>Заказы</th><th>Показатель</th></tr>
        <tr v-for="c in adminAnalytics.cookActivity.slice(0,8)" v-bind:key="'c'+c.id"><td>👨‍🍳 {{ c.name }}</td><td>{{ c.venue }}</td><td>{{ c.orders }}</td><td>{{ c.avgTime }} мин</td></tr>
        <tr v-for="c in adminAnalytics.courierActivity.slice(0,4)" v-bind:key="'r'+c.id"><td>🚗 {{ c.name }}</td><td>{{ c.venue }}</td><td>{{ c.delivered }}</td><td>доставок</td></tr>
        <tr v-if="!adminAnalytics.cookActivity.length && !adminAnalytics.courierActivity.length"><td colspan="4" class="muted" style="text-align:center;padding:20px">Нет данных</td></tr>
      </table>
    </div>
  </div>

  <div class="glass card tblwrap">
    <div class="spread" style="margin-bottom:12px"><h4 style="margin:0">👤 Управляющие — результативность</h4><span class="muted" style="font-size:12px">По заказам и выручке</span></div>
    <table class="tbl">
      <tr><th>Управляющий</th><th>Заведений</th><th>Заказов</th><th>Выручка</th><th>Последний вход</th></tr>
      <tr v-for="m in adminAnalytics.managerActivity" v-bind:key="m.id"><td><b>{{ m.name }}</b><div class="muted" style="font-size:11px">{{ m.email }}</div></td><td>{{ m.venues }}</td><td>{{ m.orders }}</td><td style="color:#34d399">{{ fmt(m.revenue) }} ₽</td><td class="muted">{{ m.lastLogin }}</td></tr>
      <tr v-if="!adminAnalytics.managerActivity.length"><td colspan="5" class="muted" style="text-align:center;padding:20px">Нет данных</td></tr>
    </table>
  </div>
</div>
'''

s = s.replace(marker, '\n' + block + marker, 1)
p.write_text(s, encoding='utf-8')
print('patched admin.html')
