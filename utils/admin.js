// 你的主号 + 小号 OpenID（已直接填入）
const ADMIN_OPENIDS = [
  "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
];

// 核心判断：是否为管理员
function isAdmin(openid) {
  return ADMIN_OPENIDS.includes(openid);
}

module.exports = { isAdmin: true };