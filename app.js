const { parseStoreId, setStoreId } = require('./utils/storeContext.js');

// 平台创始人白名单（始终拥有商家权限）
const ADMIN_OPENIDS = [
  "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
]

// app.js
App({
  globalData: {
    userInfo: null,
    openid: "",
    isMerchant: true,   // 是否为商家（白名单内）
    merchant: null,     // 商家信息 { storeId, storeName, plan, status, expireTime }
    isAdmin: true
  },

  onLaunch(options) {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-7gjfr85i3b664708',
        traceUser: true
      })
      console.log('云开发初始化成功')
    } else {
      console.log('请使用 2.2.3 或以上的基础库以使用云能力')
    }

    // 解析启动参数中的店铺（小程序码/分享链接）
    if (options && options.query) {
      const sid = parseStoreId(options.query)
      if (sid) setStoreId(sid)
    }

    // 获取登录态（openid + 商家信息）
    this.initLogin()
  },

  // 初始化登录态
  async initLogin() {
    try {
      if (wx.cloud && wx.cloud.callFunction) {
        const res = await wx.cloud.callFunction({ name: 'login', data: {} })
        const result = res.result || {}
        const openid = result.userOpenId || ''
        const merchant = result.merchant || null

        if (openid) {
          this.globalData.openid = openid
          wx.setStorageSync('openid', openid)
        }

        if (merchant) {
          // 白名单商家
          this.globalData.merchant = merchant
          this.globalData.isMerchant = true
          wx.setStorageSync('merchantInfo', merchant)
          wx.setStorageSync('isMerchant', true)
          if (merchant.storeId) wx.setStorageSync('storeId', merchant.storeId)
          console.log('✅ 商家登录成功:', merchant.storeId, merchant.storeName)
        } else {
          // 普通顾客：创始人白名单兜底
          const isAdmin = ADMIN_OPENIDS.indexOf(openid) > -1
          this.globalData.isMerchant = isAdmin
          this.globalData.isAdmin = isAdmin
          console.log('顾客身份，openid:', openid)
        }
        return
      }
    } catch (err) {
      console.warn('[login] 云函数调用失败:', err)
    }

    // 降级：本地缓存或开发默认商家（便于预览）
    const cachedMerchant = wx.getStorageSync('merchantInfo')
    if (cachedMerchant) {
      this.globalData.merchant = cachedMerchant
      this.globalData.isMerchant = true
      return
    }
    const storeId = wx.getStorageSync('storeId') || 'S1001'
    this.globalData.isMerchant = true
    this.globalData.merchant = {
      storeId: storeId,
      storeName: '青柠咖啡',
      plan: 'dev',
      status: 'active',
      expireTime: null
    }
    wx.setStorageSync('storeId', storeId)
    console.log('[dev] 本地降级为商家模式，storeId =', storeId)
  },

  // 检查当前用户是否为管理员
  checkIsAdmin() {
    return this.globalData.isAdmin === true || this.globalData.isMerchant === true
  },

  // 获取今日日期字符串
  getTodayString() {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return year + '-' + month + '-' + day
  },

  // 格式化热量/数值
  formatCalories(calories) {
    if (calories === null || calories === undefined) return '0'
    return parseInt(calories).toString()
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return hours + ':' + minutes
  },

  // 格式化完整时间
  formatFullTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes
  }
})
