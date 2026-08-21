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

    // 检查日期变化，执行每日重置任务
    this.checkDailyReset()
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

  // 检查日期变化，执行每日重置任务
  async checkDailyReset() {
    const today = this.getTodayString()
    const lastDate = wx.getStorageSync('lastActiveDate')

    console.log('当前日期:', today)
    console.log('上次激活日期:', lastDate)

    // 如果日期发生了变化
    if (lastDate && lastDate !== today) {
      console.log('日期已变更，执行每日重置任务')

      try {
        wx.showLoading({ title: '正在重置...', mask: true })

        // 1. 生成昨天的日报
        await this.generateDailyReport(lastDate)
        console.log('✅ 日报生成成功')

        // 2. 清空待选列表
        wx.removeStorageSync('tempWaitingList')
        console.log('✅ 待选列表已清空')

        wx.hideLoading()

        wx.showToast({ title: '新的一天！', icon: 'success', duration: 2000 })
      } catch (err) {
        console.error('每日重置任务执行失败:', err)
        wx.hideLoading()
        wx.showToast({ title: '重置失败', icon: 'none', duration: 2000 })
      }
    }

    // 更新最后激活日期
    wx.setStorageSync('lastActiveDate', today)
    console.log('最后激活日期已更新:', today)
  },

  // 生成日报
  async generateDailyReport(dateString) {
    const db = wx.cloud.database()

    try {
      console.log('开始生成日报，日期:', dateString)

      // 先检查该日期的日报是否已存在
      const existingReportRes = await db.collection('daily_reports')
        .where({ dateString: dateString })
        .get()

      if (existingReportRes.data && existingReportRes.data.length > 0) {
        console.log('日期 ' + dateString + ' 的日报已存在，跳过生成')
        return existingReportRes.data[0]
      }

      // 查询当天的所有记录
      const recordsRes = await db.collection('records')
        .where({
          dateString: dateString,
          status: 'completed',
          completed: true
        })
        .get()

      const records = recordsRes.data || []
      console.log('查询到记录数:', records.length)

      // 统计数据
      let totalCount = 0
      let totalQuantity = 0
      let totalCalories = 0
      const itemStats = {}

      records.forEach(record => {
        totalCount++
        totalQuantity += record.totalQuantity || 0
        totalCalories += record.totalCalories || 0

        if (record.items && record.items.length > 0) {
          record.items.forEach(item => {
            const key = item.name + '-' + (item.temperature || '') + '-' + (item.sugarLevel || '')
            if (!itemStats[key]) {
              itemStats[key] = {
                name: item.name,
                temperature: item.temperature,
                sugarLevel: item.sugarLevel,
                quantity: 0,
                count: 0
              }
            }
            itemStats[key].quantity += item.quantity || 1
            itemStats[key].count++
          })
        }
      })

      // 按数量排序饮品
      const sortedItems = Object.values(itemStats)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)

      // 生成日报数据
      const report = {
        dateString: dateString,
        date: new Date(dateString).getTime(),
        totalCount,
        totalQuantity,
        totalCalories,
        topItems: sortedItems,
        records: records,
        createTime: new Date().getTime()
      }

      // 保存日报
      await db.collection('daily_reports').add({
        data: report
      })

      console.log('日报保存成功，日期:', dateString)
      return report
    } catch (err) {
      console.error('生成日报失败:', err)
      throw err
    }
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
