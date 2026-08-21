// 云函数：storeQr
// 生成店铺专属小程序码（wxacode.getUnlimited）并上传云存储
// 扫码直达：menu-pages/menu-list?scene=storeId=xxx
// 注意：需在微信公众平台/云开发控制台开通「生成小程序码」云调用权限，且小程序已有体验版/正式版
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
  const scene = 'storeId=' + storeId
  const cloudPath = 'store-qr/' + storeId + '.png'

  try {
    // 1. 生成小程序码
    const qrRes = await cloud.openapi.wxacode.getUnlimited({
      scene: scene,
      page: 'menu-pages/menu-list',
      checkPath: false,
      width: 430
    })
    const buffer = qrRes.buffer
    if (!buffer || buffer.length === 0) {
      return { success: false, error: '小程序码生成结果为空', code: 'qr_failed' }
    }

    // 2. 上传云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: buffer
    })

    // 3. 记录 fileID 到店铺信息
    await db.collection('stores').where({ storeId: storeId }).update({
      data: { qrFileId: uploadRes.fileID, qrUpdateTime: Date.now() }
    })

    return { success: true, fileID: uploadRes.fileID, scene: scene }
  } catch (err) {
    console.error('生成小程序码失败:', err)
    return {
      success: false,
      error: '生成失败：请确认已开通「生成小程序码」云调用权限，且小程序已有体验版/正式版',
      code: 'qr_failed'
    }
  }
}
