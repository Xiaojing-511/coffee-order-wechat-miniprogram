const { formatPrice } = require('../utils/money.js');
const orderService = require('../utils/orderService.js');

Page({
  data: {
    order: null,
    orderId: ''
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.loadOrder(options.id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
    }
  },

  loadOrder: async function(orderId) {
    const order = await orderService.getOrderById(orderId);
    if (order) {
      this.setData({ order: order });
    } else {
      wx.showToast({ title: '订单不存在', icon: 'none' });
    }
  },

  goToMyOrders: function() {
    wx.redirectTo({ url: '/menu-pages/my-orders' });
  },

  goBackToMenu: function() {
    wx.redirectTo({ url: '/menu-pages/menu-list' });
  },

  formatPrice: function(cents) {
    return formatPrice(cents);
  },

  formatTime: function(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
});
