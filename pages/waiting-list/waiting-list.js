Page({
  data: {
    waitingItems: [],
    totalQuantity: 0,
    totalCalories: 0,
    recordNumber: 0
  },

  onLoad: function() {
    this.loadRecordNumber();
    this.loadWaitingList();
  },

  onShow: function() {
    this.loadRecordNumber();
    this.loadWaitingList();
  },

  // 加载记录编号
  loadRecordNumber: function() {
    let recordNumber = wx.getStorageSync('currentRecordNumber') || 0;
    recordNumber++;
    this.setData({ recordNumber });
  },

  // 加载待选列表
  loadWaitingList: function() {
    const waitingList = wx.getStorageSync('waitingList') || [];
    let totalQuantity = 0;
    let totalCalories = 0;

    waitingList.forEach(item => {
      totalQuantity += item.quantity || 1;
      totalCalories += (item.calories || 0) * (item.quantity || 1);
    });

    this.setData({
      waitingItems: waitingList,
      totalQuantity,
      totalCalories
    });
  },

  // 增加数量
  increaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index;
    const waitingItems = this.data.waitingItems;
    waitingItems[index].quantity++;
    this.updateWaitingList(waitingItems);
  },

  // 减少数量
  decreaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index;
    const waitingItems = this.data.waitingItems;

    if (waitingItems[index].quantity > 1) {
      waitingItems[index].quantity--;
    } else {
      waitingItems.splice(index, 1);
    }
    this.updateWaitingList(waitingItems);
  },

  // 更新待选列表
  updateWaitingList: function(waitingItems) {
    wx.setStorageSync('waitingList', waitingItems);
    this.loadWaitingList();
  },

  // 提交记录
  submitRecord: async function() {
    if (this.data.waitingItems.length === 0) {
      wx.showToast({ title: '待选列表为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    try {
      const db = require('../../utils/database.js');

      // 获取下一个记录编号
      let recordNumber = wx.getStorageSync('currentRecordNumber') || 0;
      recordNumber++;

      const record = {
        recordNumber: recordNumber,
        items: this.data.waitingItems.map(item => ({
          id: item.id,
          name: item.name,
          calories: item.calories || 0,
          quantity: item.quantity,
          temperature: item.temperature || '默认',
          sugarLevel: item.sugarLevel || '无',
          remark: item.remark || ''
        })),
        totalQuantity: this.data.totalQuantity,
        totalCalories: this.data.totalCalories,
        status: 'completed',
        createTime: new Date().getTime(),
        dateString: getApp().getTodayString()
      };

      const res = await db.add('records', record);

      if (res.success) {
        wx.setStorageSync('currentRecordNumber', recordNumber);
        wx.setStorageSync('waitingList', []);

        wx.hideLoading();
        wx.showToast({
          title: `记录 ${recordNumber} 已提交`,
          icon: 'success'
        });

        setTimeout(() => {
          wx.switchTab({ url: '/pages/record/record' });
        }, 500);
      } else {
        wx.hideLoading();
        wx.showToast({ title: '提交失败', icon: 'none' });
      }
    } catch (err) {
      console.error('提交记录失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  }
});
