/**
 * 订单服务（云函数优先，云不可用时自动降级本地存储，便于开发预览）
 * 生产环境：部署 functions/order 后所有操作走云函数（白名单+金额校验）
 */
const db = require('./database.js');
const orderUtil = require('./order.js');
const money = require('./money.js');
const { getStoreId, cartKey } = require('./storeContext.js');
const { myStoreId } = require('./merchant.js');

/**
 * 调用 order 云函数；失败/未部署返回 null（由调用方降级）
 */
const callOrderFn = async (data) => {
  try {
    if (wx.cloud && wx.cloud.callFunction) {
      const res = await wx.cloud.callFunction({ name: 'order', data: data });
      return (res && res.result) || null;
    }
  } catch (err) {
    console.warn('[order] 云函数不可用，降级本地:', err);
  }
  return null;
};

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
  const storeId = getStoreId() || myStoreId();

  // 云函数优先（服务端按菜单价计算）
  const cloudRes = await callOrderFn({
    action: 'create',
    storeId: storeId,
    items: items,
    customerName: params.customerName || '',
    customerPhone: params.customerPhone || '',
    pickupTime: params.pickupTime || '',
    remark: params.remark || ''
  });
  if (cloudRes && cloudRes.success) return cloudRes;
  if (cloudRes && !cloudRes.success) {
    // 云函数已部署但业务失败（如售罄）
    return { success: false, error: cloudRes.error || '下单失败' };
  }

  // 降级：本地计算并写入
  const totalAmount = money.calcTotalCents(items);
  const totalQuantity = items.reduce((s, it) => s + it.quantity, 0);
  const order = {
    orderNo: orderUtil.generateOrderNo(),
    storeId: storeId,
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
 */
const mockPay = async (orderId) => {
  const cloudRes = await callOrderFn({ action: 'pay', orderId: orderId });
  if (cloudRes) {
    if (cloudRes.success) return { success: true, orderId: cloudRes.orderId, pickupCode: cloudRes.pickupCode };
    return { success: false, error: cloudRes.error || '支付失败' };
  }

  // 降级：本地
  const order = await getOrderById(orderId);
  if (!order) return { success: false, error: '订单不存在' };
  if (order.status !== orderUtil.ORDER_STATUS.PENDING) {
    return { success: false, error: '订单状态不允许支付' };
  }
  let seq = 0;
  const allRes = await db.query('orders', {}, {});
  if (allRes.success && allRes.data) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    seq = allRes.data.filter(o => o.status === 'paid' && o.paidTime && o.paidTime >= todayStart.getTime()).length;
  }
  const pickupCode = orderUtil.generatePickupCode(seq);
  const res = await db.update('orders', orderId, {
    status: orderUtil.ORDER_STATUS.PAID,
    paidTime: Date.now(),
    payMethod: 'mock',
    pickupCode: pickupCode
  });
  if (res.success) {
    return { success: true, orderId: orderId, pickupCode: pickupCode };
  }
  return { success: false, error: '支付失败' };
};

const getOrderById = async (orderId) => {
  const cloudRes = await callOrderFn({ action: 'get', orderId: orderId });
  if (cloudRes) {
    if (cloudRes.success && cloudRes.order) return cloudRes.order;
    return null;
  }
  const res = await db.query('orders', { _id: orderId });
  if (res.success && res.data && res.data.length > 0) return res.data[0];
  return null;
};

/**
 * 我的订单（按顾客身份过滤，时间倒序）
 */
const getMyOrders = async () => {
  const cloudRes = await callOrderFn({ action: 'myList' });
  if (cloudRes && cloudRes.success) return cloudRes.orders || [];
  const res = await db.query('orders', { openid: getCustomerId() }, {
    orderBy: { field: 'createTime', order: 'desc' }
  });
  return res.success ? (res.data || []) : [];
};

/**
 * 取消订单（仅待支付/待接单可取消）
 */
const cancelOrder = async (orderId) => {
  const cloudRes = await callOrderFn({ action: 'cancel', orderId: orderId });
  if (cloudRes) {
    return cloudRes.success ? { success: true } : { success: false, error: cloudRes.error || '取消失败' };
  }
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
 */
const reorder = async (orderId) => {
  const order = await getOrderById(orderId);
  if (!order || !order.items) return 0;
  wx.setStorageSync(cartKey(), order.items.map(it => Object.assign({}, it)));
  const count = order.items.reduce((s, it) => s + (it.quantity || 1), 0);
  return count;
};

// ===== 商家端 =====  

/**
 * 商家：本店订单列表（可带状态筛选）
 */
const merchantListOrders = async (status) => {
  const cloudRes = await callOrderFn({ action: 'merchantList', status: status || '' });
  if (cloudRes) {
    if (cloudRes.success) return { success: true, orders: cloudRes.orders || [] };
    return { success: false, error: cloudRes.error || '加载失败', code: cloudRes.code };
  }
  // 降级：本地
  const query = { storeId: myStoreId() };
  if (status) query.status = status;
  const res = await db.query('orders', query, { orderBy: { field: 'createTime', order: 'desc' } });
  return res.success ? { success: true, orders: res.data || [] } : { success: false, error: '加载失败' };
};

/**
 * 商家：更新订单状态（paid→accepted→ready→done / →cancelled）
 */
const merchantUpdateStatus = async (orderId, status) => {
  const cloudRes = await callOrderFn({ action: 'updateStatus', orderId: orderId, status: status });
  if (cloudRes) {
    return cloudRes.success ? { success: true } : { success: false, error: cloudRes.error || '更新失败', code: cloudRes.code };
  }
  // 降级：本地
  const order = await getOrderById(orderId);
  if (!order) return { success: false, error: '订单不存在' };
  if (!orderUtil.canTransition(order.status, status)) {
    return { success: false, error: '非法状态流转' };
  }
  const updateData = { status: status, updateTime: Date.now() };
  if (status === orderUtil.ORDER_STATUS.ACCEPTED) updateData.acceptedTime = Date.now();
  if (status === orderUtil.ORDER_STATUS.READY) updateData.readyTime = Date.now();
  if (status === orderUtil.ORDER_STATUS.DONE) updateData.doneTime = Date.now();
  const res = await db.update('orders', orderId, updateData);
  return res.success ? { success: true } : { success: false, error: '更新失败' };
};

module.exports = {
  getCustomerId,
  createOrder,
  mockPay,
  getOrderById,
  getMyOrders,
  cancelOrder,
  reorder,
  merchantListOrders,
  merchantUpdateStatus
};
