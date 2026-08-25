const db = require('../../utils/database.js');
const { myStoreId, getMerchantInfo } = require('../../utils/merchant.js');

Page({
  data: {
    storeId: '',
    storeName: '',
    qrFileId: '',
    generating: false,
    demoGenerating: false,
    demoQrFileId: '',
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

  // 生成官网宣传体验码（平台级，仅创始人 openid 有权限）
  // page: menu-pages/store-home  scene: storeId=S1001&src=landing
  generateDemoQr: async function() {
    if (this.data.demoGenerating) return;
    this.setData({ demoGenerating: true, error: '' });
    try {
      const res = await wx.cloud.callFunction({ name: 'storeQr', data: { demo: true } });
      const result = res.result || {};
      if (result.success && result.fileID) {
        this.setData({ demoQrFileId: result.fileID, demoGenerating: false });
        wx.showToast({ title: '宣传码已生成', icon: 'success' });
        return;
      } else if (result.code === 'not_owner') {
        wx.showToast({ title: '仅平台创始人可生成', icon: 'none' });
      } else {
        wx.showToast({ title: result.error || '生成失败', icon: 'none' });
      }
    } catch (err) {
      console.error('生成官网宣传码失败:', err);
      wx.showToast({ title: '生成失败：请确认已部署最新 storeQr 云函数', icon: 'none' });
    } finally {
      this.setData({ demoGenerating: false });
    }
  },

  onShareAppMessage: function() {
    return {
      title: this.data.storeName + ' · 扫码点单',
      path: '/menu-pages/store-home?storeId=' + this.data.storeId
    };
  },

  goMenu: function() {
    wx.navigateTo({ url: '/menu-pages/store-home?storeId=' + this.data.storeId });
  }
});
