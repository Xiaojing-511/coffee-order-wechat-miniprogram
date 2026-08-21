const { myStoreId, getMerchantInfo } = require('../../utils/merchant.js');

Page({
  data: {
    storeId: '',
    storeName: ''
  },

  onLoad: function() {
    const m = getMerchantInfo();
    this.setData({
      storeId: myStoreId(),
      storeName: (m && m.storeName) || '我的店铺'
    });
  },

  onShareAppMessage: function() {
    return {
      title: this.data.storeName + ' · 点单小程序',
      path: '/menu-pages/menu-list?storeId=' + this.data.storeId
    };
  },

  goMenu: function() {
    wx.redirectTo({ url: '/menu-pages/menu-list?storeId=' + this.data.storeId + '&source=merchant' });
  }
});
