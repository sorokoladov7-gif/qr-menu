window.QR_DEMO_DATA = {
  user: {
    id: 'demo-user-' + Date.now(),
    email: 'demo@qr-setka.ru',
    user_metadata: { display_name: 'Демо Пользователь' }
  },
  profile: {
    id: 'demo-user', email: 'demo@qr-setka.ru',
    display_name: 'Демо Пользователь', role: 'admin'
  },
  venue: {
    id: 'demo-venue', slug: 'demo-cafe', name: 'Демо Кафе «Прованс»',
    status: 'active', brand_color: '#6366f1', description: 'Демо-заведение',
    subscription_end: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    plan_id: 'demo-plan', manager_permissions: { addons:true, products:true, prices:true, design:true },
    delivery_base_price: 100, delivery_per_km: 30, latitude: 55.75, longitude: 37.61
  },
  session: { venueId: 'demo-venue', venueName: 'Демо Кафе «Прованс»', cookName: 'Иван Петров', courierName: 'Алексей Козлов', waiterName: 'Ольга Новикова' },
  cooks: [{ id:'c1', name:'Иван Петров', phone:'+7 900 111-22-33', pin:'1234', venue_id:'demo-venue' }],
  couriers: [{ id:'cr1', name:'Алексей Козлов', phone:'+7 900 777-88-99', pin:'1111', venue_id:'demo-venue' }],
  waiters: [{ id:'w1', name:'Ольга Новикова', phone:'+7 900 123-45-67', pin:'2222', venue_id:'demo-venue' }],
  products: [
    { id:'p1', name:'Капучино', category:'drink', price:250, is_available:true, description:'Классический капучино', venue_id:'demo-venue' },
    { id:'p2', name:'Сырники со сметаной', category:'breakfast', price:450, is_available:true, description:'Домашние сырники', venue_id:'demo-venue' },
    { id:'p3', name:'Чизкейк Нью-Йорк', category:'dessert', price:350, is_available:true, description:'Нежный чизкейк', venue_id:'demo-venue' },
    { id:'p4', name:'Паста Карбонара', category:'hot', price:520, is_available:true, description:'С беконом', venue_id:'demo-venue' }
  ],
  tables: [
    { id:'t1', table_number:1, name:'Стол 1', seats:4, shape:'round', pos_x:80, pos_y:80, occupancy_status:'occupied', is_active:true, qr_token:'demo-qr-1', venue_id:'demo-venue' },
    { id:'t2', table_number:2, name:'Стол 2', seats:2, shape:'square', pos_x:220, pos_y:80, occupancy_status:'free', is_active:true, qr_token:'demo-qr-2', venue_id:'demo-venue' },
    { id:'t3', table_number:3, name:'Стол 3', seats:6, shape:'rectangle', pos_x:80, pos_y:220, occupancy_status:'reserved', is_active:true, qr_token:'demo-qr-3', venue_id:'demo-venue' }
  ],
  orders: [
    { id:'o1', order_number:101, status:'new', order_type:'pickup', customer_name:'Анна', customer_phone:'+7 999 000-11-22', delivery_address:null, payment_method:'cash', total_price:700, comment:'Без сахара', table_id:'t1', table_number:1, table_name:'Стол 1', created_at:new Date().toISOString(), updated_at:new Date().toISOString(), items:[{product_id:'p1', name:'Капучино', price:250, qty:2}], addons:[] },
    { id:'o2', order_number:102, status:'cooking', order_type:'delivery', customer_name:'Сергей', customer_phone:'+7 999 333-44-55', delivery_address:'ул. Ленина, 15', payment_method:'card', total_price:870, comment:'', cook_name:'Иван Петров', table_id:null, table_number:null, table_name:null, created_at:new Date(Date.now()-600000).toISOString(), updated_at:new Date().toISOString(), items:[{product_id:'p2', name:'Сырники со сметаной', price:450, qty:1},{product_id:'p1', name:'Капучино', price:250, qty:1}], addons:[] },
    { id:'o3', order_number:103, status:'ready', order_type:'delivery', customer_name:'Дмитрий', customer_phone:'+7 999 666-77-88', delivery_address:'пр. Мира, 42', payment_method:'cash', total_price:520, comment:'', cook_name:'Мария Сидорова', table_id:null, table_number:null, table_name:null, created_at:new Date(Date.now()-1200000).toISOString(), updated_at:new Date().toISOString(), items:[{product_id:'p4', name:'Паста Карбонара', price:520, qty:1}], addons:[] }
  ],
  analytics: { revenue:48750, orders:87, clients:64, avgCheck:560, avgCookTime:12, repeatClients:21, typeStats:{pickup:52,delivery:35}, payStats:{cash:40,card:47} }
};
