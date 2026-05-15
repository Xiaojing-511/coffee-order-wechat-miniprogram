const db = require('../utils/database.js');

Page({
  data: {
    categories: [],
    drinkItems: [],
    categoryItemsMap: {},
    currentCategory: 'all',
    isAdmin: false
  },

  onLoad: function() {
    // 隐藏返回主页按钮
    wx.hideHomeButton();
    
    this.setData({ isAdmin: false });
    this.loadCategories();
    this.loadDrinkItems();
  },

  onShow: function() {
    // 每次显示页面都尝试隐藏返回按钮
    wx.hideHomeButton();
    
    this.loadCategories();
    this.loadDrinkItems();
  },

  loadCategories: async function() {
    try {
      let allCategories = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('categories', {}, {
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
        const res = await db.query('drink_items', {}, {
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
    } catch (err) {
      console.error('加载饮品失败:', err);
    }
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

  selectCategory: function(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category });
  },

  goToDetail: function(e) {
    const item = e.currentTarget.dataset.item;
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
