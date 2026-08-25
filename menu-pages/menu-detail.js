const db = require('../utils/database.js');
const { formatPrice } = require('../utils/money.js');
const { parseStoreId, setStoreId, getStoreId, cartKey, getOrderSource } = require('../utils/storeContext.js');
const { isMerchant } = require('../utils/merchant.js');

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
    cartTotalText: '¥0',
    merchantMode: false,
    // 规格选项
    temperatureOptions: ['冷', '热'],
    iceOptions: ['去冰', '少冰', '正常冰', '多冰'],
    sugarOptions: ['无糖', '少糖', '正常糖', '多糖']
  },

  onLoad: function(options) {
    // 商家代客下单模式：保留返回链路，不隐藏首页按钮
    const merchantMode = isMerchant() && getOrderSource() === 'merchant';
    this.setData({ merchantMode: merchantMode });
    if (!merchantMode) wx.hideHomeButton();
    // 店铺上下文兜底
    const sid = parseStoreId(options);
    if (sid) setStoreId(sid);
    // 优先从数据库加载数据
    if (options.id) {
      this.loadDrinkById(options.id);
    } else if (options.item) {
      try {
        const item = JSON.parse(decodeURIComponent(options.item));
        item.priceText = formatPrice(item.price);
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
    if (!this.data.merchantMode) {
      wx.hideHomeButton();
    }
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
        item.priceText = formatPrice(item.price);
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
    this.setData({ cartCount: count, cartTotal: total, cartTotalText: formatPrice(total) });
  },

  // 加入购物车（同规格合并数量）
  addToCart: function() {
    const item = this.data.item;
    if (!item) return;
    if (item.available === false) {
      wx.showToast({ title: '该饮品已售罄', icon: 'none' });
      return;
    }
    // 不校验价格：缺失/为 0 一律按 ¥0（免费）加购，避免「未定价」提示

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
        price: parseInt(item.price, 10) || 0,
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

  // 分享饮品给好友
  onShareAppMessage: function() {
    const item = this.data.item;
    const sid = getStoreId();
    return {
      title: (item && item.name ? item.name + ' · ' : '') + '扫码点单',
      path: '/menu-pages/menu-detail?id=' + (item ? item._id : '') + (sid ? ('&storeId=' + sid) : '')
    };
  },

  // 返回饮品单列表（商家代客下单时用 navigateBack 保留返回链路）
  goBack: function() {
    if (this.data.merchantMode) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.redirectTo({ url: '/menu-pages/menu-list' });
  }
});
