const { formatPrice } = require('../utils/money.js');
const { cartKey } = require('../utils/storeContext.js');

Page({
  data: {
    items: [],
    totalQuantity: 0,
    totalAmount: 0
  },

  onShow: function() {
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
    this.setData({ items: items, totalQuantity: totalQuantity, totalAmount: totalAmount });
  },

  saveCart: function(items) {
    wx.setStorageSync(cartKey(), items);
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
    wx.redirectTo({ url: '/menu-pages/menu-list' });
  },

  formatPrice: function(cents) {
    return formatPrice(cents);
  }
});
