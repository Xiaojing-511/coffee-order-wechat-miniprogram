/**
 * 店铺上下文：当前顾客正在浏览/点单的店铺（多租户核心）
 */

const STORE_KEY = 'currentStoreId';

const getStoreId = () => wx.getStorageSync(STORE_KEY) || '';

const setStoreId = (id) => {
  if (id) wx.setStorageSync(STORE_KEY, id);
};

const clearStoreId = () => wx.removeStorageSync(STORE_KEY);

/**
 * 从页面 options 解析店铺 ID
 * 支持：分享链接 query（storeId=xxx）与小程序码 scene（storeId=xxx 或直接 xxx）
 */
const parseStoreId = (options) => {
  if (!options) return '';
  if (options.storeId) return options.storeId;
  if (options.scene) {
    try {
      const scene = decodeURIComponent(options.scene);
      const m = scene.match(/storeId=([^&]+)/);
      return m ? m[1] : scene;
    } catch (e) {
      return '';
    }
  }
  return '';
};

/**
 * 购物车存储 key：按店铺隔离
 */
const cartKey = (storeId) => {
  const sid = storeId || getStoreId();
  return sid ? ('cart_' + sid) : 'cart';
};

module.exports = { getStoreId, setStoreId, clearStoreId, parseStoreId, cartKey };
