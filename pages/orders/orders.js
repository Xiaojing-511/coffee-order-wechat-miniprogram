const db = require('../../utils/database.js');
const { formatPrice } = require('../../utils/money.js');
const { ORDER_STATUS_TEXT } = require('../../utils/order.js');
const { myStoreId } = require('../../utils/merchant.js');

Page({
  data: {
    orders: [],
    statusText: ORDER_STATUS_TEXT
  },

  onShow: function() {
    this.loadOrders();
  },

  loadOrders: async function() {
    try {
      const res = await db.query('orders', { storeId: myStoreId() }, {
        orderBy: { field: 'createTime', order: 'desc' }
      });
      if (res.success) {
        const orders = res.data || [];
        orders.forEach(function(order) {
          if (order.items) {
            order.items.forEach(function(oi, i) { oi.key = oi.key || (oi.id + '_' + i); });
          }
        });
        this.setData({ orders: orders });
      }
    } catch (err) {
      console.error('加载订单失败:', err);
    }
  },

  formatPrice: function(cents) {
    return formatPrice(cents);
  },

  formatTime: function(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return d.getMonth() + 1 + '-' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
});
