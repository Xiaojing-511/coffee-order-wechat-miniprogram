const db = require('../../utils/database.js');
const { yuanToCents, centsToYuanText, formatPrice } = require('../../utils/money.js');
const { seedDemoData } = require('../../utils/seed.js');
const { myStoreId } = require('../../utils/merchant.js');

Page({
  data: {
    categories: [],
    drinkItems: [],
    categoryItemsMap: {}, // 按分类组织的饮品映射

    // 分类弹窗
    showCategoryModalFlag: false,
    categoryName: '',

    // 饮品弹窗
    showDrinkModalFlag: false,
    drinkName: '',
    drinkCalories: '',
    drinkDescription: '',
    selectedCategory: '',
    editingDrink: null,
    drinkImageUrl: '',  // 饮品图片URL
    drinkPrice: '',     // 饮品价格（元，输入框显示）
    drinkAvailable: true, // 是否在售
    isAdmin: true  // 控制管理员按钮显示
  },

  onLoad: function() {
    // 获取管理员状态
    // const app = getApp();
    // const isAdmin = app.checkIsAdmin();
    // this.setData({ isAdmin });

    this.loadCategories();
    this.loadDrinkItems();
  },

  onShow: function() {
    this.loadCategories();
    this.loadDrinkItems();
  },

  // 加载分类列表
  loadCategories: async function() {
    try {
      // 使用分页获取所有分类数据
      let allCategories = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('categories', { storeId: myStoreId() }, {
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
            // 防止无限循环
            if (skip > 500) {
              console.warn('已达到最大查询次数限制');
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

  // 加载饮品列表
  loadDrinkItems: async function() {
    try {
      // 使用分页获取所有饮品数据
      let allItems = [];
      let skip = 0;
      const limit = 20;  // 云数据库默认限制，多次查询获取所有数据
      let hasMore = true;

      while (hasMore) {
        const res = await db.query('drink_items', { storeId: myStoreId() }, {
          orderBy: { field: 'createTime', order: 'asc' },  // 按创建时间升序排序（最早的排第一）
          limit: limit,
          skip: skip
        });

        console.log(`第 ${Math.floor(skip/limit) + 1} 次查询，返回 ${res.data ? res.data.length : 0} 条数据`);

        if (res.success && res.data && res.data.length > 0) {
          allItems = allItems.concat(res.data);
          console.log(`累计已加载 ${allItems.length} 条饮品数据`);

          // 如果返回的数据少于limit，说明已经获取完所有数据
          if (res.data.length < limit) {
            hasMore = false;
            console.log('数据加载完成');
          } else {
            skip += limit;
            // 防止无限循环，设置最大查询次数
            if (skip > 1000) {
              console.warn('已达到最大查询次数限制');
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
          console.log('没有更多数据或查询失败');
        }
      }

      console.log(`总共加载了 ${allItems.length} 条饮品数据`);
      this.setData({ drinkItems: allItems });
      this.buildCategoryItemsMap(allItems);
    } catch (err) {
      console.error('加载饮品失败:', err);
    }
  },

  // 构建分类饮品映射
  buildCategoryItemsMap: function(drinkItems) {
    const categoryItemsMap = {};

    // 先为所有分类初始化空数组
    this.data.categories.forEach(category => {
      categoryItemsMap[category.name] = [];
    });

    // 确保未分类也有空数组
    categoryItemsMap['未分类'] = [];

    // 将饮品按分类分配
    drinkItems.forEach(item => {
      const category = item.category || '未分类';
      if (!categoryItemsMap[category]) {
        categoryItemsMap[category] = [];
      }
      categoryItemsMap[category].push(item);
    });

    console.log('分类饮品映射:', categoryItemsMap);
    this.setData({ categoryItemsMap });
  },

  // 显示分类弹窗
  showCategoryModal: function() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '只有管理员可以管理分类', icon: 'none' });
      return;
    }
    this.setData({
      showCategoryModalFlag: true,
      categoryName: ''
    });
  },

  // 关闭分类弹窗
  closeCategoryModal: function() {
    this.setData({
      showCategoryModalFlag: false,
      categoryName: ''
    });
  },

  // 输入分类名称
  onCategoryNameInput: function(e) {
    this.setData({ categoryName: e.detail.value });
  },

  // 添加分类
  addCategory: async function() {
    const { categoryName } = this.data;

    if (!categoryName.trim()) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '添加中...' });

    try {
      const res = await db.add('categories', {
        storeId: myStoreId(),
        name: categoryName.trim(),
        createTime: new Date().getTime()
      });

      wx.hideLoading();

      if (res.success) {
        this.closeCategoryModal();
        this.loadCategories();
        wx.showToast({ title: '添加成功', icon: 'success' });
      } else {
        wx.showToast({ title: '添加失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('添加分类失败:', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  // 删除分类
  deleteCategory: async function(e) {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '只有管理员可以管理分类', icon: 'none' });
      return;
    }
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个分类吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });

          try {
            const result = await db.remove('categories', id);
            wx.hideLoading();

            if (result.success) {
              this.loadCategories();
              wx.showToast({ title: '删除成功', icon: 'success' });
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('删除分类失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

   // 显示饮品弹窗
   showDrinkModal: function() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '只有管理员可以管理饮品', icon: 'none' });
      return;
    }
    this.setData({
      showDrinkModalFlag: true,
      editingDrink: null,
      drinkName: '',
      drinkCalories: '',
      drinkDescription: '',
      selectedCategory: '',
      drinkImageUrl: '',
      drinkPrice: '',
      drinkAvailable: true
    });
  },

  // 关闭饮品弹窗
  closeDrinkModal: function() {
    this.setData({
      showDrinkModalFlag: false,
      editingDrink: null,
      drinkName: '',
      drinkCalories: '',
      drinkDescription: '',
      selectedCategory: '',
      drinkImageUrl: '',
      drinkPrice: '',
      drinkAvailable: true
    });
  },


  // 编辑饮品
  editDrink: function(e) {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '只有管理员可以管理饮品', icon: 'none' });
      return;
    }
    const item = e.currentTarget.dataset.item;
    this.setData({
      showDrinkModalFlag: true,
      editingDrink: item,
      drinkName: item.name,
      drinkCalories: item.calories || '',
      drinkDescription: item.description || '',
      selectedCategory: item.category || '',
      drinkImageUrl: item.imageUrl || '',
      drinkPrice: item.price ? centsToYuanText(item.price) : '',
      drinkAvailable: item.available !== false
    });
  },

  // 输入饮品名称
  onDrinkNameInput: function(e) {
    this.setData({ drinkName: e.detail.value });
  },

  // 输入卡路里
  onDrinkCaloriesInput: function(e) {
    this.setData({ drinkCalories: e.detail.value });
  },

  // 输入价格（元）
  onDrinkPriceInput: function(e) {
    this.setData({ drinkPrice: e.detail.value });
  },

  // 售罄开关
  onDrinkAvailableChange: function(e) {
    this.setData({ drinkAvailable: e.detail.value });
  },

  // 输入饮品描述
  onDrinkDescriptionInput: function(e) {
    this.setData({ drinkDescription: e.detail.value });
  },

  // 选择分类
  onCategoryChange: function(e) {
    const index = e.detail.value;
    const category = this.data.categories[index];
    this.setData({ selectedCategory: category.name });
  },
  // 上传饮品图片
  chooseDrinkImage: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中...' });
        
        try {
          // 上传到云存储
          const cloudPath = `drink-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
          
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath
          });

          if (uploadRes.fileID) {
            this.setData({ drinkImageUrl: uploadRes.fileID });
            wx.hideLoading();
            wx.showToast({ title: '上传成功', icon: 'success' });
          } else {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('上传图片失败:', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.log('选择图片取消或失败', err);
      }
    });
  },

  // 删除饮品图片
  removeDrinkImage: function() {
    this.setData({ drinkImageUrl: '' });
  },

 // 添加/更新饮品
 addDrink: async function() {
  const { drinkName, drinkCalories, drinkDescription, selectedCategory, editingDrink, drinkImageUrl, drinkPrice, drinkAvailable } = this.data;

  if (!drinkName.trim()) {
    wx.showToast({ title: '请输入饮品名称', icon: 'none' });
    return;
  }

  wx.showLoading({ title: '保存中...' });

  try {
    const drinkData = {
      storeId: myStoreId(),
      name: drinkName.trim(),
      price: yuanToCents(drinkPrice),
      calories: drinkCalories ? parseFloat(drinkCalories) : 0,
      description: drinkDescription.trim(),
      category: selectedCategory,
      available: drinkAvailable,
      updateTime: new Date().getTime()
    };

    // 如果有图片，添加到数据中
    if (drinkImageUrl) {
      drinkData.imageUrl = drinkImageUrl;
    }

    let res;
    if (editingDrink) {
      // 更新饮品
      res = await db.update('drink_items', editingDrink._id, drinkData);
    } else {
      // 新增饮品
      drinkData.createTime = new Date().getTime();
      res = await db.add('drink_items', drinkData);
    }

    wx.hideLoading();

    if (res.success) {
      this.closeDrinkModal();
      this.loadDrinkItems();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  } catch (err) {
    wx.hideLoading();
    console.error('保存饮品失败:', err);
    wx.showToast({ title: '保存失败', icon: 'none' });
  }
},

  // 删除饮品
  deleteDrink: async function(e) {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '只有管理员可以管理饮品', icon: 'none' });
      return;
    }
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个饮品吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });

          try {
            const result = await db.remove('drink_items', id);
            wx.hideLoading();

            if (result.success) {
              this.loadDrinkItems();
              wx.showToast({ title: '删除成功', icon: 'success' });
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('删除饮品失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 金额格式化（供 WXML 使用）
  formatPrice: function(cents) {
    return formatPrice(cents);
  },

  // 导入演示数据
  seedDemo: async function() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '无权限', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '导入中...' });
    const res = await seedDemoData();
    wx.hideLoading();
    if (res.skipped) {
      wx.showToast({ title: '已有饮品数据，跳过导入', icon: 'none' });
    } else if (res.error) {
      wx.showToast({ title: '导入失败', icon: 'none' });
      console.error('[seed] 导入失败:', res.error);
    } else {
      wx.showToast({ title: '导入成功', icon: 'success' });
      this.loadCategories();
      this.loadDrinkItems();
    }
  },

  // 跳转隐私政策
  goToPrivacy: function() {
    wx.navigateTo({
      url: '/pages/privacy/privacy'
    });
  },

  // 跳转顾客饮品单
  goToMenu: function() {
    wx.redirectTo({
      url: '/menu-pages/menu-list'
    });
  }
});
