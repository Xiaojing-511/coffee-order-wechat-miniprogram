const db = require('../utils/database.js');
const { formatPrice } = require('../utils/money.js');
const { parseStoreId, parseSceneParams, setStoreId, getStoreId, cartKey, getOrderSource, setOrderSource, clearOrderSource } = require('../utils/storeContext.js');
const { isMerchant, myStoreId } = require('../utils/merchant.js');

// 分类默认 emoji（无图占位）
const CATEGORY_EMOJI = {
  '咖啡': '☕', '经典咖啡': '☕', '特调咖啡': '☕', '美式': '☕',
  '茶饮': '🧋', '奶茶': '🧋', '鲜果茶': '🍹', '果汁': '🍹',
  '甜品': '🍰', '蛋糕': '🍰', '面包': '🥐', '小食': '🍟'
};
const DEFAULT_EMOJI = '🥤';

// 快捷加购的默认规格（与详情页默认一致，同规格可合并）
const DEFAULT_SPEC = { temperature: '冷', iceLevel: '正常冰', sugarLevel: '正常糖' };

Page({
  data: {
    categories: [],
    allDrinkItems: [],      // 全量饮品（搜索过滤的原始数据）
    drinkItems: [],         // 当前展示（过滤后）
    categoryItemsMap: {},
    categoryCounts: {},
    totalCount: 0,
    currentCategory: 'all',
    isAdmin: false,
    cartCount: 0,
    cartTotal: 0,
    loading: true,
    keyword: '',
    merchantMode: false,    // 商家代客下单模式
    isLandingDemo: false,   // 官网落地页扫码体验
    store: {
      storeId: '',
      storeName: '青柠咖啡',
      announcement: '',
      openTime: '',
      pickupNote: '',
      status: 'open',
      address: '',
      phone: ''
    }
  },

  onLoad: function(options) {
    this.setData({ isAdmin: false, loading: true });

    // 解析店铺：小程序码/分享带 storeId；商家直接打开则用自家店铺
    const sid = parseStoreId(options);
    if (sid) {
      setStoreId(sid);
    } else if (isMerchant()) {
      setStoreId(myStoreId());
    }

    // 商家代客下单：仅当 source=merchant 进入才标记；
    // 其他入口一律清除 orderSource，避免残留标记把顾客端误判成商家模式（导致 Tab 被隐藏）
    if (options && options.source === 'merchant') {
      setOrderSource('merchant');
    } else {
      clearOrderSource();
    }
    const merchantMode = isMerchant() && getOrderSource() === 'merchant';
    this.setData({ merchantMode });
    if (!merchantMode) wx.hideHomeButton();

    // 官网落地页扫码体验标记（小程序码 scene: storeId=S1001&src=landing）
    const params = parseSceneParams(options);
    if (params.src === 'landing') {
      this.setData({ isLandingDemo: true });
    }

    this.loadStoreSettings();
    this.loadCategories();
    this.loadDrinkItems();
  },

  onShow: function() {
    if (!this.data.merchantMode) {
      wx.hideHomeButton();
    }

    if (!getStoreId()) {
      if (isMerchant()) setStoreId(myStoreId());
    }

    this.loadStoreSettings();
    this.loadCategories();
    this.loadDrinkItems();
    this.refreshCart();
  },

  loadCategories: async function() {
    try {
      let allCategories = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('categories', { storeId: getStoreId() }, {
          orderBy: { field: 'createTime', order: 'asc' },
          limit: limit,
          skip: skip
        });

        if (res.success && res.data && res.data.length > 0) {
          allCategories = allCategories.concat(res.data);

          if (res.data.length < limit) {
            hasMore = false;
          } else {
            skip += limit;
            if (skip > 500) {
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }
      }

      this.setData({ categories: allCategories });
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  },

  loadDrinkItems: async function() {
    try {
      let allItems = [];
      let skip = 0;
      const limit = 20;
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('drink_items', { storeId: getStoreId() }, {
          orderBy: { field: 'createTime', order: 'asc' },
          limit: limit,
          skip: skip
        });

        if (res.success && res.data && res.data.length > 0) {
          allItems = allItems.concat(res.data);

          if (res.data.length < limit) {
            hasMore = false;
          } else {
            skip += limit;
            if (skip > 1000) {
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }
      }

      this.setData({ allDrinkItems: allItems });
      this.applyFilter();
    } catch (err) {
      console.error('加载饮品失败:', err);
      this.setData({ loading: false });
    }
  },

  // 搜索过滤 + 重建分类映射
  applyFilter: function() {
    const kw = (this.data.keyword || '').trim().toLowerCase();
    const filtered = kw
      ? this.data.allDrinkItems.filter(function(it) {
          return (it.name || '').toLowerCase().indexOf(kw) > -1 ||
                 (it.description || '').toLowerCase().indexOf(kw) > -1;
        })
      : this.data.allDrinkItems;
    this.setData({ drinkItems: filtered, loading: false });
    this.buildCategoryItemsMap(filtered);
  },

  onSearchInput: function(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  onSearchClear: function() {
    this.setData({ keyword: '' });
    this.applyFilter();
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    const done = function() { wx.stopPullDownRefresh(); };
    Promise.all([
      this.loadStoreSettings(),
      this.loadCategories(),
      this.loadDrinkItems(),
      this.refreshCart()
    ]).then(done).catch(done);
  },

  // 分享店铺给顾客
  onShareAppMessage: function() {
    const sid = getStoreId();
    return {
      title: (this.data.store.storeName || '饮品') + ' · 扫码点单',
      path: '/menu-pages/menu-list?storeId=' + sid
    };
  },

  buildCategoryItemsMap: function(drinkItems) {
    const categoryItemsMap = {};
    const categoryCounts = {};

    this.data.categories.forEach(function(category) {
      categoryItemsMap[category.name] = [];
    });
    categoryItemsMap['未分类'] = [];

    drinkItems.forEach(function(item) {
      const category = item.category || '未分类';
      if (!categoryItemsMap[category]) {
        categoryItemsMap[category] = [];
      }
      categoryItemsMap[category].push(item);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    this.setData({
      categoryItemsMap: categoryItemsMap,
      categoryCounts: categoryCounts,
      totalCount: drinkItems.length
    });
  },

  loadStoreSettings: async function() {
    const sid = getStoreId();
    if (!sid) return;
    try {
      const res = await db.query('stores', { storeId: sid }, { limit: 1 });
      if (res.success && res.data && res.data.length > 0) {
        const s = res.data[0];
        this.setData({
          store: {
            storeId: s.storeId || sid,
            storeName: s.storeName || '欢迎光临',
            announcement: s.announcement || '',
            openTime: s.openTime || '',
            pickupNote: s.pickupNote || '',
            status: s.status || 'open',
            address: s.address || '',
            phone: s.phone || ''
          }
        });
      }
    } catch (err) {
      console.error('加载店铺信息失败:', err);
    }
  },

  // 金额格式化（供 WXML 使用）
  formatPrice: function(cents) {
    return formatPrice(cents);
  },

  // 饮品 emoji 占位
  itemEmoji: function(item) {
    if (!item) return DEFAULT_EMOJI;
    return CATEGORY_EMOJI[item.category] || DEFAULT_EMOJI;
  },

  // 购物车角标 + 总额
  refreshCart: function() {
    const cart = wx.getStorageSync(cartKey()) || [];
    let count = 0;
    let total = 0;
    cart.forEach(function(it) {
      count += it.quantity || 1;
      total += (it.price || 0) * (it.quantity || 1);
    });
    this.setData({ cartCount: count, cartTotal: total });
  },

  // 快捷加购（默认规格，同规格合并）
  quickAdd: function(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    if (item.available === false) {
      wx.showToast({ title: '该饮品已售罄', icon: 'none' });
      return;
    }
    // 不校验价格：缺失/为 0 一律按 ¥0（免费）加购，避免「未定价」提示

    const cart = wx.getStorageSync(cartKey()) || [];
    const sameIndex = cart.findIndex(function(it) {
      return it.id === item._id &&
        it.temperature === DEFAULT_SPEC.temperature &&
        it.iceLevel === DEFAULT_SPEC.iceLevel &&
        it.sugarLevel === DEFAULT_SPEC.sugarLevel;
    });

    if (sameIndex > -1) {
      cart[sameIndex].quantity += 1;
    } else {
      cart.push({
        id: item._id,
        key: item._id + '_' + DEFAULT_SPEC.temperature + '_' + DEFAULT_SPEC.iceLevel + '_' + DEFAULT_SPEC.sugarLevel,
        name: item.name,
        price: parseInt(item.price, 10) || 0,
        calories: item.calories || 0,
        quantity: 1,
        temperature: DEFAULT_SPEC.temperature,
        iceLevel: DEFAULT_SPEC.iceLevel,
        sugarLevel: DEFAULT_SPEC.sugarLevel,
        remark: ''
      });
    }
    wx.setStorageSync(cartKey(), cart);
    this.refreshCart();
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  goToCart: function() {
    wx.navigateTo({ url: '/menu-pages/cart' });
  },

  goToMyOrders: function() {
    wx.navigateTo({ url: '/menu-pages/my-orders' });
  },

  // 顾客端底部 Tab 切换
  onTabChange: function(e) {
    const tab = e.detail.tab;
    if (tab === 'mine') {
      wx.redirectTo({ url: '/menu-pages/my-orders' });
    }
  },

  // 商家代客下单：返回商家端订单页
  goMerchantHome: function() {
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  selectCategory: function(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category });
  },

  goToDetail: function(e) {
    const item = e.currentTarget.dataset.item;
    // 歇业状态禁止下单
    if (this.data.store.status === 'closed') {
      wx.showToast({ title: '店铺休息中，暂不可下单', icon: 'none' });
      return;
    }
    if (item._id) {
      // 传递ID，从数据库加载最新数据；商家代客下单用 navigateTo 保留返回链路
      const url = '/menu-pages/menu-detail?id=' + item._id;
      if (this.data.merchantMode) {
        wx.navigateTo({ url: url });
      } else {
        wx.redirectTo({ url: url });
      }
    } else {
      // 降级：传递整个对象
      const itemJson = encodeURIComponent(JSON.stringify(item));
      const url = '/menu-pages/menu-detail?item=' + itemJson;
      if (this.data.merchantMode) {
        wx.navigateTo({ url: url });
      } else {
        wx.redirectTo({ url: url });
      }
    }
  },

  goToPrivacy: function() {
    wx.redirectTo({
      url: '/pages/privacy/privacy'
    });
  }
});
