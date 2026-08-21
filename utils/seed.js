/**
 * 演示数据：一键导入带价格的演示饮品/分类/店铺信息
 * 依赖 utils/database.js（云数据库不可用时自动落到本地存储），幂等：已有饮品数据则跳过
 */
const db = require('./database.js');

const DEMO_CATEGORIES = ['经典咖啡', '特调咖啡', '茶饮', '鲜果茶'];

const DEMO_DRINKS = [
  { name: '美式咖啡', price: 1200, calories: 10,  description: '精选阿拉比卡豆，浓郁醇厚，回味甘甜', category: '经典咖啡' },
  { name: '拿铁',     price: 1500, calories: 120, description: '醇香浓缩与丝滑牛奶的经典融合', category: '经典咖啡' },
  { name: '卡布奇诺', price: 1600, calories: 110, description: '绵密奶泡，咖啡与牛奶的黄金比例', category: '经典咖啡' },
  { name: '焦糖玛奇朵', price: 1800, calories: 200, description: '香浓焦糖酱与意式浓缩的甜蜜邂逅', category: '经典咖啡' },
  { name: '生椰拿铁', price: 1900, calories: 180, description: '清甜生椰乳搭配浓缩咖啡，入口丝滑', category: '特调咖啡' },
  { name: '燕麦拿铁', price: 2000, calories: 150, description: '植物基燕麦奶，轻盈无负担', category: '特调咖啡' },
  { name: '桂花拿铁', price: 2000, calories: 170, description: '秋日限定，桂香四溢', category: '特调咖啡' },
  { name: '茉莉绿茶', price: 1000, calories: 5,   description: '清新茉莉花香，茶汤清亮', category: '茶饮' },
  { name: '珍珠奶茶', price: 1600, calories: 300, description: 'Q弹珍珠搭配经典奶茶，快乐加倍', category: '茶饮' },
  { name: '满杯红柚', price: 1700, calories: 150, description: '当季红柚，酸甜多汁', category: '鲜果茶' },
  { name: '芒果四季春', price: 1800, calories: 160, description: '芒果果肉与四季春茶底的清爽组合', category: '鲜果茶' },
  { name: '柠檬绿茶', price: 1400, calories: 80,  description: '手打柠檬，茶香与果香交织', category: '鲜果茶' }
];

const DEMO_STORE = {
  storeName: '青柠咖啡',
  announcement: '新店开业，全场饮品第二杯半价！',
  openTime: '09:00 - 21:00',
  status: 'open',
  pickupNote: '到店请出示取餐码取餐'
};

/**
 * 导入演示数据（幂等）
 * @returns {Promise<object>} 导入结果统计
 */
const seedDemoData = async () => {
  const results = { categories: 0, drinks: 0, store: false, skipped: false };
  try {
    // 幂等检查：已有饮品数据则跳过
    const existRes = await db.query('drink_items', {}, { limit: 1 });
    if (existRes.success && existRes.data && existRes.data.length > 0) {
      results.skipped = true;
      return results;
    }

    for (const name of DEMO_CATEGORIES) {
      const res = await db.add('categories', { name: name, createTime: Date.now() });
      if (res.success) results.categories++;
    }

    for (const d of DEMO_DRINKS) {
      const res = await db.add('drink_items', {
        name: d.name,
        price: d.price,
        calories: d.calories,
        description: d.description,
        category: d.category,
        available: true,
        createTime: Date.now(),
        updateTime: Date.now()
      });
      if (res.success) results.drinks++;
    }

    // 店铺设置（已存在则跳过）
    const storeRes = await db.query('store_settings', {}, { limit: 1 });
    if (storeRes.success && storeRes.data && storeRes.data.length > 0) {
      results.store = true;
    } else {
      const res = await db.add('store_settings', {
        storeName: DEMO_STORE.storeName,
        announcement: DEMO_STORE.announcement,
        openTime: DEMO_STORE.openTime,
        status: DEMO_STORE.status,
        pickupNote: DEMO_STORE.pickupNote,
        createTime: Date.now()
      });
      results.store = res.success;
    }
  } catch (err) {
    console.error('[seed] 导入演示数据失败:', err);
    results.error = String((err && err.message) || err);
  }
  return results;
};

module.exports = { seedDemoData, DEMO_CATEGORIES, DEMO_DRINKS, DEMO_STORE };
