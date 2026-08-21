const db = require('../../utils/database.js');
const { myStoreId } = require('../../utils/merchant.js');

Page({
  data: {
    storeId: '',
    form: {
      storeName: '',
      announcement: '',
      openTime: '',
      status: 'open',
      pickupNote: '',
      address: '',
      phone: ''
    },
    loading: true
  },

  onLoad: function() {
    const storeId = myStoreId();
    this.setData({ storeId: storeId });
    this.loadStore();
  },

  loadStore: async function() {
    try {
      const res = await db.query('stores', { storeId: this.data.storeId }, { limit: 1 });
      if (res.success && res.data && res.data.length > 0) {
        const s = res.data[0];
        this.setData({
          form: {
            storeName: s.storeName || '',
            announcement: s.announcement || '',
            openTime: s.openTime || '',
            status: s.status || 'open',
            pickupNote: s.pickupNote || '',
            address: s.address || '',
            phone: s.phone || ''
          }
        });
      }
    } catch (err) {
      console.error('加载店铺设置失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onStatusChange: function(e) {
    this.setData({ 'form.status': e.detail.value ? 'open' : 'closed' });
  },

  save: async function() {
    const form = this.data.form;
    if (!form.storeName.trim()) {
      wx.showToast({ title: '请填写店铺名称', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中...' });
    try {
      const storeId = this.data.storeId;
      const exist = await db.query('stores', { storeId: storeId }, { limit: 1 });
      let res;
      if (exist.success && exist.data && exist.data.length > 0) {
        res = await db.update('stores', exist.data[0]._id, Object.assign({}, form, { updateTime: Date.now() }));
      } else {
        res = await db.add('stores', Object.assign({}, form, { storeId: storeId, createTime: Date.now() }));
      }
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存店铺设置失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});
