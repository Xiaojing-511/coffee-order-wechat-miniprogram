const db = require('../../utils/database.js');
const { myStoreId, getMerchantInfo } = require('../../utils/merchant.js');

Page({
  data: {
    storeId: '',
    storeName: '',
    qrFileId: '',
    generating: false,
    error: ''
  },

  onLoad: function() {
    const m = getMerchantInfo();
    this.setData({
      storeId: myStoreId(),
      storeName: (m && m.storeName) || '我的店铺'
    });
    this.loadQr();
  },

  // 优先读取已生成的小程序码，没有则生成
  loadQr: async function() {
    try {
      const res = await db.query('stores', { storeId: this.data.storeId }, { limit: 1 });
      if (res.success && res.data && res.data.length > 0 && res.data[0].qrFileId) {
        this.setData({ qrFileId: res.data[0].qrFileId, error: '' });
        return;
      }
    } catch (e) { /* 忽略 */ }
    this.generateQr();
  },

  generateQr: async function() {
    if (this.data.generating) return;
    this.setData({ generating: true, error: '' });
    try {
      if (wx.cloud && wx.cloud.callFunction) {
        const res = await wx.cloud.callFunction({ name: 'storeQr', data: {} });
        const result = res.result || {};
        if (result.success && result.fileID) {
          this.setData({ qrFileId: result.fileID, generating: false });
          return;
        }
        this.setData({ error: result.error || '生成失败', generating: false });
      } else {
        this.setData({ error: '云开发未连接', generating: false });
      }
    } catch (err) {
      console.error('生成店铺码失败:', err);
      this.setData({ error: '生成失败：请确认已部署 storeQr 云函数', generating: false });
    }
  },

  onShareAppMessage: function() {
    return {
      title: this.data.storeName + ' · 扫码点单',
      path: '/menu-pages/menu-list?storeId=' + this.data.storeId
    };
  },

  goMenu: function() {
    wx.redirectTo({ url: '/menu-pages/menu-list?storeId=' + this.data.storeId + '&source=merchant' });
  }
});
