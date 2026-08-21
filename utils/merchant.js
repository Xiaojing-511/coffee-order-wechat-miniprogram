/**
 * 商家（店主）状态工具
 * 商家身份来源：login 云函数返回（云环境）或本地降级（开发预览）
 */

const DEFAULT_STORE_ID = 'S1001'; // 本地降级默认店铺

const getMerchantInfo = () => {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.merchant) return app.globalData.merchant;
  } catch (e) { /* 忽略 */ }
  return wx.getStorageSync('merchantInfo') || null;
};

const isMerchant = () => {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.isMerchant !== undefined) return app.globalData.isMerchant;
  } catch (e) { /* 忽略 */ }
  return wx.getStorageSync('isMerchant') === true;
};

/**
 * 服务是否有效（未过期）
 */
const hasValidService = () => {
  const m = getMerchantInfo();
  if (!m) return false;
  if (m.status === 'expired') return false;
  if (m.expireTime && m.expireTime < Date.now()) return false;
  return true;
};

/**
 * 商家自己的店铺 ID（无则用默认）
 */
const myStoreId = () => {
  const m = getMerchantInfo();
  return (m && m.storeId) || wx.getStorageSync('storeId') || DEFAULT_STORE_ID;
};

module.exports = { getMerchantInfo, isMerchant, hasValidService, myStoreId, DEFAULT_STORE_ID };
