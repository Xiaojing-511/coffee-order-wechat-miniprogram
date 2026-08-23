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
 * 解析页面 options 中的全部参数（小程序码 scene / 分享 query）
 * 返回合并后的参数对象，例如 { storeId: 'S1001', src: 'landing' }
 * 顶层 query 参数优先于 scene 内同名参数
 */
const parseSceneParams = (options) => {
  const params = {};
  if (!options) return params;
  Object.keys(options).forEach((k) => { params[k] = options[k]; });
  if (options.scene) {
    try {
      const scene = decodeURIComponent(options.scene);
      scene.split('&').forEach((pair) => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        if (idx > -1) params[pair.slice(0, idx)] = pair.slice(idx + 1);
        else params[pair] = '';
      });
    } catch (e) { /* 非法 scene 忽略 */ }
  }
  return params;
};

/**
 * 购物车存储 key：按店铺隔离
 */
const cartKey = (storeId) => {
  const sid = storeId || getStoreId();
  return sid ? ('cart_' + sid) : 'cart';
};

/**
 * 订单来源（customer 顾客下单 / merchant 商家代客下单）
 * 顾客入口会清除残留标记，避免串单
 */
const getOrderSource = () => wx.getStorageSync('orderSource') || '';

const setOrderSource = (src) => {
  if (src) wx.setStorageSync('orderSource', src);
  else wx.removeStorageSync('orderSource');
};

const clearOrderSource = () => wx.removeStorageSync('orderSource');

module.exports = {
  getStoreId, setStoreId, clearStoreId, parseStoreId, parseSceneParams, cartKey,
  getOrderSource, setOrderSource, clearOrderSource
};
