/**
 * 订单工具模块：状态常量、订单号、取餐码
 */

// 订单状态机
const ORDER_STATUS = {
  PENDING: 'pending',      // 待支付
  PAID: 'paid',            // 已支付/待接单
  ACCEPTED: 'accepted',    // 已接单/制作中
  READY: 'ready',          // 待取餐
  DONE: 'done',            // 已完成（核销）
  CANCELLED: 'cancelled',  // 已取消
  REFUNDED: 'refunded'     // 已退款
};

// 状态中文文案
const ORDER_STATUS_TEXT = {
  pending: '待支付',
  paid: '待接单',
  accepted: '制作中',
  ready: '待取餐',
  done: '已完成',
  cancelled: '已取消',
  refunded: '已退款'
};

// 状态流转白名单（云函数校验用）
const ALLOWED_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: ['done'],
  done: [],
  cancelled: [],
  refunded: []
};

const canTransition = (from, to) => {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
};

/**
 * 生成订单号：yyyyMMddHHmmss + 4位随机数
 */
const generateOrderNo = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const base = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return base + rand;
};

/**
 * 生成取餐码：如 A01, B02 ...（按序号循环字母）
 */
const generatePickupCode = (seq) => {
  const letters = 'ABCDEFGH';
  const letter = letters[seq % letters.length];
  const num = String(Math.floor(seq / letters.length) + 1).padStart(2, '0');
  return letter + num;
};

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_TEXT,
  ALLOWED_TRANSITIONS,
  canTransition,
  generateOrderNo,
  generatePickupCode
};
