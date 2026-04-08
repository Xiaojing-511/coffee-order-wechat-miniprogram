// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  // 获取用户的 openid
  const openid = wxContext.OPENID
  const appid = wxContext.APPID

  console.log('=== login 云函数调用 ===')
  console.log('用户 openid:', openid)
  console.log('用户 openid 类型:', typeof openid)
  console.log('用户 openid 长度:', openid ? openid.length : 'null')
  console.log('用户 appid:', appid)

  // // 管理员白名单
  // const ADMIN_OPENIDS = [
  //   "oCZJh3WBgr-C9IRK2udIW30FFWzo",
  //   "oCZJh3bTvykjmkDB6OB4k0YY7NnQ"
  // ]


  // // 检查是否为管理员
  // const isAdmin = ADMIN_OPENIDS.includes(openid)

  const isAdmin  = true

  // 直接返回，使用不同的字段名避免被微信框架过滤
  const result = {
    userOpenId: openid,
    isAdminStatus: isAdmin,
    isUserAdmin: isAdmin,
    adminFlag: isAdmin
  }

  console.log('准备返回的数据:', result)
  console.log('=== 函数结束 ===')

  return result
}
