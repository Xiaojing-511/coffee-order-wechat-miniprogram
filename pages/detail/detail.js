const db = require('../../utils/database.js');

Page({
  data: {
    recordId: null,
    record: null,
    recordTime: '',
    createTime: '',
    isTemp: false
  },

  onLoad: function(options) {
    const recordId = options.recordId;
    const isTemp = options.isTemp === '1';
    console.log('detail页面加载', { recordId, isTemp, options });
    if (recordId) {
      this.setData({ recordId, isTemp });
      this.loadRecord(recordId, isTemp);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    }
  },

  onShow: function() {
    console.log('detail页面 onShow');
    // 从饮品详情页面返回后刷新数据
    this.refreshData();
  },

  onUnload: function() {
    console.log('detail页面 onUnload');
  },

  // 加载记录详情
  loadRecord: async function(recordId, isTemp) {
    wx.showLoading({ title: '加载中...' });

    try {
      if (isTemp) {
        // 临时记录，从本地存储读取
        const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
        if (tempWaitingList.length === 0) {
          wx.hideLoading();
          wx.showToast({ title: '暂无已选饮品', icon: 'none' });
          setTimeout(() => {
            wx.navigateBack();
          }, 500);
          return;
        }

        // 构造临时记录数据
        let totalQuantity = 0;
        let totalCalories = 0;
        tempWaitingList.forEach(item => {
          totalQuantity += item.quantity || 1;
          totalCalories += (item.calories || 0) * (item.quantity || 1);
        });

        const record = {
          _id: 'temp',
          recordNumber: '待确定',
          items: tempWaitingList,
          totalQuantity,
          totalCalories,
          createTime: new Date().getTime()
        };

        wx.hideLoading();
        const app = getApp();
        this.setData({
          record,
          recordTime: app.formatTime(record.createTime),
          createTime: this.formatFullTime(record.createTime)
        }, () => {
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
        // 正常记录，从数据库读取
        const res = await db.query('records', { _id: recordId });

        wx.hideLoading();

        if (res.success && res.data.length > 0) {
          const record = res.data[0];
          const app = getApp();
          this.setData({
            record,
            recordTime: app.formatTime(record.createTime),
            createTime: this.formatFullTime(record.createTime)
          }, () => {
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
          wx.showToast({ title: '记录不存在', icon: 'none' });
          setTimeout(() => {
            wx.navigateBack();
          }, 500);
        }
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载记录失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 删除饮品
  deleteItem: function(e) {
    // 检查记录是否已完成，已完成则不允许修改
    if (this.data.record && this.data.record.completed) {
    
      return;
    }

    const index = e.currentTarget.dataset.index;
    const item = this.data.record.items[index];

    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${item.name}」吗？`,
      confirmColor: '#eb3349',
      success: async (res) => {
        if (res.confirm) {
          if (this.data.isTemp) {
            // 临时记录，从本地存储删除
            const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
            tempWaitingList.splice(index, 1);
            wx.setStorageSync('tempWaitingList', tempWaitingList);

            // 重新加载记录
            this.loadRecord(this.data.recordId, true);

            wx.showToast({ title: '删除成功', icon: 'success' });

            // 如果临时列表为空，返回
            if (tempWaitingList.length === 0) {
              setTimeout(() => {
                wx.navigateBack();
              }, 500);
            }
          } else {
            // 正常记录，更新数据库
            wx.showLoading({ title: '删除中...' });

            try {
              const items = [...this.data.record.items];
              items.splice(index, 1);

              // 重新计算总数
              let totalQuantity = 0;
              let totalCalories = 0;
              items.forEach(item => {
                totalQuantity += item.quantity || 1;
                totalCalories += (item.calories || 0) * (item.quantity || 1);
              });

              const result = await db.update('records', this.data.recordId, {
                items,
                totalQuantity,
                totalCalories
              });

              wx.hideLoading();

              if (result.success) {
                // 更新本地数据
                this.setData({
                  'record.items': items,
                  'record.totalQuantity': totalQuantity,
                  'record.totalCalories': totalCalories
                });
                wx.showToast({ title: '删除成功', icon: 'success' });
              } else {
                wx.showToast({ title: '删除失败', icon: 'none' });
              }
            } catch (err) {
              wx.hideLoading();
              console.error('删除饮品失败:', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          }
        }
      }
    });
  },

  // 删除记录
  deleteRecord: function() {
    console.log('点击删除记录');
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#eb3349',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });

          try {
            const result = await db.remove('records', this.data.recordId);
            wx.hideLoading();

            if (result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              setTimeout(() => {
                console.log('准备返回记录页面');
                wx.navigateBack({
                  delta: 1,
                  success: () => {
                    console.log('删除后返回成功');
                  }
                });
              }, 500);
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('删除记录失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 返回（临时记录用）
  goBack: function() {
    console.log('=== 点击继续选择，准备返回 ===');
    const pages = getCurrentPages();
    console.log('当前页面栈长度:', pages.length);
    console.log('当前页面栈:', pages.map((p, index) => `${index}: ${p.route}`));

    // 检查上一页是否是 record 页面
    if (pages.length >= 2) {
      const prevPage = pages[pages.length - 2];
      console.log('上一页路由:', prevPage.route);

      // 如果上一页是 record 页面，更新其数据并确保弹窗保持打开
      if (prevPage.route === 'pages/record/record') {
        console.log('更新上一页的弹窗状态');
        const tempWaitingList = wx.getStorageSync('tempWaitingList') || [];
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

      wx.navigateBack({
        delta: 1,
        success: () => {
          console.log('=== 返回成功 ===');
        },
        fail: (err) => {
          console.error('=== 返回失败 ===', err);
          console.error('错误信息:', JSON.stringify(err));
          wx.showToast({
            title: '返回失败',
            icon: 'none'
          });
        },
        complete: () => {
          console.log('=== navigateBack 调用完成 ===');
        }
      });
    } else {
      console.error('页面栈异常，无法返回');
      wx.showToast({
        title: '无法返回',
        icon: 'none'
      });
    }
  },

  // 立即完成（临时记录专用）
  confirmSubmit: function() {
    const pages = getCurrentPages();

    // 检查上一页是否是 record 页面
    if (pages.length >= 2) {
      const prevPage = pages[pages.length - 2];

      // 如果上一页是 record 页面，调用其 recordNow 方法
      if (prevPage.route === 'pages/record/record') {
        console.log('调用上一页的 recordNow 方法');
        prevPage.recordNow();
      } else {
        console.error('上一页不是 record 页面');
        wx.showToast({
          title: '无法完成',
          icon: 'none'
        });
      }
    } else {
      console.error('页面栈异常，无法返回');
      wx.showToast({
        title: '无法完成',
        icon: 'none'
      });
    }
  },

  // 格式化完整时间
  formatFullTime: function(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 编辑饮品 - 跳转到饮品详情页面
  editItem: function(e) {
    // 检查记录是否已完成，已完成则不允许修改
    if (this.data.record && this.data.record.completed) {
  
      return;
    }

    const index = e.currentTarget.dataset.index;
    const item = this.data.record.items[index];

    // 将编辑信息存储到本地，供饮品详情页面使用
    wx.setStorageSync('editRecordInfo', {
      recordId: this.data.recordId,
      isTemp: this.data.isTemp,
      editIndex: index
    });

    // 跳转到饮品详情页面，传递编辑模式参数
    wx.navigateTo({
      url: `/pages/item-detail/item-detail?id=${item.id}&mode=edit`
    });
  },

  // 从饮品详情页面返回后刷新数据
  refreshData: function() {
    this.loadRecord(this.data.recordId, this.data.isTemp);
  }
});
