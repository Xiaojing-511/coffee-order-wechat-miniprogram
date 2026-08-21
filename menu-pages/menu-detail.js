const db = require('../utils/database.js');
const { formatPrice } = require('../utils/money.js');
const { parseStoreId, setStoreId, cartKey } = require('../utils/storeContext.js');

Page({
  data: {
    item: null,
    loading: true,
    quantity: 1,
    temperature: '冷',
    iceLevel: '正常冰',
    sugarLevel: '正常糖',
    cartCount: 0,
    cartTotal: 0,
    // 规格选项
    temperatureOptions: ['冷', '热'],
    iceOptions: ['去冰', '少冰', '正常冰', '多冰'],
    sugarOptions: ['无糖', '少糖', '正常糖', '多糖']
  },

  onLoad: function(options) {
    wx.hideHomeButton();
    // 店铺上下文兜底
    const sid = parseStoreId(options);
    if (sid) setStoreId(sid);
    // 优先从数据库加载数据
    if (options.id) {
      this.loadDrinkById(options.id);
    } else if (options.item) {
      try {
        const item = JSON.parse(decodeURIComponent(options.item));
        this.setData({ item: item, loading: false });
        wx.setNavigationBarTitle({ title: item.name || '饮品详情' });
      } catch (err) {
        console.error('解析饮品数据失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '数据加载失败', icon: 'none' });
      }
    } else {
      this.setData({ loading: false });
      wx.showToast({ title: '参数错误', icon: 'none' });
    }
  },

  onShow: function() {
    wx.hideHomeButton();
    this.refreshCart();
  },

  // 金额格式化
  formatPrice: function(cents) {
    return formatPrice(cents);
  },

  loadDrinkById: async function(id) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await db.query('drink_items', { _id: id });
      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0];
        this.setData({ item: item, loading: false });
        wx.setNavigationBarTitle({ title: item.name || '饮品详情' });
      } else {
        console.error('未找到饮品数据');
        wx.showToast({ title: '未找到该饮品', icon: 'none' });
      }
    } catch (err) {
      console.error('加载饮品失败:', err);
      wx.showToast({ title: '数据加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  previewImage: function() {
    const item = this.data.item;
    if (item && item.imageUrl) {
      wx.previewImage({ current: item.imageUrl, urls: [item.imageUrl] });
    }
  },

  // ===== 规格选择 =====
  selectTemperature: function(e) {
    this.setData({ temperature: e.currentTarget.dataset.value });
  },
  selectIceLevel: function(e) {
    this.setData({ iceLevel: e.currentTarget.dataset.value });
  },
  selectSugarLevel: function(e) {
    this.setData({ sugarLevel: e.currentTarget.dataset.value });
  },

  // ===== 数量 =====
  increaseQuantity: function() {
    this.setData({ quantity: this.data.quantity + 1 });
  },
  decreaseQuantity: function() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  // ===== 购物车 =====
  getCart: function() {
    return wx.getStorageSync(cartKey()) || [];
  },
  saveCart: function(cart) {
    wx.setStorageSync(cartKey(), cart);
    this.refreshCart();
  },
  refreshCart: function() {
    const cart = this.getCart();
    let count = 0;
    let total = 0;
    cart.forEach(function(it) {
      count += it.quantity || 1;
      total += (it.price || 0) * (it.quantity || 1);
    });
    this.setData({ cartCount: count, cartTotal: total });
  },

  // 加入购物车（同规格合并数量）
  addToCart: function() {
    const item = this.data.item;
    if (!item) return;
    if (item.available === false) {
      wx.showToast({ title: '该饮品已售罄', icon: 'none' });
      return;
    }
    if (!item.price) {
      wx.showToast({ title: '该饮品暂未定价', icon: 'none' });
      return;
    }

    const cart = this.getCart();
    const d = this.data;
    // 找同 id + 同规格的条目
    const sameIndex = cart.findIndex(function(it) {
      return it.id === item._id &&
        it.temperature === d.temperature &&
        it.iceLevel === d.iceLevel &&
        it.sugarLevel === d.sugarLevel;
    });

    if (sameIndex > -1) {
      cart[sameIndex].quantity += d.quantity;
    } else {
      cart.push({
        id: item._id,
        key: item._id + '_' + d.temperature + '_' + d.iceLevel + '_' + d.sugarLevel,
        name: item.name,
        price: item.price,
        calories: item.calories || 0,
        quantity: d.quantity,
        temperature: d.temperature,
        iceLevel: d.iceLevel,
        sugarLevel: d.sugarLevel,
        remark: ''
      });
    }
    this.saveCart(cart);
    wx.showToast({ title: '已加入购物车', icon: 'success' });
    // 加入后数量复位
    this.setData({ quantity: 1 });
  },

  // 去购物车
  goToCart: function() {
    wx.navigateTo({ url: '/menu-pages/cart' });
  },
  // 我的订单
  goToMyOrders: function() {
    wx.navigateTo({ url: '/menu-pages/my-orders' });
  },

  // 返回饮品单列表
  goBack: function() {
    wx.redirectTo({ url: '/menu-pages/menu-list' });
  }
});
