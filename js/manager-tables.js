// Заглушка: этот модуль использовал ПРЯМЫЕ запросы к venue_tables (insert/update/delete)
// в обход RPC, что небезопасно. Управление столами идёт через:
//   - вкладку "🪑 Зал / Столы" в manager.html (RPC manager_table_board)
//   - tables.html (отдельная страница столов)
console.info('[manager-tables.js] Заглушка. Столы управляются через вкладку в manager.html или tables.html');
