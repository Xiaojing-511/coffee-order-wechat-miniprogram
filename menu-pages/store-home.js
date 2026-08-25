const db = require('../utils/database.js');
const { parseStoreId, parseSceneParams, setStoreId, getStoreId } = require('../utils/storeContext.js');
const { isMerchant } = require('../utils/merchant.js');

// 店铺欢迎页：扫码第一屏 / 冷启动首页，咖啡图背景 + 店铺介绍 + 点单入口
// 商家身份（冷启动进入）自动切换到商家端
Page({
  data: {
    store: {
      storeId: '',
      storeName: '欢迎光临',
      announcement: '',
      openTime: '',
      status: 'open',
      address: '',
      phone: ''
    },
    canBack: false,      // 由其他页面进入时显示返回按钮
    isLandingDemo: false // 官网落地页扫码体验
  },

  onLoad: async function(options) {
    // 非扫码直入（商家预览/分享）时显示返回按钮
    this.setData({ canBack: getCurrentPages().length > 1 });

    // 解析店铺：小程序码 scene / 分享 query
    const sid = parseStoreId(options);
    if (sid) setStoreId(sid);

    // 官网落地页体验标记，透传给点单页
    const params = parseSceneParams(options);
    if (params.src === 'landing') {
      this.setData({ isLandingDemo: true });
    }

    this.loadStore();

    // 冷启动（欢迎页为入口页）时：等登录完成后，商家身份直接切到商家端
    if (getCurrentPages().length === 1) {
      try {
        const app = getApp();
        if (app && app.loginReady) await app.loginReady;
      } catch (e) { /* 忽略 */ }
      if (isMerchant()) {
        wx.switchTab({ url: '/pages/orders/orders' });
        return;
      }
    }
  },

  loadStore: async function() {
    const sid = getStoreId();
    if (!sid) return;
    try {
      const res = await db.query('stores', { storeId: sid }, { limit: 1 });
      if (res.success && res.data && res.data.length > 0) {
        const s = res.data[0];
        this.setData({
          store: {
            storeId: s.storeId || sid,
            storeName: s.storeName || '欢迎光临',
            announcement: s.announcement || '',
            openTime: s.openTime || '',
            status: s.status || 'open',
            address: s.address || '',
            phone: s.phone || ''
          }
        });
      }
    } catch (err) {
      console.error('加载店铺信息失败:', err);
    }
  },

  // 进入点单页（保留体验来源标记）
  goOrder: function() {
    if (this.data.store.status === 'closed') {
      wx.showToast({ title: '店铺休息中，暂不可下单', icon: 'none' });
      return;
    }
    const url = '/menu-pages/menu-list' + (this.data.isLandingDemo ? '?src=landing' : '');
    wx.navigateTo({ url: url });
  },

  goBack: function() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage: function() {
    const sid = getStoreId();
    return {
      title: (this.data.store.storeName || '饮品') + ' · 扫码点单',
      path: '/menu-pages/store-home' + (sid ? ('?storeId=' + sid) : '')
    };
  }
});
