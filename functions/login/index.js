// 云函数：login
// 返回：openid + 商家白名单信息（merchant），供客户端判断角色
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 平台创始人白名单（始终商家；正常情况下 migrate 云函数会为其创建 merchants 记录）
const OWNER_OPENIDS = [
  "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const appid = wxContext.APPID

  console.log('=== login 云函数调用 ===')
  console.log('openid:', openid, 'appid:', appid)

  const db = cloud.database()
  let merchant = null

  // 查询商家白名单
  try {
    const res = await db.collection('merchants').where({ openid: openid }).limit(1).get()
    if (res.data && res.data.length > 0) {
      const m = res.data[0]
      merchant = {
        storeId: m.storeId,
        storeName: m.storeName || '',
        plan: m.plan || '',
        status: m.status || 'active',
        expireTime: m.expireTime || null
      }
      console.log('✅ 白名单商家:', merchant)
    }
  } catch (err) {
    console.error('查询商家白名单失败:', err)
  }

  // 创始人兜底（merchants 尚未录入时）
  if (!merchant && OWNER_OPENIDS.indexOf(openid) > -1) {
    merchant = {
      storeId: 'S1001',
      storeName: '青柠咖啡',
      plan: 'owner',
      status: 'active',
      expireTime: null
    }
  }

  return {
    userOpenId: openid,
    merchant: merchant,
    isMerchant: !!merchant
  }
}
