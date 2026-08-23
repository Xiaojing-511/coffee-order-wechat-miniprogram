// 云函数：storeQr
// 生成店铺专属小程序码（wxacode.getUnlimited）并上传云存储
// 扫码直达店铺欢迎页：menu-pages/store-home?scene=storeId=xxx（欢迎页内点「开始点单」进入菜单）
// 支持 event.demo = true：生成「官网落地页扫码体验」的演示店铺码（仅创始人可调用）
//   场景参数：scene=storeId=S1001&src=landing（src 用于小程序端识别体验来源）
// 注意：需在微信公众平台/云开发控制台开通「生成小程序码」云调用权限，且小程序已有体验版/正式版
const cloud = require('wx-server-sdk')

// 平台创始人白名单（merchants 集合缺失时兜底为商家）
const OWNER_OPENIDS = [
  "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
]

// 官网体验店铺（落地页扫码直达的演示店，migrate 会为它写入演示数据）
const DEMO_STORE_ID = 'S1001'
const DEMO_SCENE = 'storeId=' + DEMO_STORE_ID + '&src=landing'

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 生成小程序码并上传云存储，返回 fileID
async function generateAndUpload(scene, cloudPath) {
  const qrRes = await cloud.openapi.wxacode.getUnlimited({
    scene: scene,
    page: 'menu-pages/store-home',
    checkPath: false,
    width: 430
  })
  const buffer = qrRes.buffer
  if (!buffer || buffer.length === 0) {
    throw new Error('小程序码生成结果为空')
  }
  const uploadRes = await cloud.uploadFile({
    cloudPath: cloudPath,
    fileContent: buffer
  })
  return uploadRes.fileID
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  // 云端测试没有用户上下文时，允许 __test + openid 模拟身份（仅测试用；小程序调用永远有真实 openid）
  const openid = wxContext.OPENID || (event.__test === true ? (event.openid || '') : '')
  const db = cloud.database()

  if (!openid) return { success: false, error: '无法获取用户身份' }

  // 官网体验码：仅创始人可生成（面向落地页访客的演示店铺，不校验商家白名单/到期）
  if (event.demo === true) {
    if (OWNER_OPENIDS.indexOf(openid) === -1) {
      return { success: false, error: '无权限', code: 'not_owner' }
    }
    try {
      const cloudPath = 'store-qr/landing-demo.png'
      const fileID = await generateAndUpload(DEMO_SCENE, cloudPath)
      // 返回临时下载链接，方便直接从浏览器保存图片
      let tempFileURL = ''
      try {
        const tmpRes = await cloud.getTempFileURL({ fileList: [fileID] })
        if (tmpRes.fileList && tmpRes.fileList[0]) tempFileURL = tmpRes.fileList[0].tempFileURL || ''
      } catch (e) { /* 忽略 */ }
      return { success: true, fileID: fileID, scene: DEMO_SCENE, tempFileURL: tempFileURL }
    } catch (err) {
      console.error('生成体验码失败:', err)
      return {
        success: false,
        error: '生成失败：请确认已开通「生成小程序码」云调用权限，且小程序已有体验版/正式版',
        code: 'qr_failed'
      }
    }
  }

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

  // 集合不存在时自动创建（空库环境）
  const ensureCollection = async (name) => {
    try {
      await db.createCollection(name)
    } catch (e) {
      // 已存在或并发创建，忽略
    }
  }

  try {
    // 1. 生成小程序码
    const fileID = await generateAndUpload(scene, cloudPath)

    // 2. 记录 fileID 到店铺信息（失败不阻塞，码已生成）
    try {
      await ensureCollection('stores')
      await db.collection('stores').where({ storeId: storeId }).update({
        data: { qrFileId: fileID, qrUpdateTime: Date.now() }
      })
    } catch (e) {
      console.warn('记录 fileID 失败（不影响使用）:', e)
    }

    return { success: true, fileID: fileID, scene: scene }
  } catch (err) {
    console.error('生成小程序码失败:', err)
    return {
      success: false,
      error: '生成失败：请确认已开通「生成小程序码」云调用权限，且小程序已有体验版/正式版',
      code: 'qr_failed'
    }
  }
}
