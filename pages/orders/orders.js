const { formatPrice } = require('../../utils/money.js');
const { ORDER_STATUS_TEXT } = require('../../utils/order.js');
const { isMerchant, myStoreId } = require('../../utils/merchant.js');
const orderService = require('../../utils/orderService.js');

const TABS = [
  { key: '', label: '全部' },
  { key: 'paid', label: '待接单' },
  { key: 'accepted', label: '制作中' },
  { key: 'ready', label: '待取餐' },
  { key: 'done', label: '已完成' }
];

Page({
  data: {
    tabs: TABS,
    currentTab: '',
    orders: [],
    counts: {},
    statusText: ORDER_STATUS_TEXT,
    sourceText: { merchant: '前台点单', customer: '顾客下单' },
    notMerchant: false,
    expired: false
  },

  onShow: function() {
    if (!isMerchant()) {
      this.setData({ notMerchant: true, orders: [] });
      return;
    }
    this.loadOrders();
  },

  onPullDownRefresh: function() {
    this.loadOrders().then(function() {
      wx.stopPullDownRefresh();
    });
  },

  // 商家前台点单（代客下单）：进入自己店铺的点单流程
  goMerchantOrder: function() {
    wx.redirectTo({ url: '/menu-pages/menu-list?storeId=' + myStoreId() + '&source=merchant' });
  },

  switchTab: function(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentTab: key });
    this.loadOrders(key);
  },

  loadOrders: async function(status) {
    const key = (status === undefined) ? this.data.currentTab : status;
    const res = await orderService.merchantListOrders(key);
    if (!res.success) {
      if (res.code === 'expired') {
        this.setData({ expired: true, orders: [] });
      } else {
        wx.showToast({ title: res.error || '加载失败', icon: 'none' });
      }
      return;
    }
    const orders = res.orders || [];
    // 补 items key
    orders.forEach(function(order) {
      if (order.items) {
        order.items.forEach(function(oi, i) { oi.key = oi.key || (oi.id + '_' + i); });
      }
    });
    // 统计各状态数量
    const counts = {};
    orders.forEach(function(o) { counts[o.status] = (counts[o.status] || 0) + 1; });
    this.setData({ orders: orders, counts: counts, expired: false });
    // 新订单提醒 + tabBar 角标
    this.checkNewOrders(counts);
  },

  // 新订单提醒：待接单数量增加时震动+提示，并设置 tab 角标
  checkNewOrders: function(counts) {
    const paidCount = counts.paid || 0;
    const lastCount = wx.getStorageSync('lastPaidCount') || 0;
    if (paidCount > 0) {
      wx.setTabBarBadge({ index: 0, text: String(paidCount) });
    } else {
      wx.removeTabBarBadge({ index: 0 });
    }
    if (paidCount > lastCount && lastCount > 0) {
      wx.vibrateShort({ type: 'medium' });
      wx.showToast({ title: '有 ' + (paidCount - lastCount) + ' 个新订单', icon: 'none' });
    }
    wx.setStorageSync('lastPaidCount', paidCount);
  },

  // 接单 paid -> accepted
  acceptOrder: function(e) {
    this.updateStatus(e, 'accepted', '已接单');
  },
  // 完成制作 accepted -> ready
  startReady: function(e) {
    this.updateStatus(e, 'ready', '已出餐，等待取餐');
  },
  // 核销完成 ready -> done
  completeOrder: function(e) {
    this.updateStatus(e, 'done', '已完成');
  },
  // 取消订单
  cancelOrder: function(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单吗？',
      confirmColor: '#eb3349',
      success: function(res) {
        if (res.confirm) {
          that.updateStatus({ currentTarget: { dataset: { id: id } } }, 'cancelled', '已取消');
        }
      }
    });
  },

  updateStatus: async function(e, status, successMsg) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '更新中...' });
    const res = await orderService.merchantUpdateStatus(id, status);
    wx.hideLoading();
    if (res.success) {
      wx.showToast({ title: successMsg, icon: 'success' });
      this.loadOrders();
    } else {
      wx.showToast({ title: res.error || '更新失败', icon: 'none' });
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
