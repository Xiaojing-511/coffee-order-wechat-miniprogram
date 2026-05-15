const db = require('../utils/database.js');

Page({
  data: {
    item: null,
    loading: true
  },

  onLoad: function(options) {
    // // 尝试隐藏返回按钮
    wx.hideHomeButton();

    // 优先从数据库加载数据
    if (options.id) {
      this.loadDrinkById(options.id);
    } else if (options.item) {
      // 降级：从 URL 参数解析数据
      try {
        const item = JSON.parse(decodeURIComponent(options.item));
        this.setData({ item, loading: false });
        wx.setNavigationBarTitle({
          title: item.name || '饮品详情'
        });
      } catch (err) {
        console.error('解析饮品数据失败:', err);
        this.setData({ loading: false });
        wx.showToast({
          title: '数据加载失败',
          icon: 'none'
        });
      }
    } else {
      this.setData({ loading: false });
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
    }
  },

  onShow: function() {
    // 每次显示页面都尝试隐藏返回按钮
    wx.hideHomeButton();
  },

  // 根据ID从数据库加载饮品数据
  loadDrinkById: async function(id) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await db.query('drink_items', { _id: id });

      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0];
        this.setData({ item, loading: false });
        wx.setNavigationBarTitle({
          title: item.name || '饮品详情'
        });
      } else {
        console.error('未找到饮品数据');
        wx.showToast({
          title: '未找到该饮品',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('加载饮品失败:', err);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  previewImage: function() {
    const { item } = this.data;
    if (item && item.imageUrl) {
      wx.previewImage({
        current: item.imageUrl,
        urls: [item.imageUrl]
      });
    }
  },

  // 返回菜单列表（使用 redirectTo 禁止返回）
  goBack: function() {
    wx.redirectTo({
      url: '/menu-pages/menu-list'
    });
  }
});
