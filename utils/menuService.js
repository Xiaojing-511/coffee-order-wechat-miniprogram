/**
 * 菜单管理服务（商家端）：云函数优先，云不可用时降级本地（开发预览）
 */
const db = require('./database.js');
const { myStoreId } = require('./merchant.js');

const callMenuFn = async (data) => {
  try {
    if (wx.cloud && wx.cloud.callFunction) {
      const res = await wx.cloud.callFunction({ name: 'menu', data: data });
      return (res && res.result) || null;
    }
  } catch (err) {
    console.warn('[menu] 云函数不可用，降级本地:', err);
  }
  return null;
};

const fail = (cloudRes) => ({
  success: false,
  error: (cloudRes && cloudRes.error) || '操作失败',
  code: cloudRes && cloudRes.code
});

/**
 * 保存分类（新增或更新）
 */
const saveCategory = async (name, id) => {
  const cloudRes = await callMenuFn({ action: 'saveCategory', name: name, id: id || '' });
  if (cloudRes) {
    return cloudRes.success ? { success: true, _id: cloudRes._id } : fail(cloudRes);
  }
  if (id) {
    const res = await db.update('categories', id, { name: name, updateTime: Date.now() });
    return res.success ? { success: true } : { success: false, error: '更新失败' };
  }
  const res = await db.add('categories', { storeId: myStoreId(), name: name, createTime: Date.now() });
  return res.success ? { success: true, _id: res._id } : { success: false, error: '添加失败' };
};

const deleteCategory = async (id) => {
  const cloudRes = await callMenuFn({ action: 'deleteCategory', id: id });
  if (cloudRes) return cloudRes.success ? { success: true } : fail(cloudRes);
  const res = await db.remove('categories', id);
  return res.success ? { success: true } : { success: false, error: '删除失败' };
};

/**
 * 保存饮品（新增或更新）；price 为分（整数）
 */
const saveDrink = async (drinkData, id) => {
  const cloudRes = await callMenuFn(Object.assign({ action: 'saveDrink', id: id || '' }, drinkData));
  if (cloudRes) {
    return cloudRes.success ? { success: true, _id: cloudRes._id } : fail(cloudRes);
  }
  const data = Object.assign({}, drinkData, { updateTime: Date.now() });
  if (id) {
    const res = await db.update('drink_items', id, data);
    return res.success ? { success: true } : { success: false, error: '更新失败' };
  }
  data.storeId = myStoreId();
  data.createTime = Date.now();
  const res = await db.add('drink_items', data);
  return res.success ? { success: true, _id: res._id } : { success: false, error: '添加失败' };
};

const deleteDrink = async (id) => {
  const cloudRes = await callMenuFn({ action: 'deleteDrink', id: id });
  if (cloudRes) return cloudRes.success ? { success: true } : fail(cloudRes);
  const res = await db.remove('drink_items', id);
  return res.success ? { success: true } : { success: false, error: '删除失败' };
};

module.exports = { saveCategory, deleteCategory, saveDrink, deleteDrink };
