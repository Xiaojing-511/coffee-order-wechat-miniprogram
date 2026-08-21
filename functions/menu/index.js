// 云函数：menu
// 商家操作：saveCategory / deleteCategory / saveDrink / deleteDrink
// 安全：校验 merchants 白名单 + 到期时间 + 文档店铺归属（防止跨店改数据）
const cloud = require('wx-server-sdk')

// 平台创始人白名单（merchants 集合缺失时兜底为商家）
const OWNER_OPENIDS = [
  "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
]

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const db = cloud.database()
  const action = event.action

  if (!openid) return { success: false, error: '无法获取用户身份' }

  // 商家白名单校验
  let merchant = null
  try {
    const merchantRes = await db.collection('merchants').where({ openid: openid }).limit(1).get()
    merchant = (merchantRes.data && merchantRes.data[0]) || null
  } catch (e) {
    console.error('查询商家白名单失败:', e)
  }
  if (!merchant) {
    // 创始人兜底（merchants 尚未录入时）
    if (OWNER_OPENIDS.indexOf(openid) > -1) {
      merchant = { storeId: 'S1001', status: 'active', expireTime: null }
    } else {
      return { success: false, error: '无权限', code: 'not_merchant' }
    }
  }
  const expired = (merchant.status === 'expired') || (merchant.expireTime && merchant.expireTime < Date.now())
  if (expired) return { success: false, error: '服务已到期，请联系平台续费', code: 'expired' }
  const storeId = merchant.storeId

  // 文档归属校验（防止跨店操作）
  const checkOwn = async (collection, id) => {
    try {
      const res = await db.collection(collection).doc(id).get()
      const doc = res.data
      if (!doc) return { ok: false, error: '记录不存在' }
      if (doc.storeId !== storeId) return { ok: false, error: '无权限' }
      return { ok: true, doc: doc }
    } catch (e) {
      return { ok: false, error: '记录不存在' }
    }
  }

  switch (action) {
    // 保存分类（新增/更新）
    case 'saveCategory': {
      const { id, name } = event
      const trimmed = (name || '').trim()
      if (!trimmed) return { success: false, error: '分类名称不能为空' }
      if (id) {
        const own = await checkOwn('categories', id)
        if (!own.ok) return { success: false, error: own.error }
        await db.collection('categories').doc(id).update({ data: { name: trimmed, updateTime: Date.now() } })
        return { success: true }
      }
      const res = await db.collection('categories').add({ data: { storeId: storeId, name: trimmed, createTime: Date.now() } })
      return { success: true, _id: res._id }
    }

    case 'deleteCategory': {
      const { id } = event
      const own = await checkOwn('categories', id)
      if (!own.ok) return { success: false, error: own.error }
      await db.collection('categories').doc(id).remove()
      return { success: true }
    }

    // 保存饮品（新增/更新）
    case 'saveDrink': {
      const { id, name, price, calories, description, category, available, imageUrl } = event
      const trimmed = (name || '').trim()
      if (!trimmed) return { success: false, error: '饮品名称不能为空' }
      const data = {
        name: trimmed,
        price: parseInt(price, 10) || 0,
        calories: parseFloat(calories) || 0,
        description: (description || '').trim(),
        category: category || '',
        available: available !== false,
        updateTime: Date.now()
      }
      if (imageUrl) data.imageUrl = imageUrl
      if (id) {
        const own = await checkOwn('drink_items', id)
        if (!own.ok) return { success: false, error: own.error }
        await db.collection('drink_items').doc(id).update({ data: data })
        return { success: true }
      }
      data.storeId = storeId
      data.createTime = Date.now()
      const res = await db.collection('drink_items').add({ data: data })
      return { success: true, _id: res._id }
    }

    case 'deleteDrink': {
      const { id } = event
      const own = await checkOwn('drink_items', id)
      if (!own.ok) return { success: false, error: own.error }
      await db.collection('drink_items').doc(id).remove()
      return { success: true }
    }

    default:
      return { success: false, error: 'unknown action: ' + action }
  }
}
