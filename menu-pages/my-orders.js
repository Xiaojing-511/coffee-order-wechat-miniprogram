const { formatPrice } = require('../utils/money.js');
const { ORDER_STATUS_TEXT, ORDER_STATUS } = require('../utils/order.js');
const db = require('../utils/database.js');
const orderService = require('../utils/orderService.js');

Page({
  data: {
    orders: [],
    expandedId: '',
    statusText: ORDER_STATUS_TEXT
  },

  onShow: function() {
    this.loadOrders();
  },

  loadOrders: async function() {
    const orders = await orderService.getMyOrders();
    // 为每条 order item 补唯一 key（避免 wx:key 告警）
    orders.forEach(function(order) {
      if (order.items) {
        order.items.forEach(function(oi, i) {
          oi.key = oi.key || (oi.id + '_' + i);
        });
      }
    });

    // 加载订单对应店铺名
    const storeIds = [];
    orders.forEach(function(o) {
      if (o.storeId && storeIds.indexOf(o.storeId) === -1) storeIds.push(o.storeId);
    });
    const storeNameMap = {};
    if (storeIds.length > 0) {
      await Promise.all(storeIds.map(async function(sid) {
        const res = await db.query('stores', { storeId: sid }, { limit: 1 });
        if (res.success && res.data && res.data.length > 0) {
          storeNameMap[sid] = res.data[0].storeName || sid;
        } else {
          storeNameMap[sid] = sid;
        }
      }));
    }
    orders.forEach(function(o) {
      if (o.storeId) o.storeName = storeNameMap[o.storeId] || o.storeId;
    });

    this.setData({ orders: orders });
  },

  toggleExpand: function(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },

  // 去支付（待支付订单，模拟支付）
  payNow: function(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '模拟支付',
      content: '确认支付该订单吗？（模拟支付，不扣真实款项）',
      confirmColor: '#8B4513',
      success: async function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '支付中...' });
          const r = await orderService.mockPay(id);
          wx.hideLoading();
          if (r.success) {
            wx.showToast({ title: '支付成功', icon: 'success' });
            that.loadOrders();
          } else {
            wx.showToast({ title: r.error || '支付失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 取消订单
  cancelOrder: function(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单吗？',
      confirmColor: '#eb3349',
      success: async function(res) {
        if (res.confirm) {
          const r = await orderService.cancelOrder(id);
          if (r.success) {
            wx.showToast({ title: '已取消', icon: 'success' });
            that.loadOrders();
          } else {
            wx.showToast({ title: r.error || '取消失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 再来一单
  reorder: async function(e) {
    const id = e.currentTarget.dataset.id;
    const count = await orderService.reorder(id);
    if (count > 0) {
      wx.showToast({ title: '已加入购物车', icon: 'success' });
      setTimeout(function() {
        wx.navigateTo({ url: '/menu-pages/cart' });
      }, 500);
    } else {
      wx.showToast({ title: '再来一单失败', icon: 'none' });
    }
  },

  goShopping: function() {
    wx.redirectTo({ url: '/menu-pages/menu-list' });
  },

  formatPrice: function(cents) {
    return formatPrice(cents);
  },

  formatTime: function(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
});
