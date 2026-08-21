/*
 * 金额工具模块
 * 所有价格统一以「分」为单位的整数存储，避免浮点误差
 */

/**
 * 元（字符串/数字）→ 分
 */
const yuanToCents = (yuan) => {
  const num = parseFloat(yuan);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
};

/**
 * 分 → 展示字符串（去掉多余小数 0）
 * 例如 ¥12 / ¥12.5 / ¥12.55
 */
const formatPrice = (cents) => {
  const n = parseInt(cents, 10);
  if (isNaN(n) || n <= 0) return '¥0';
  const yuan = n / 100;
  let text = String(yuan);
  if (text.indexOf('.') > -1) {
    text = text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  return '¥' + text;
};

/**
 * 分 → 数字字符串（无 ¥ 符号，供输入框回显）
 */
const centsToYuanText = (cents) => {
  const n = parseInt(cents, 10);
  if (isNaN(n)) return '';
  return String(n / 100);
};

/**
 * 计算总金额（分）
 */
const calcTotalCents = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const price = parseInt(it.price, 10) || 0;
    const qty = parseInt(it.quantity, 10) || 0;
    return sum + price * qty;
  }, 0);
};

module.exports = { yuanToCents, formatPrice, centsToYuanText, calcTotalCents };
