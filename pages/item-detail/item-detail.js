const db = require('../../utils/database.js');

Page({
  data: {
    item: null,
    quantity: 1,
    temperature: '冷',
    iceLevel: '正常冰',
    sugarLevel: '正常糖',
    remark: '',
    mode: 'add', // 'add' 或 'edit'
    editRecordInfo: null
  },

  // 测试方法
  testClick: function() {
    console.log('测试按钮被点击了');
    wx.showModal({
      title: '测试',
      content: '测试按钮被点击了',
      showCancel: false
    });
  },

  onLoad: function(options) {
    const id = options.id;
    const mode = options.mode || 'add';

    if (id) {
      this.setData({ mode });
      this.loadItemDetail(id);

      // 如果是编辑模式，加载编辑信息
      if (mode === 'edit') {
        const editRecordInfo = wx.getStorageSync('editRecordInfo');
        if (editRecordInfo) {
          this.setData({ editRecordInfo });

          // 从记录中加载原有的饮品信息
          this.loadOriginalItemData(editRecordInfo);
        }
      }
    }
  },

  // 加载原有饮品数据（编辑模式）
  loadOriginalItemData: function(editRecordInfo) {
    try {
      let items = [];

      if (editRecordInfo.isTemp) {
        // 临时记录，从本地存储读取
        items = wx.getStorageSync('tempWaitingList') || [];
      } else {
        // 正常记录，从当前页面的记录中读取
        const pages = getCurrentPages();
        const detailPage = pages.find(page => page.route === 'pages/detail/detail');
        if (detailPage && detailPage.data.record) {
          items = detailPage.data.record.items || [];
        }
      }

      const originalItem = items[editRecordInfo.editIndex];
      if (originalItem) {
        this.setData({
          quantity: originalItem.quantity || 1,
          temperature: originalItem.temperature || '冷',
          iceLevel: originalItem.iceLevel || '正常冰',
          sugarLevel: originalItem.sugarLevel || '正常糖',
          remark: originalItem.remark || ''
        });
      }
    } catch (err) {
      console.error('加载原有饮品数据失败:', err);
    }
  },

  // 加载饮品详情
  loadItemDetail: async function(id) {
    wx.showLoading({ title: '加载中...' });

    try {
      const res = await db.query('drink_items', { _id: id });

      wx.hideLoading();

      if (res.success && res.data.length > 0) {
        this.setData({ item: res.data[0] }, () => {
          // 数据设置完成后，添加 loaded 类实现淡入效果
          setTimeout(() => {
            this.setData({ loaded: true });
          }, 50);
          // 底部按钮稍后出现
          setTimeout(() => {
            this.setData({ footerLoaded: true });
          }, 60);
        });
      } else {
        wx.showToast({ title: '饮品不存在', icon: 'none' });
        setTimeout(() => {
          wx.navigateBack();
        }, 500);
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载饮品详情失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 增加数量
  increaseQuantity: function() {
    this.setData({ quantity: this.data.quantity + 1 });
  },

  // 减少数量
  decreaseQuantity: function() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  // 选择温度
  selectTemperature: function(e) {
    const temperature = e.currentTarget.dataset.temperature;
    this.setData({ temperature });
  },

  // 选择冰度
  selectIceLevel: function(e) {
    const iceLevel = e.currentTarget.dataset.iceLevel;
    this.setData({ iceLevel });
  },

  // 选择糖度
  selectSugarLevel: function(e) {
    const sugarLevel = e.currentTarget.dataset.sugarLevel;
    this.setData({ sugarLevel });
  },

  // 输入备注
  onRemarkInput: function(e) {
    this.setData({ remark: e.detail.value });
  },

  // 立即完成（添加模式使用）
  recordNow: async function() {
    // 编辑模式不使用此方法
    if (this.data.mode === 'edit') {
      this.updateRecord();
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const app = getApp();

      // 获取临时列表
      const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];

      // 构建当前饮品
      const currentItem = {
        id: this.data.item._id,
        name: this.data.item.name,
        calories: this.data.item.calories || 0,
        quantity: this.data.quantity,
        temperature: this.data.temperature,
        iceLevel: this.data.iceLevel,
        sugarLevel: this.data.sugarLevel,
        remark: this.data.remark
      };

      const itemsToRecord = [...tempWaitingList, currentItem];

      // 计算总数量和总热量
      let totalQuantity = 0;
      let totalCalories = 0;
      itemsToRecord.forEach(item => {
        totalQuantity += item.quantity;
        totalCalories += (item.calories || 0) * item.quantity;
      });

      // 获取下一个记录编号
      let recordNumber = wx.getStorageSync('currentRecordNumber') || 0;
      recordNumber++;

      const record = {
        recordNumber: recordNumber,
        items: itemsToRecord,
        totalQuantity: totalQuantity,
        totalCalories: totalCalories,
        status: 'completed',
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

  // 继续选择（添加模式使用）
  continueSelect: function() {


    const waitingItem = {
      id: this.data.item._id,
      name: this.data.item.name,
      calories: this.data.item.calories || 0,
      quantity: this.data.quantity,
      temperature: this.data.temperature,
      iceLevel: this.data.iceLevel,
      sugarLevel: this.data.sugarLevel,
      remark: this.data.remark
    };

    console.log('添加的饮品:', waitingItem);

    // 获取临时列表并添加当前饮品
    let tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
    console.log('添加前的临时列表:', tempWaitingList);
    tempWaitingList.push(waitingItem);
    wx.setStorageSync('tempWaitingList', tempWaitingList);
    console.log('添加后的临时列表:', tempWaitingList);

    // 使用 setData 更新上一页的数据
    const pages = getCurrentPages();
    console.log('当前页面栈长度:', pages.length);
    console.log('当前页面栈:', pages.map((p, index) => `${index}: ${p.route}`));

    if (pages.length >= 2) {
      const prevPage = pages[pages.length - 2];
      console.log('上一页路由:', prevPage.route);

      // 如果上一页是 record 页面，更新其 tempWaitingCount 并确保弹窗保持打开
      if (prevPage.route === 'pages/record/record') {
        console.log('更新上一页的弹窗状态');
        // 计算新的 tempWaitingCount
        let count = 0;
        tempWaitingList.forEach(item => {
          count += item.quantity || 1;
        });
        // 确保弹窗保持打开状态
        prevPage.setData({
          tempWaitingCount: count,
          showAddModalFlag: true  // 确保弹窗保持打开
        });
      }

      wx.showToast({
        title: '已添加',
        icon: 'success',
        duration: 800
      });

      console.log('继续选择，准备返回上一页');

      // 延迟返回，让 toast 显示
      setTimeout(() => {
        console.log('准备调用 navigateBack');
        wx.navigateBack({
          delta: 1,
          success: () => {
            console.log('=== 返回成功 ===');
            // wx.showToast({
            //   title: 'navigateBack success',
            //   icon: 'success'
            // });
          },
          fail: (err) => {
            console.error('=== 返回失败 ===', err);
            wx.showModal({
              title: '返回失败',
              content: JSON.stringify(err),
              showCancel: false
            });
          },
          complete: () => {
            console.log('=== navigateBack 调用完成 ===');
          }
        });
      }, 500);
    } else {
      console.error('页面栈异常，无法返回');
      wx.showToast({
        title: '返回失败',
        icon: 'none'
      });
    }
  },

  // 更新记录（编辑模式）
  updateRecord: async function() {
    if (!this.data.editRecordInfo) {
      wx.showToast({ title: '编辑信息丢失', icon: 'none' });
      return;
    }

    const { recordId, isTemp, editIndex } = this.data.editRecordInfo;

    // 构建更新后的饮品数据
    const updatedItem = {
      id: this.data.item._id,
      name: this.data.item.name,
      calories: this.data.item.calories || 0,
      quantity: this.data.quantity,
      temperature: this.data.temperature,
      iceLevel: this.data.iceLevel,
      sugarLevel: this.data.sugarLevel,
      remark: this.data.remark
    };

    if (isTemp) {
      // 临时记录，更新本地存储
      const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
      tempWaitingList[editIndex] = updatedItem;
      wx.setStorageSync('tempWaitingList', tempWaitingList);

      wx.showToast({ title: '更新成功', icon: 'success' });
    } else {
      // 正常记录，更新数据库
      wx.showLoading({ title: '更新中...' });

      try {
        const db = require('../../utils/database.js');

        // 获取记录
        const res = await db.query('records', { _id: recordId });
        if (res.success && res.data.length > 0) {
          const record = res.data[0];
          const items = [...record.items];
          items[editIndex] = updatedItem;

          // 重新计算总数
          let totalQuantity = 0;
          let totalCalories = 0;
          items.forEach(item => {
            totalQuantity += item.quantity || 1;
            totalCalories += (item.calories || 0) * (item.quantity || 1);
          });

          // 更新数据库
          const updateResult = await db.update('records', recordId, {
            items,
            totalQuantity,
            totalCalories
          });

          if (updateResult.success) {
            wx.showToast({ title: '更新成功', icon: 'success' });
          } else {
            wx.showToast({ title: '更新失败', icon: 'none' });
          }
        } else {
          wx.showToast({ title: '记录不存在', icon: 'none' });
        }

        wx.hideLoading();
      } catch (err) {
        wx.hideLoading();
        console.error('更新记录失败:', err);
        wx.showToast({ title: '更新失败', icon: 'none' });
      }
    }

    // 返回记录详情页面（编辑模式只返回一页）
    setTimeout(() => {
      wx.navigateBack({
        delta: 1, // 返回一页：回到记录详情页面
        success: () => {
          // 记录详情页面的 onShow 会自动刷新数据
        }
      });
    }, 500);
  },

  // 继续选择（添加模式使用）
  continueSelect: function() {
    // 编辑模式不使用此方法
    if (this.data.mode === 'edit') {
      this.updateRecord();
      return;
    }

    const waitingItem = {
      id: this.data.item._id,
      name: this.data.item.name,
      calories: this.data.item.calories || 0,
      quantity: this.data.quantity,
      temperature: this.data.temperature,
      iceLevel: this.data.iceLevel,
      sugarLevel: this.data.sugarLevel,
      remark: this.data.remark
    };

    console.log('添加的饮品:', waitingItem);

    // 获取临时列表并添加当前饮品
    let tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
    console.log('添加前的临时列表:', tempWaitingList);
    tempWaitingList.push(waitingItem);
    wx.setStorageSync('tempWaitingList', tempWaitingList);
    console.log('添加后的临时列表:', tempWaitingList);

    // 使用 setData 更新上一页的数据
    const pages = getCurrentPages();
    console.log('当前页面栈长度:', pages.length);
    console.log('当前页面栈:', pages.map((p, index) => `${index}: ${p.route}`));

    if (pages.length >= 2) {
      const prevPage = pages[pages.length - 2];
      console.log('上一页路由:', prevPage.route);

      // 如果上一页是 record 页面，更新其 tempWaitingCount 并确保弹窗保持打开
      if (prevPage.route === 'pages/record/record') {
        console.log('更新上一页的弹窗状态');
        // 计算新的 tempWaitingCount
        let count = 0;
        tempWaitingList.forEach(item => {
          count += item.quantity || 1;
        });
        // 确保弹窗保持打开状态
        prevPage.setData({
          tempWaitingCount: count,
          showAddModalFlag: true  // 确保弹窗保持打开
        });
      }

      wx.showToast({
        title: '已添加',
        icon: 'success',
        duration: 800
      });

      console.log('继续选择，准备返回上一页');

      // 延迟返回，让 toast 显示
      setTimeout(() => {
        console.log('准备调用 navigateBack');
        wx.navigateBack({
          delta: 1,
          success: () => {
            console.log('=== 返回成功 ===');
          },
          fail: (err) => {
            console.error('=== 返回失败 ===', err);
            wx.showModal({
              title: '返回失败',
              content: JSON.stringify(err),
              showCancel: false
            });
          },
          complete: () => {
            console.log('=== navigateBack 调用完成 ===');
          }
        });
      }, 500);
    } else {
      console.error('页面栈异常，无法返回');
      wx.showToast({
        title: '返回失败',
        icon: 'none'
      });
    }
  }
});
