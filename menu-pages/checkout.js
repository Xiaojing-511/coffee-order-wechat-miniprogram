const { formatPrice } = require('../utils/money.js');
const { cartKey, getStoreId } = require('../utils/storeContext.js');
const db = require('../utils/database.js');
const orderService = require('../utils/orderService.js');

Page({
  data: {
    items: [],
    totalQuantity: 0,
    totalAmount: 0,
    customerName: '',
    customerPhone: '',
    pickupTime: '尽快',
    pickupTimeOptions: ['尽快', '10分钟后', '20分钟后', '30分钟后', '45分钟后', '1小时后'],
    remark: '',
    submitting: false,
    storeNote: '',
    storeName: ''
  },

  onLoad: function() {
    this.loadCart();
    this.loadStore();
  },

  // 加载店铺取餐说明
  loadStore: async function() {
    const sid = getStoreId();
    if (!sid) return;
    try {
      const res = await db.query('stores', { storeId: sid }, { limit: 1 });
      if (res.success && res.data && res.data.length > 0) {
        this.setData({
          storeNote: res.data[0].pickupNote || '',
          storeName: res.data[0].storeName || ''
        });
      }
    } catch (err) {
      console.error('加载店铺信息失败:', err);
    }
  },

  loadCart: function() {
    const items = wx.getStorageSync(cartKey()) || [];
    let totalQuantity = 0;
    let totalAmount = 0;
    items.forEach(function(it) {
      const qty = it.quantity || 1;
      totalQuantity += qty;
      totalAmount += (it.price || 0) * qty;
    });
    if (items.length === 0) {
      wx.showToast({ title: '购物车是空的', icon: 'none' });
      setTimeout(function() {
        // 商家代客下单返回时保留商家模式标记
        const src = wx.getStorageSync('orderSource') === 'merchant' ? '?source=merchant' : '';
        wx.redirectTo({ url: '/menu-pages/menu-list' + src });
      }, 500);
      return;
    }
    this.setData({ items: items, totalQuantity: totalQuantity, totalAmount: totalAmount });
  },

  onNameInput: function(e) {
    this.setData({ customerName: e.detail.value });
  },
  onPhoneInput: function(e) {
    this.setData({ customerPhone: e.detail.value });
  },
  onRemarkInput: function(e) {
    this.setData({ remark: e.detail.value });
  },
  onPickupTimeChange: function(e) {
    const index = Number(e.detail.value);
    const options = this.data.pickupTimeOptions;
    if (options[index]) {
      this.setData({ pickupTime: options[index] });
    }
  },

  // 提交订单 → 模拟支付 → 跳转取餐码页
  submitOrder: async function() {
    if (this.data.submitting) return;
    const name = this.data.customerName.trim();
    if (!name) {
      wx.showToast({ title: '请填写取餐人姓名', icon: 'none' });
      return;
    }
    const phone = this.data.customerPhone.trim();
    if (phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交订单中...' });
    try {
      // 1. 创建订单（待支付）；商家代客下单标记 source
      const created = await orderService.createOrder({
        items: this.data.items,
        source: wx.getStorageSync('orderSource') || 'customer',
        customerName: name,
        customerPhone: phone,
        pickupTime: this.data.pickupTime,
        remark: this.data.remark.trim()
      });
      if (!created.success) {
        throw new Error(created.error || '下单失败');
      }

      // 2. 模拟支付 + 分配取餐码
      const paid = await orderService.mockPay(created._id);
      if (!paid.success) {
        throw new Error(paid.error || '支付失败');
      }

      // 3. 清空购物车 + 清除代客下单标记（商家模式通过 URL 传给成功页）
      const source = wx.getStorageSync('orderSource') === 'merchant' ? '&source=merchant' : '';
      wx.setStorageSync(cartKey(), []);
      wx.removeStorageSync('orderSource');

      wx.hideLoading();
      wx.redirectTo({
        url: '/menu-pages/order-success?id=' + created._id + source
      });
    } catch (err) {
      wx.hideLoading();
      console.error('下单失败:', err);
      wx.showToast({ title: err.message || '下单失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  formatPrice: function(cents) {
    return formatPrice(cents);
  }
});
