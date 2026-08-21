// 云函数：migrate（一次性迁移：单店数据 → 多租户 storeId 模型）
// 部署后在开发者工具云函数面板手动运行一次即可
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 创始人 openid 与默认店铺（平台第一家用店）
const OWNER_OPENIDS = [
  "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
]
const DEFAULT_STORE_ID = 'S1001'

const DEMO_CATEGORIES = ['经典咖啡', '特调咖啡', '茶饮', '鲜果茶']

const DEMO_DRINKS = [
  { name: '美式咖啡', price: 1200, calories: 10, description: '精选阿拉比卡豆，浓郁醇厚', category: '经典咖啡' },
  { name: '拿铁', price: 1500, calories: 120, description: '醇香浓缩与丝滑牛奶的经典融合', category: '经典咖啡' },
  { name: '生椰拿铁', price: 1900, calories: 180, description: '清甜生椰乳搭配浓缩咖啡', category: '特调咖啡' },
  { name: '珍珠奶茶', price: 1600, calories: 300, description: 'Q弹珍珠搭配经典奶茶', category: '茶饮' }
]

exports.main = async () => {
  const db = cloud.database()
  const results = { merchants: 0, stores: 0, categories: 0, drinks: 0, seeded: false }

  // 1. 为创始人创建 merchants 白名单记录
  for (const openid of OWNER_OPENIDS) {
    const exist = await db.collection('merchants').where({ openid: openid }).count()
    if (exist.total === 0) {
      await db.collection('merchants').add({ data: {
        openid: openid,
        storeId: DEFAULT_STORE_ID,
        storeName: '青柠咖啡',
        plan: 'owner',
        status: 'active',
        expireTime: null,
        createTime: Date.now()
      } })
      results.merchants++
    }
  }

  // 2. store_settings → stores（带 storeId）
  try {
    const oldStores = await db.collection('store_settings').limit(100).get()
    for (const s of oldStores.data || []) {
      const exist = await db.collection('stores').where({ storeId: DEFAULT_STORE_ID }).count()
      if (exist.total === 0) {
        await db.collection('stores').add({ data: {
          storeId: DEFAULT_STORE_ID,
          storeName: s.storeName || '青柠咖啡',
          announcement: s.announcement || '',
          openTime: s.openTime || '',
          status: s.status || 'open',
          pickupNote: s.pickupNote || '',
          createTime: Date.now()
        } })
        results.stores++
      }
    }
  } catch (e) {
    console.log('store_settings 迁移跳过:', e.message)
  }

  // 3. 现有 categories / drink_items 补 storeId
  try {
    const cats = await db.collection('categories').limit(1000).get()
    for (const c of cats.data || []) {
      if (!c.storeId) {
        await db.collection('categories').doc(c._id).update({ data: { storeId: DEFAULT_STORE_ID } })
        results.categories++
      }
    }
  } catch (e) { console.log('categories 迁移跳过:', e.message) }

  try {
    const drinks = await db.collection('drink_items').limit(1000).get()
    for (const d of drinks.data || []) {
      if (!d.storeId) {
        await db.collection('drink_items').doc(d._id).update({ data: { storeId: DEFAULT_STORE_ID } })
        results.drinks++
      }
    }
  } catch (e) { console.log('drink_items 迁移跳过:', e.message) }

  // 4. 空库时写入演示数据
  const catCount = await db.collection('categories').count()
  if (catCount.total === 0) {
    for (const name of DEMO_CATEGORIES) {
      await db.collection('categories').add({ data: { storeId: DEFAULT_STORE_ID, name: name, createTime: Date.now() } })
    }
    for (const d of DEMO_DRINKS) {
      await db.collection('drink_items').add({ data: {
        storeId: DEFAULT_STORE_ID,
        name: d.name,
        price: d.price,
        calories: d.calories,
        description: d.description,
        category: d.category,
        available: true,
        createTime: Date.now(),
        updateTime: Date.now()
      } })
    }
    results.seeded = true
  }

  console.log('=== migrate 完成 ===', JSON.stringify(results))
  return results
}
