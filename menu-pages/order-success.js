const { formatPrice } = require('../utils/money.js');
const orderService = require('../utils/orderService.js');
const { getOrderSource } = require('../utils/storeContext.js');
const { isMerchant } = require('../utils/merchant.js');

Page({
  data: {
    order: null,
    orderId: '',
    merchantMode: false
  },

  onLoad: function(options) {
    // 商家代客下单成功：展示「返回商家端」
    const merchantMode = isMerchant() &&
      (options.source === 'merchant' || getOrderSource() === 'merchant');
    this.setData({ merchantMode: merchantMode });
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
      // 预格式化价格展示文本（直接绑定，避免模板方法调用不生效导致价格不显示）
      if (order.items) {
        order.items.forEach(function(oi) {
          oi.priceText = formatPrice(oi.price || 0);
          oi.subtotalText = formatPrice((oi.price || 0) * (oi.quantity || 1));
        });
      }
      order.totalAmountText = formatPrice(order.totalAmount);
      this.setData({ order: order });
    } else {
      wx.showToast({ title: '订单不存在', icon: 'none' });
    }
  },

  goToMyOrders: function() {
    wx.redirectTo({ url: '/menu-pages/my-orders' });
  },

  goBackToMenu: function() {
    if (this.data.merchantMode) {
      // 商家继续点单：保持代客下单模式
      wx.redirectTo({ url: '/menu-pages/menu-list?source=merchant' });
      return;
    }
    wx.redirectTo({ url: '/menu-pages/menu-list' });
  },

  // 商家代客下单完成：返回商家端订单页
  goMerchantHome: function() {
    wx.switchTab({ url: '/pages/orders/orders' });
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
