const { formatPrice } = require('../utils/money.js');
const { cartKey } = require('../utils/storeContext.js');
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
    submitting: false
  },

  onLoad: function() {
    this.loadCart();
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
        wx.redirectTo({ url: '/menu-pages/menu-list' });
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
      // 1. 创建订单（待支付）
      const created = await orderService.createOrder({
        items: this.data.items,
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

      // 3. 清空购物车
      wx.setStorageSync(cartKey(), []);

      wx.hideLoading();
      wx.redirectTo({
        url: '/menu-pages/order-success?id=' + created._id
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
