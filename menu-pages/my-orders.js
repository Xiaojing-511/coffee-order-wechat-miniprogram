const { formatPrice } = require('../utils/money.js');
const { ORDER_STATUS_TEXT } = require('../utils/order.js');
const { getStoreId } = require('../utils/storeContext.js');
const db = require('../utils/database.js');
const orderService = require('../utils/orderService.js');

Page({
  data: {
    orders: [],
    displayOrders: [],
    counts: {},
    currentStatus: '',   // 当前筛选状态：'' 全部 / paid 待接单 / accepted 制作中 / ready 待取餐 / done 已完成
    expandedId: '',
    statusText: ORDER_STATUS_TEXT,
    maskedOpenid: '',
    loading: true
  },

  onShow: function() {
    this.loadOrders();
  },

  loadOrders: async function() {
    this.setData({ loading: true });
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

    // 各状态数量
    const counts = { total: orders.length };
    orders.forEach(function(o) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });

    // openid 脱敏展示
    let maskedOpenid = '';
    const openid = wx.getStorageSync('openid') || '';
    if (openid) {
      maskedOpenid = openid.length > 8 ? (openid.slice(0, 4) + '****' + openid.slice(-4)) : openid;
    }

    this.setData({ orders: orders, counts: counts, maskedOpenid: maskedOpenid, loading: false });
    this.applyFilter();
  },

  // 按状态筛选展示
  applyFilter: function() {
    const st = this.data.currentStatus;
    const list = st ? this.data.orders.filter(function(o) { return o.status === st; }) : this.data.orders;
    this.setData({ displayOrders: list });
  },

  switchStatus: function(e) {
    const st = e.currentTarget.dataset.status || '';
    if (st === this.data.currentStatus) return;
    this.setData({ currentStatus: st });
    this.applyFilter();
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

  // 联系客服：复制微信号
  copyContact: function() {
    wx.setClipboardData({
      data: 'CoffeeOrder-SaaS',
      success: function() {
        wx.showToast({ title: '微信号已复制', icon: 'none' });
      }
    });
  },

  // 关于本店：回到店铺欢迎页
  goStoreHome: function() {
    const sid = getStoreId();
    wx.navigateTo({ url: '/menu-pages/store-home' + (sid ? ('?storeId=' + sid) : '') });
  },

  goPrivacy: function() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  // 顾客端底部 Tab 切换
  onTabChange: function(e) {
    const tab = e.detail.tab;
    if (tab === 'menu') {
      wx.redirectTo({ url: '/menu-pages/menu-list' });
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
