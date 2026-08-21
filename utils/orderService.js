/**
 * 顾客端订单服务
 * 本期：客户端直连云数据库（utils/database.js 自动降级本地存储）
 * 下期：接入真实微信支付时，下单/支付改走云函数以保证金额安全
 */
const db = require('./database.js');
const orderUtil = require('./order.js');
const money = require('./money.js');

/**
 * 顾客身份：优先 openid（云开发登录），否则用本地设备ID（模拟环境）
 */
const getCustomerId = () => {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.openid) {
      return app.globalData.openid;
    }
  } catch (e) { /* 忽略 */ }
  let deviceId = wx.getStorageSync('deviceId');
  if (!deviceId) {
    deviceId = 'dev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    wx.setStorageSync('deviceId', deviceId);
  }
  return deviceId;
};

/**
 * 创建订单（状态：待支付）
 * @param {object} params { items, customerName, customerPhone, pickupTime, remark }
 */
const createOrder = async (params) => {
  const items = (params.items || []).map((it, idx) => ({
    id: it.id || '',
    key: it.key || (it.id + '_' + idx),
    name: it.name || '',
    price: parseInt(it.price, 10) || 0,
    quantity: parseInt(it.quantity, 10) || 1,
    temperature: it.temperature || '冷',
    iceLevel: it.iceLevel || '正常冰',
    sugarLevel: it.sugarLevel || '正常糖',
    remark: it.remark || ''
  }));
  if (items.length === 0) return { success: false, error: '购物车为空' };

  const totalAmount = money.calcTotalCents(items);
  const totalQuantity = items.reduce((s, it) => s + it.quantity, 0);
  const order = {
    orderNo: orderUtil.generateOrderNo(),
    items: items,
    totalQuantity: totalQuantity,
    totalAmount: totalAmount,
    customerName: params.customerName || '',
    customerPhone: params.customerPhone || '',
    pickupTime: params.pickupTime || '',
    remark: params.remark || '',
    status: orderUtil.ORDER_STATUS.PENDING,
    payMethod: 'mock',
    openid: getCustomerId(),
    createTime: Date.now()
  };
  const res = await db.add('orders', order);
  if (res.success) {
    return { success: true, _id: res._id, order: Object.assign({}, order, { _id: res._id }) };
  }
  return { success: false, error: res.error || '下单失败' };
};

/**
 * 模拟支付：pending -> paid，并分配取餐码
 * @param {string} orderId
 * @returns {Promise<{success:boolean, order?:object, pickupCode?:string}>}
 */
const mockPay = async (orderId) => {
  const order = await getOrderById(orderId);
  if (!order) return { success: false, error: '订单不存在' };
  if (order.status !== orderUtil.ORDER_STATUS.PENDING) {
    return { success: false, error: '订单状态不允许支付' };
  }
  // 分配取餐码：以当天已存在订单数作为序号
  let seq = 0;
  const allRes = await db.query('orders', {}, {});
  if (allRes.success && allRes.data) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    seq = allRes.data.filter(o => o.createTime && o.createTime >= todayStart.getTime()).length;
  }
  const pickupCode = orderUtil.generatePickupCode(seq);
  const res = await db.update('orders', orderId, {
    status: orderUtil.ORDER_STATUS.PAID,
    paidTime: Date.now(),
    payMethod: 'mock',
    pickupCode: pickupCode
  });
  if (res.success) {
    return { success: true, order: Object.assign({}, order, { status: orderUtil.ORDER_STATUS.PAID, pickupCode: pickupCode }), pickupCode: pickupCode };
  }
  return { success: false, error: '支付失败' };
};

const getOrderById = async (orderId) => {
  const res = await db.query('orders', { _id: orderId });
  if (res.success && res.data && res.data.length > 0) return res.data[0];
  return null;
};

/**
 * 我的订单（按顾客身份过滤，时间倒序）
 */
const getMyOrders = async () => {
  const res = await db.query('orders', { openid: getCustomerId() }, {
    orderBy: { field: 'createTime', order: 'desc' }
  });
  return res.success ? (res.data || []) : [];
};

/**
 * 取消订单（仅待支付/待接单可取消）
 */
const cancelOrder = async (orderId) => {
  const order = await getOrderById(orderId);
  if (!order) return { success: false, error: '订单不存在' };
  if (!orderUtil.canTransition(order.status, orderUtil.ORDER_STATUS.CANCELLED)) {
    return { success: false, error: '当前状态不可取消' };
  }
  const res = await db.update('orders', orderId, {
    status: orderUtil.ORDER_STATUS.CANCELLED,
    cancelTime: Date.now()
  });
  return res.success ? { success: true } : { success: false, error: '取消失败' };
};

/**
 * 再来一单：把某订单的 items 作为新的购物车
 * @returns {Promise<number>} 购物车数量
 */
const reorder = async (orderId) => {
  const order = await getOrderById(orderId);
  if (!order || !order.items) return 0;
  wx.setStorageSync('cart', order.items.map(it => Object.assign({}, it)));
  const count = order.items.reduce((s, it) => s + (it.quantity || 1), 0);
  return count;
};

module.exports = {
  getCustomerId,
  createOrder,
  mockPay,
  getOrderById,
  getMyOrders,
  cancelOrder,
  reorder
};
