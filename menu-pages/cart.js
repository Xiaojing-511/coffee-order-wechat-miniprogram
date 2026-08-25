const { formatPrice } = require('../utils/money.js');
const { cartKey } = require('../utils/storeContext.js');

Page({
  data: {
    items: [],
    totalQuantity: 0,
    totalAmount: 0,
    totalAmountText: '¥0'
  },

  onShow: function() {
    this.loadCart();
  },

  loadCart: function() {
    const items = wx.getStorageSync(cartKey()) || [];
    let totalQuantity = 0;
    let totalAmount = 0;
    // 预格式化价格展示文本（直接绑定，避免模板方法调用不生效导致价格不显示）
    const viewItems = items.map(function(it) {
      const qty = it.quantity || 1;
      const price = it.price || 0;
      totalQuantity += qty;
      totalAmount += price * qty;
      return Object.assign({}, it, {
        priceText: formatPrice(price),
        subtotalText: formatPrice(price * qty)
      });
    });
    this.setData({
      items: viewItems,
      totalQuantity: totalQuantity,
      totalAmount: totalAmount,
      totalAmountText: formatPrice(totalAmount)
    });
  },

  saveCart: function(items) {
    // 去掉仅用于展示的格式化字段，保持购物车存储干净
    const clean = items.map(function(it) {
      const copy = Object.assign({}, it);
      delete copy.priceText;
      delete copy.subtotalText;
      return copy;
    });
    wx.setStorageSync(cartKey(), clean);
    this.loadCart();
  },

  increaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.items;
    items[index].quantity = (items[index].quantity || 1) + 1;
    this.saveCart(items);
  },

  decreaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.items;
    if ((items[index].quantity || 1) > 1) {
      items[index].quantity--;
    } else {
      items.splice(index, 1);
    }
    this.saveCart(items);
  },

  removeItem: function(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.items;
    const name = items[index].name || '';
    const that = this;
    wx.showModal({
      title: '移除商品',
      content: '确定移除「' + name + '」吗？',
      confirmColor: '#eb3349',
      success: function(res) {
        if (res.confirm) {
          items.splice(index, 1);
          that.saveCart(items);
        }
      }
    });
  },

  clearCart: function() {
    const that = this;
    wx.showModal({
      title: '清空购物车',
      content: '确定清空购物车吗？',
      confirmColor: '#eb3349',
      success: function(res) {
        if (res.confirm) {
          that.saveCart([]);
        }
      }
    });
  },

  goCheckout: function() {
    if (this.data.items.length === 0) {
      wx.showToast({ title: '购物车是空的', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/menu-pages/checkout' });
  },

  goShopping: function() {
    // 商家代客下单返回时保留商家模式标记
    const src = wx.getStorageSync('orderSource') === 'merchant' ? '?source=merchant' : '';
    wx.redirectTo({ url: '/menu-pages/menu-list' + src });
  },

  formatPrice: function(cents) {
    return formatPrice(cents);
  }
});
