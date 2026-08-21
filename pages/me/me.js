const { getMerchantInfo, hasValidService } = require('../../utils/merchant.js');

Page({
  data: {
    merchant: null,
    valid: false
  },

  onShow: function() {
    const merchant = getMerchantInfo();
    this.setData({ merchant: merchant, valid: hasValidService() });
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
    wx.redirectTo({ url: '/menu-pages/menu-list?storeId=' + storeId });
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
