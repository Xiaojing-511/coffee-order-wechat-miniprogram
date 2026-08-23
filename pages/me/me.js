const { getMerchantInfo, hasValidService } = require('../../utils/merchant.js');

Page({
  data: {
    merchant: null,
    valid: false,
    openid: ''
  },

  onShow: function() {
    const merchant = getMerchantInfo();
    let openid = '';
    try {
      const app = getApp();
      openid = (app && app.globalData && app.globalData.openid) || wx.getStorageSync('openid') || '';
    } catch (e) { /* 忽略 */ }
    this.setData({ merchant: merchant, valid: hasValidService(), openid: openid });
  },

  // 复制 openid（便于平台方加白名单）
  copyOpenid: function() {
    if (!this.data.openid) {
      wx.showToast({ title: '暂无 openid', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.openid,
      success: function() {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  goStoreSettings: function() {
    wx.navigateTo({ url: '/pages/store-settings/store-settings' });
  },

  goStoreQr: function() {
    wx.navigateTo({ url: '/pages/store-qr/store-qr' });
  },

  goMenu: function() {
    const merchant = getMerchantInfo();
    const storeId = (merchant && merchant.storeId) || wx.getStorageSync('storeId') || 'S1001';
    // 预览顾客端：扫码落地的店铺欢迎页 → 开始点单
    wx.navigateTo({ url: '/menu-pages/store-home?storeId=' + storeId });
  },

  goPrivacy: function() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  formatExpire: function(ts) {
    if (!ts) return '长期有效';
    const d = new Date(ts);
    const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
});
