const db = require('../../utils/database.js');

Page({
  data: {
    records: [],
    categories: [],
    drinkItems: [],
    categoryItemsMap: {},
    showAddModalFlag: false,
    tempWaitingCount: 0,
    stats: {
      todayCount: 0,
      todayCalories: 0
    },
    nextRecordNumber: '001',
    currentTab: 'today',
    isAdmin: true  // 控制管理员按钮显示
  },

  onLoad: function() {
    // 获取用户信息（openid 和管理员状态）
    const app = getApp();
    console.log('=== 用户信息调试 ===');
    console.log('当前用户 openid:', app.globalData.openid);
    console.log('当前用户 openid 类型:', typeof app.globalData.openid);
    console.log('当前用户 openid 长度:', app.globalData.openid ? app.globalData.openid.length : 'null');
    console.log('当前用户管理员状态:', app.globalData.isAdmin);
    console.log('本地存储 openid:', wx.getStorageSync('openid'));
    console.log('本地存储 isAdmin:', wx.getStorageSync('isAdmin'));
    console.log('==================');

    // 根据管理员状态控制按钮显示
    const isAdminStatus = app.checkIsAdmin();
    this.setData({ isAdmin: isAdminStatus });

    // 加载数据
    this.loadRecords();
    this.loadCategories();
    this.loadDrinkItems();
    this.updateTempWaitingCount();
    this.updateNextRecordNumber();
  },

  /**
   * 页面显示时触发的生命周期函数
   * 负责加载记录数据、更新临时等待计数和下一个记录编号
   */
  onShow: function() {
    this.loadRecords();
    this.loadCategories();  // 刷新分类数据
    this.loadDrinkItems();  // 刷新饮品数据
    this.updateTempWaitingCount();
    this.updateNextRecordNumber();
  },

  // 加载今日记录
  loadRecords: async function() {
    const today = this.getTodayString();

    try {
      const res = await db.query('records', {
        dateString: today,
      });

      if (res.success) {
        // 为每条记录添加 completed 字段
        const records = res.data.map(record => ({
          ...record,
          completed: record.completed || false
        }));

        // 分离未完成和已完成的记录
        const incompleteRecords = records.filter(record => !record.completed);
        const completedRecords = records.filter(record => record.completed);

        // 未完成记录按创建时间升序排列（最早的在前面）
        incompleteRecords.sort((a, b) => a.createTime - b.createTime);

        // 已完成记录按创建时间降序排列（最新的在前面）
        completedRecords.sort((a, b) => b.createTime - a.createTime);

        // 合并记录：未完成在前，已完成在后
        const sortedRecords = [...incompleteRecords, ...completedRecords];

        this.setData({ records: sortedRecords });
        this.calculateStats(sortedRecords);
      }
    } catch (err) {
      console.error('加载记录失败:', err);
    }
  },

  // 加载分类
  loadCategories: async function() {
    try {
      // 使用分页获取所有分类数据
      let allCategories = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('categories', {}, {
          orderBy: { field: 'createTime', order: 'asc' },
          limit: limit,
          skip: skip
        });

        if (res.success && res.data && res.data.length > 0) {
          allCategories = allCategories.concat(res.data);

          if (res.data.length < limit) {
            hasMore = false;
          } else {
            skip += limit;
            // 防止无限循环
            if (skip > 500) {
              console.warn('已达到最大查询次数限制');
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }
      }

      const categoryNames = allCategories.map(item => item.name);
      this.setData({ categories: categoryNames });
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  },

  // 加载饮品
  loadDrinkItems: async function() {
    try {
      // 使用分页获取所有饮品数据
      let allItems = [];
      let skip = 0;
      const limit = 20;  // 云数据库默认限制，多次查询获取所有数据
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('drink_items', {}, {
          orderBy: { field: 'createTime', order: 'asc' },  // 按创建时间升序排序（最早的排第一）
          limit: limit,
          skip: skip
        });

        console.log(`第 ${Math.floor(skip/limit) + 1} 次查询，返回 ${res.data ? res.data.length : 0} 条数据`);

        if (res.success && res.data && res.data.length > 0) {
          allItems = allItems.concat(res.data);
          console.log(`累计已加载 ${allItems.length} 条饮品数据`);

          // 如果返回的数据少于limit，说明已经获取完所有数据
          if (res.data.length < limit) {
            hasMore = false;
            console.log('数据加载完成');
          } else {
            skip += limit;
            // 防止无限循环，设置最大查询次数
            if (skip > 1000) {
              console.warn('已达到最大查询次数限制');
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
          console.log('没有更多数据或查询失败');
        }
      }

      console.log(`总共加载了 ${allItems.length} 条饮品数据`);
      this.setData({ drinkItems: allItems });
      this.buildCategoryItemsMap(allItems);
    } catch (err) {
      console.error('加载饮品失败:', err);
    }
  },

  // 构建分类饮品映射
  buildCategoryItemsMap: function(drinkItems) {
    const categoryItemsMap = {};

    // 先为所有分类初始化空数组
    this.data.categories.forEach(categoryName => {
      categoryItemsMap[categoryName] = [];
    });

    // 确保未分类也有空数组
    categoryItemsMap['未分类'] = [];

    // 将饮品按分类分配
    drinkItems.forEach(item => {
      const category = item.category || '未分类';
      if (!categoryItemsMap[category]) {
        categoryItemsMap[category] = [];
      }
      categoryItemsMap[category].push(item);
    });

    console.log('分类饮品映射:', categoryItemsMap);
    this.setData({ categoryItemsMap });
  },

  // 计算统计数据
  calculateStats: function(records) {
    // 只统计已完成的记录
    const completedRecords = records.filter(record => record.completed);

    let todayCount = completedRecords.length;
    let todayCalories = 0;

    completedRecords.forEach(record => {
      todayCalories += record.totalCalories || 0;
    });

    this.setData({
      'stats.todayCount': todayCount,
      'stats.todayCalories': todayCalories
    });
  },

  // 更新临时列表计数
  updateTempWaitingCount: function() {
    const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
    let count = 0;
    tempWaitingList.forEach(item => {
      count += item.quantity || 1;
    });
    this.setData({ tempWaitingCount: count });
  },

  // 更新下一条记录编号
  updateNextRecordNumber: async function() {
    try {
      // 查询当天最大的记录编号（严格过滤日期）
      const today = this.getTodayString();
      const res = await db.query('records', { dateString: today });

      if (res.success && res.data && res.data.length > 0) {
        // 将 recordNumber 转换为数字处理
        const numbers = res.data
          .map(r => {
            const num = parseInt(r.recordNumber, 10);
            return isNaN(num) ? 0 : num;
          })
          .filter(num => num > 0);
        
        if (numbers.length > 0) {
          const maxRecordNumber = Math.max(...numbers);
          const nextNumber = maxRecordNumber + 1;
          const recordNumberStr = String(nextNumber).padStart(3, '0');
          this.setData({ nextRecordNumber: recordNumberStr });
          console.log('从数据库查询当天最大记录号:', maxRecordNumber, '，下一条:', nextNumber, '-', recordNumberStr);
        } else {
          this.setData({ nextRecordNumber: '001' });
          console.log('当天暂无有效记录，序号从1开始');
        }
      } else {
        // 当天没有记录，从1开始
        this.setData({ nextRecordNumber: '001' });
        console.log('当天暂无记录，序号从1开始');
      }
    } catch (err) {
      console.error('查询记录编号失败:', err);
      // 查询失败时，使用本地存储的值作为备选方案
      let recordNumber = wx.getStorageSync('currentRecordNumber');
      if (!recordNumber) {
        recordNumber = 0;
      }
      const nextNumber = recordNumber + 1;
      const recordNumberStr = String(nextNumber).padStart(3, '0');
      this.setData({ nextRecordNumber: recordNumberStr });
      console.log('查询失败，使用本地存储的记录号:', nextNumber, '-', recordNumberStr);
    }
  },

  // 显示添加弹窗（仅管理员可用）
  showAddModal: function() {
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '只有管理员可以管理饮品和分类',
        icon: 'none'
      });
      return;
    }
    this.setData({ showAddModalFlag: true });
  },

  // 关闭添加弹窗
  closeAddModal: function() {
    this.setData({ showAddModalFlag: false });
  },

  // 跳转到饮品详情
  goToItemDetail: function(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: `/pages/item-detail/item-detail?id=${item._id}&source=record`
    });
  },

  // 查看临时列表
  viewTempWaitingList: function() {
    // this.closeAddModal();
    wx.navigateTo({
      url: '/pages/detail/detail?recordId=temp&isTemp=1'
    });
  },

  // 确认添加
  confirmAdd: function() {
    const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
    if (tempWaitingList.length === 0) {
      wx.showToast({ title: '请先选择饮品', icon: 'none' });
      return;
    }

    this.closeAddModal();
    this.submitRecord();
  },

  // 立即完成（保存当前临时列表中的饮品）
  recordNow: async function() {
    const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
    if (tempWaitingList.length === 0) {
      wx.showToast({ title: '请先选择饮品', icon: 'none' });
      return;
    }

    // 关闭弹窗
    this.closeAddModal();

    const app = getApp();
    console.log('openID',  app.globalData.openid)

    wx.showLoading({ title: '保存中...' });

    try {
      // 获取临时列表
      let tempWaitingList = wx.getStorageSync('tempWaitingList') || [];

      const itemsToRecord = [...tempWaitingList];

      // 计算总数量和总热量
      let totalQuantity = 0;
      let totalCalories = 0;
      itemsToRecord.forEach(item => {
        totalQuantity += item.quantity;
        totalCalories += (item.calories || 0) * item.quantity;
      });

      // 查询当天最大的记录编号（严格过滤日期）
      const today = app.getTodayString();
      const recordsRes = await db.query('records', { dateString: today });

      let recordNumber = 1; // 默认从1开始
      if (recordsRes.success && recordsRes.data && recordsRes.data.length > 0) {
        // 将 recordNumber 转换为数字处理
        const numbers = recordsRes.data
          .map(r => {
            const num = parseInt(r.recordNumber, 10);
            return isNaN(num) ? 0 : num;
          })
          .filter(num => num > 0);
        
        if (numbers.length > 0) {
          recordNumber = Math.max(...numbers) + 1;
        }
      }

      const record = {
        recordNumber: recordNumber,
        items: itemsToRecord,
        totalQuantity: totalQuantity,
        totalCalories: totalCalories,
        createTime: new Date().getTime(),
        dateString: app.getTodayString()
      };

      const res = await db.add('records', record);

      if (res.success) {
        // 清空临时列表
        wx.setStorageSync('tempWaitingList', []);
        wx.setStorageSync('currentRecordNumber', recordNumber);

        wx.hideLoading();
        wx.showToast({
          title: `#${recordNumber} 已保存`,
          icon: 'success',
          duration: 500
        });

        console.log('立即完成，准备返回记录页面');
        // 返回到记录页面（需要关闭弹窗）
        const pages = getCurrentPages();
        console.log('当前页面栈长度:', pages.length);
        if (pages.length >= 2) {
          const prevPage = pages[pages.length - 2];
          // 关闭弹窗
          if (prevPage.route === 'pages/record/record') {
            prevPage.setData({
              showAddModalFlag: false
            });
          }
          // 返回记录页面，弹窗会自动关闭
          setTimeout(() => {
            wx.navigateBack({
              delta: 1  // 返回1页：回到 record 页面
            });
          }, 500);
        } else {
          // 直接切换到记录 tab
          setTimeout(() => {
            wx.switchTab({ url: '/pages/record/record' });
          }, 500);
        }
      } else {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存记录失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 提交记录
  submitRecord: async function() {
    const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
    if (tempWaitingList.length === 0) {
      wx.showToast({ title: '请先选择饮品', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      // 查询当天最大的记录编号（严格过滤日期）
      const today = this.getTodayString();
      const recordsRes = await db.query('records', { dateString: today });

      let recordNumber = 1; // 默认从1开始
      if (recordsRes.success && recordsRes.data && recordsRes.data.length > 0) {
        // 将 recordNumber 转换为数字处理
        const numbers = recordsRes.data
          .map(r => {
            const num = parseInt(r.recordNumber, 10);
            return isNaN(num) ? 0 : num;
          })
          .filter(num => num > 0);
        
        if (numbers.length > 0) {
          recordNumber = Math.max(...numbers) + 1;
        }
      }

      // 计算总数
      let totalQuantity = 0;
      let totalCalories = 0;
      tempWaitingList.forEach(item => {
        totalQuantity += item.quantity || 1;
        totalCalories += (item.calories || 0) * (item.quantity || 1);
      });

      // 保存记录
      const recordData = {
        recordNumber,
        items: tempWaitingList,
        totalQuantity,
        totalCalories,
        dateString: this.getTodayString(),
        createTime: new Date().getTime()
      };

      const res = await db.add('records', recordData);

      wx.hideLoading();

      if (res.success) {
        // 清空临时列表并更新记录号
        wx.removeStorageSync('tempWaitingList');
        wx.setStorageSync('currentRecordNumber', recordNumber);

        this.setData({
          tempWaitingCount: 0
        });

        this.updateNextRecordNumber();
        this.loadRecords();
        wx.showToast({
          title: `#${recordNumber} 已保存`,
          icon: 'success',
          duration: 500
        });

      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存记录失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 查看记录详情
  viewDetail: function(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: `/pages/detail/detail?recordId=${item._id}&isTemp=0`
    });
  },

  // 切换记录完成状态
  toggleCompletion: async function(e) {
    const recordId = e.currentTarget.dataset.recordId;
    const currentCompleted = e.currentTarget.dataset.completed;

    // 如果已经是已完成状态，不允许再次点击
    if (currentCompleted) {
    
      return;
    }

    wx.showLoading({ title: '更新中...' });

    const updateRes = await db.update('records', recordId, {
      completed: true
    });

    wx.hideLoading();

    if (updateRes.success) {
      wx.showToast({
        title: '已完成',
        icon: 'success'
      });

      // 重新加载记录列表
      this.loadRecords();
    } else {
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      });
    }

    // wx.showModal({
    //   title: '确认完成',
    //   content: '确定要标记为已完成吗？标记后该记录将不可再修改。',
    //   confirmColor: '#8B4513',
    //   success: async (res) => {
    //     if (res.confirm) {
    //       try {
    //         wx.showLoading({ title: '更新中...' });

    //         const updateRes = await db.update('records', recordId, {
    //           completed: true
    //         });

    //         wx.hideLoading();

    //         if (updateRes.success) {
    //           wx.showToast({
    //             title: '已标记为已完成',
    //             icon: 'success'
    //           });

    //           // 重新加载记录列表
    //           this.loadRecords();
    //         } else {
    //           wx.showToast({
    //             title: '更新失败',
    //             icon: 'none'
    //           });
    //         }
    //       } catch (err) {
    //         wx.hideLoading();
    //         console.error('更新记录状态失败:', err);
    //         wx.showToast({
    //           title: '更新失败',
    //           icon: 'none'
    //         });
    //       }
    //     }
    //   }
    // });
  },

  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 获取今日日期字符串
  getTodayString: function() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 跳转隐私政策
  goToPrivacy: function() {
    wx.navigateTo({
      url: '/pages/privacy/privacy'
    });
  }
});
