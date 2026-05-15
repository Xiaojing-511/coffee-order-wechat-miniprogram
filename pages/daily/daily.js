const db = require('../../utils/database.js');

Page({
  data: {
    todayDate: '',
    records: [],
    dailyReports: [],
    todayStats: {
      recordCount: 0,
      totalCalories: 0,
      drinkCount: 0
    },
    showDetailModal: false,
    selectedReport: null
  },

  onLoad: function() {
    this.loadTodayDate();
    this.loadTodayData();
    this.loadDailyReports();
  },

  onShow: function() {
    this.loadTodayData();
    this.loadDailyReports();
  },

  // 加载今日日期
  loadTodayDate: function() {
    const app = getApp();
    const today = app.getTodayString();
    this.setData({ todayDate: today });
  },

  // 加载今日数据
  loadTodayData: async function() {
    const app = getApp();
    const today = app.getTodayString();

    try {
      // 获取今日记录
      const res = await db.query('records', { dateString: today }, {
        orderBy: { field: 'createTime', order: 'desc' }
      });

      if (res.success) {
        const records = res.data;
        // 只统计已完成的记录
        const completedRecords = records.filter(record => record.completed === true);
        this.calculateTodayStats(completedRecords);
        this.setData({ records });
      }
    } catch (err) {
      console.error('加载今日数据失败:', err);
    }
  },

  // 计算今日统计数据
  calculateTodayStats: function(records) {
    let recordCount = 0;
    let totalCalories = 0;
    let drinkCount = 0;

    records.forEach(record => {
      recordCount++;
      totalCalories += record.totalCalories || 0;
      drinkCount += record.totalQuantity || 0;
    });

    this.setData({
      todayStats: {
        recordCount,
        totalCalories,
        drinkCount
      }
    });
  },

  // 加载历史日报
  loadDailyReports: async function() {
    try {
      // 使用分页获取所有日报数据
      let allReports = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('daily_reports', {}, {
          orderBy: { field: 'createTime', order: 'desc' },
          limit: limit,
          skip: skip
        });

        console.log(`第 ${Math.floor(skip/limit) + 1} 次查询日报，返回 ${res.data ? res.data.length : 0} 条数据`);

        if (res.success && res.data && res.data.length > 0) {
          allReports = allReports.concat(res.data);

          if (res.data.length < limit) {
            hasMore = false;
            console.log('日报数据加载完成');
          } else {
            skip += limit;
            // 防止无限循环
            if (skip > 1000) {
              console.warn('已达到最大查询次数限制');
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
          console.log('没有更多日报数据或查询失败');
        }
      }

      console.log(`总共加载了 ${allReports.length} 条日报数据`);
      this.setData({ dailyReports: allReports.filter(report => report.totalCount > 0) });
    } catch (err) {
      console.error('加载历史日报失败:', err);
    }
  },

  // 查看日报详情
  viewDetail: function(e) {
    const report = e.currentTarget.dataset.report;

    // 计算前10名饮品
    const topDrinks = this.calculateTopDrinks(report.records);

    this.setData({
      selectedReport: {
        ...report,
        topDrinks: topDrinks
      },
      showDetailModal: true
    });
  },

  // 计算前10名饮品
  calculateTopDrinks: function(records) {
    const drinkStats = {};

    // 统计每个饮品的数量和热量
    records.forEach(record => {
      if (record.items && record.items.length > 0) {
        record.items.forEach(item => {
          const drinkName = item.name || '未知饮品';
          if (!drinkStats[drinkName]) {
            drinkStats[drinkName] = {
              name: drinkName,
              count: 0,
              calories: 0
            };
          }
          drinkStats[drinkName].count += item.quantity || 1;
          drinkStats[drinkName].calories += (item.calories || 0) * (item.quantity || 1);
        });
      }
    });

    // 转换为数组并按数量排序
    const sortedDrinks = Object.values(drinkStats).sort((a, b) => b.count - a.count);

    // 取前10名
    const top10 = sortedDrinks.slice(0, 10);

    // 计算总杯数
    const totalCount = top10.reduce((sum, item) => sum + item.count, 0);

    // 计算百分比
    top10.forEach(item => {
      item.percentage = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
    });

    return top10;
  },

  // 关闭详情弹窗
  closeDetailModal: function() {
    this.setData({
      showDetailModal: false,
      selectedReport: null
    });
  },

  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 跳转隐私政策
  goToPrivacy: function() {
    wx.navigateTo({
      url: '/pages/privacy/privacy'
    });
  }
});
