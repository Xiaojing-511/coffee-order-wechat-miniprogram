const { isAdmin } = require('./utils/admin.js');

// 管理员白名单
const ADMIN_OPENIDS = [
  "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
]
// app.js
App({
  globalData: {
    userInfo: null,
    openid: "",
    isAdmin: true
  },

  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-7gjfr85i3b664708',
        traceUser: true
      })
      console.log('云开发初始化成功')

      // 获取用户 openid 并检查管理员权限
      // this.fetchOpenidAndCheckAdmin()


      // wx.removeStorageSync('currentRecordNumber')


      // 检查日期变化，执行每日重置任务
      this.checkDailyReset()
    } else {
      console.log('请使用 2.2.3 或以上的基础库以使用云能力')
    }
  },

  // 获取 openid 并检查管理员权限（通过云函数）
  // async fetchOpenidAndCheckAdmin() {
  //   try {
  //     // 从本地存储获取 openid（如果之前已获取）
  //     let cachedOpenid = wx.getStorageSync('openid');
  //     let cachedIsAdmin = wx.getStorageSync('isAdmin');

  //     // 如果本地已有数据，直接使用
  //     if (cachedOpenid && cachedIsAdmin !== undefined) {
  //       console.log('从本地存储读取用户信息:', cachedOpenid, cachedIsAdmin);
  //       this.globalData.openid = cachedOpenid;
  //       this.globalData.isAdmin = cachedIsAdmin;
  //       return;
  //     }

  //     // 否则调用云函数获取
  //     console.log('调用 login 云函数获取 openid...');

  //     const res = await wx.cloud.callFunction({
  //       name: 'login',
  //       data: {}
  //     });

  //     console.log('云函数完整返回:', res.result);
  //     console.log('返回数据结构:', JSON.stringify(res.result, null, 2));

  //     const openid = res.result?.userOpenId ||
  //                    res.result?.userInfo?.openId ||
  //                    res.result?.data?.adminCheck?.checkedOpenid;

  //     if (openid) {
  //       console.log('✅ 成功获取 openid:', openid);
        
  //       // 从云函数返回或本地检查管理员状态
  //       let isAdmin =  res.result?.isAdminStatus || 
  //                     res.result?.isUserAdmin || 
  //                     res.result?.adminFlag ||
  //                     ADMIN_OPENIDS.includes(openid);
        
  //       console.log('✅ 管理员状态:', isAdmin);

  //       // 保存到全局数据
  //       this.globalData.openid = openid;
  //       this.globalData.isAdmin = isAdmin;

  //       // 存储到本地
  //       wx.setStorageSync('openid', openid);
  //       wx.setStorageSync('isAdmin', isAdmin);

  //       console.log('用户信息已保存到本地');
  //     } else {
  //       console.error('❌ 云函数返回数据异常:', res.result);
  //       console.error('❌ 无法从返回数据中提取 openid');
  //       this.globalData.isAdmin = false;
  //     }
  //   } catch (err) {
  //     console.error('获取 openid 或检查管理员权限失败:', err);
  //     this.globalData.isAdmin = false;
  //   }
  // },

  // 获取当前用户的 openid
  // getOpenid() {
  //   return this.globalData.openid || wx.getStorageSync('openid') || '';
  // },

  // 检查当前用户是否为管理员
  checkIsAdmin() {
    // const isAdmin = this.globalData.isAdmin !== undefined ?
    //   this.globalData.isAdmin :
    //   wx.getStorageSync('isAdmin');

    // return isAdmin === true;

    return true
  },

  // 检查日期变化，执行每日重置任务
  async checkDailyReset() {
    const today = this.getTodayString()
    const lastDate = 
     wx.getStorageSync('lastActiveDate')

    console.log('当前日期:', today)
    console.log('上次激活日期:', lastDate)

    // 如果日期发生了变化
    if (lastDate && lastDate !== today) {
      console.log('日期已变更，执行每日重置任务')

      try {
        wx.showLoading({
          title: '正在重置...',
          mask: true
        })

        // 1. 生成昨天的日报
        await this.generateDailyReport(lastDate)
        console.log('✅ 日报生成成功')

        // 2. 清空待选列表
        wx.removeStorageSync('tempWaitingList')
        console.log('✅ 待选列表已清空')

        wx.hideLoading()

        wx.showToast({
          title: '新的一天！',
          icon: 'success',
          duration: 2000
        })
      } catch (err) {
        console.error('每日重置任务执行失败:', err)
        wx.hideLoading()
        wx.showToast({
          title: '重置失败',
          icon: 'none',
          duration: 2000
        })
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
        console.log(`日期 ${dateString} 的日报已存在，跳过生成`)
        return existingReportRes.data[0]  // 返回已存在的日报
      }

      // 查询当天的所有记录
      const recordsRes = await db.collection('records')
        .where({
          dateString: dateString,
          status: 'completed',
          completed: true  // 只统计已完成的记录
        })
        .get()

      const records = recordsRes.data || []
      console.log('查询到记录数:', records.length)

      // 统计数据
      let totalCount = 0
      let totalQuantity = 0
      let totalCalories = 0
      const itemStats = {} // 饮品统计

      records.forEach(record => {
        totalCount++
        totalQuantity += record.totalQuantity || 0
        totalCalories += record.totalCalories || 0

        if (record.items && record.items.length > 0) {
          record.items.forEach(item => {
            const key = `${item.name}-${item.temperature}-${item.sugarLevel}`
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
        .slice(0, 10) // 取前10名

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
      console.log('总记录数:', totalCount)
      console.log('总饮品数:', totalQuantity)
      console.log('总热量:', totalCalories)
      console.log('热门饮品TOP10:', sortedItems.map(item => item.name))

      return report
    } catch (err) {
      console.error('生成日报失败:', err)
      throw err
    }
  },

  // 获取今日日期字符串
  getTodayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 格式化热量/数值
  formatCalories(calories) {
    if (calories === null || calories === undefined) {
      return '0';
    }
    return parseInt(calories).toString();
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 格式化完整时间
  formatFullTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
})
