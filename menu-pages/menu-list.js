const db = require('../utils/database.js');
const { formatPrice } = require('../utils/money.js');
const { parseStoreId, setStoreId, getStoreId } = require('../utils/storeContext.js');
const { isMerchant, myStoreId } = require('../utils/merchant.js');

Page({
  data: {
    categories: [],
    drinkItems: [],
    categoryItemsMap: {},
    currentCategory: 'all',
    isAdmin: false,
    cartCount: 0,
    loading: true,
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
    // 隐藏返回主页按钮
    wx.hideHomeButton();
    this.setData({ isAdmin: false, loading: true });

    // 解析店铺：小程序码/分享带 storeId；商家直接打开则用自家店铺
    const sid = parseStoreId(options);
    if (sid) {
      setStoreId(sid);
    } else if (isMerchant()) {
      setStoreId(myStoreId());
    }

    // 商家前台点单（代客下单）标记
    if (options && options.source === 'merchant') {
      wx.setStorageSync('orderSource', 'merchant');
    }

    this.loadStoreSettings();
    this.loadCategories();
    this.loadDrinkItems();
  },

  onShow: function() {
    // 每次显示页面都尝试隐藏返回按钮
    wx.hideHomeButton();

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

      this.setData({ drinkItems: allItems });
      this.buildCategoryItemsMap(allItems);
      this.setData({ loading: false });
    } catch (err) {
      console.error('加载饮品失败:', err);
      this.setData({ loading: false });
    }
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

    this.data.categories.forEach(category => {
      categoryItemsMap[category.name] = [];
    });

    categoryItemsMap['未分类'] = [];

    drinkItems.forEach(item => {
      const category = item.category || '未分类';
      if (!categoryItemsMap[category]) {
        categoryItemsMap[category] = [];
      }
      categoryItemsMap[category].push(item);
    });

    this.setData({ categoryItemsMap });
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

  // 购物车角标
  refreshCart: function() {
    const cart = wx.getStorageSync('cart') || [];
    let count = 0;
    cart.forEach(function(it) { count += it.quantity || 1; });
    this.setData({ cartCount: count });
  },

  goToCart: function() {
    wx.navigateTo({ url: '/menu-pages/cart' });
  },

  goToMyOrders: function() {
    wx.navigateTo({ url: '/menu-pages/my-orders' });
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
      // 传递ID，从数据库加载最新数据，使用 redirectTo 禁止返回
      wx.redirectTo({
        url: `/menu-pages/menu-detail?id=${item._id}`
      });
    } else {
      // 降级：传递整个对象
      const itemJson = encodeURIComponent(JSON.stringify(item));
      wx.redirectTo({
        url: `/menu-pages/menu-detail?item=${itemJson}`
      });
    }
  },

  goToPrivacy: function() {
    wx.redirectTo({
      url: '/pages/privacy/privacy'
    });
  }
});
