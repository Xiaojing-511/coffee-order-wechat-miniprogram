// 云函数：order
// 顾客：create / pay(模拟) / cancel / get / myList
// 商家：merchantList / updateStatus（白名单+到期校验）
// 金额以服务端从菜单读取为准（防止客户端篡改）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  ACCEPTED: 'accepted',
  READY: 'ready',
  DONE: 'done',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
}

const TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: ['done'],
  done: [],
  cancelled: [],
  refunded: []
}

const genOrderNo = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const base = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds())
  return base + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

const genPickupCode = (seq) => {
  const letters = 'ABCDEFGH'
  return letters[seq % letters.length] + String(Math.floor(seq / letters.length) + 1).padStart(2, '0')
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const db = cloud.database()
  const _ = db.command
  const action = event.action

  if (!openid) return { success: false, error: '无法获取用户身份' }

  // 商家白名单（含到期校验）
  const getMerchant = async () => {
    try {
      const res = await db.collection('merchants').where({ openid: openid }).limit(1).get()
      if (res.data && res.data.length > 0) {
        const m = res.data[0]
        const expired = (m.status === 'expired') || (m.expireTime && m.expireTime < Date.now())
        if (expired) return { _expired: true, storeId: m.storeId }
        return m
      }
    } catch (e) {
      console.error('查询商家白名单失败:', e)
    }
    return null
  }

  // 读取订单（带异常处理）
  const getOrder = async (orderId) => {
    try {
      const res = await db.collection('orders').doc(orderId).get()
      return res.data || null
    } catch (e) {
      return null
    }
  }

  switch (action) {
    // ===== 顾客：创建订单（服务端按菜单价计算金额） =====
    case 'create': {
      const { storeId, items, customerName, customerPhone, pickupTime, remark } = event
      if (!storeId || !Array.isArray(items) || items.length === 0) {
        return { success: false, error: '参数错误' }
      }
      const ids = items.map(i => i.id).filter(Boolean)
      if (ids.length === 0) return { success: false, error: '饮品参数错误' }

      // 读取菜单真实价格
      const drinkRes = await db.collection('drink_items').where({ _id: _.in(ids), storeId: storeId }).limit(50).get()
      const menu = {}
      ;(drinkRes.data || []).forEach(d => { menu[d._id] = d })

      let totalAmount = 0
      let totalQuantity = 0
      const orderItems = []
      for (const it of items) {
        const drink = menu[it.id]
        if (!drink) return { success: false, error: '饮品不存在' }
        if (drink.available === false) return { success: false, error: '饮品已售罄：' + drink.name }
        const qty = Math.max(1, parseInt(it.quantity, 10) || 1)
        const price = parseInt(drink.price, 10) || 0
        totalAmount += price * qty
        totalQuantity += qty
        orderItems.push({
          id: drink._id,
          key: it.key || (drink._id + '_' + orderItems.length),
          name: drink.name,
          price: price,
          quantity: qty,
          temperature: it.temperature || '冷',
          iceLevel: it.iceLevel || '正常冰',
          sugarLevel: it.sugarLevel || '正常糖',
          remark: it.remark || ''
        })
      }
      if (totalAmount <= 0) return { success: false, error: '订单金额异常' }

      const order = {
        storeId: storeId,
        orderNo: genOrderNo(),
        items: orderItems,
        totalQuantity: totalQuantity,
        totalAmount: totalAmount,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        pickupTime: pickupTime || '',
        remark: remark || '',
        status: STATUS.PENDING,
        payMethod: 'mock',
        openid: openid,
        createTime: Date.now()
      }
      const addRes = await db.collection('orders').add({ data: order })
      return { success: true, _id: addRes._id, order: Object.assign({}, order, { _id: addRes._id }) }
    }

    // ===== 顾客：模拟支付 =====
    case 'pay': {
      const { orderId } = event
      const order = await getOrder(orderId)
      if (!order) return { success: false, error: '订单不存在' }
      if (order.openid !== openid) return { success: false, error: '无权限' }
      if (order.status !== STATUS.PENDING) return { success: false, error: '订单状态不允许支付' }

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const cntRes = await db.collection('orders')
        .where({ storeId: order.storeId, status: STATUS.PAID, paidTime: _.gte(todayStart.getTime()) })
        .count()
      const code = genPickupCode(cntRes.total)

      await db.collection('orders').doc(orderId).update({ data: {
        status: STATUS.PAID,
        paidTime: Date.now(),
        payMethod: 'mock',
        pickupCode: code
      } })
      return { success: true, orderId: orderId, pickupCode: code }
    }

    // ===== 取消（顾客自己的订单 或 商家本店订单） =====
    case 'cancel': {
      const { orderId } = event
      const order = await getOrder(orderId)
      if (!order) return { success: false, error: '订单不存在' }
      const merchant = await getMerchant()
      const allowed = (order.openid === openid) || (merchant && !merchant._expired && merchant.storeId === order.storeId)
      if (!allowed) return { success: false, error: '无权限' }
      if ((TRANSITIONS[order.status] || []).indexOf(STATUS.CANCELLED) === -1) {
        return { success: false, error: '当前状态不可取消' }
      }
      await db.collection('orders').doc(orderId).update({ data: { status: STATUS.CANCELLED, cancelTime: Date.now() } })
      return { success: true }
    }

    // ===== 查询单笔（本人订单 或 商家本店订单） =====
    case 'get': {
      const { orderId } = event
      const order = await getOrder(orderId)
      if (!order) return { success: false, error: '订单不存在' }
      const merchant = await getMerchant()
      const allowed = (order.openid === openid) || (merchant && merchant.storeId === order.storeId)
      if (!allowed) return { success: false, error: '无权限' }
      return { success: true, order: order }
    }

    // ===== 顾客：我的订单 =====
    case 'myList': {
      const res = await db.collection('orders').where({ openid: openid }).orderBy('createTime', 'desc').limit(100).get()
      return { success: true, orders: res.data || [] }
    }

    // ===== 商家：本店订单列表 =====
    case 'merchantList': {
      const merchant = await getMerchant()
      if (!merchant) return { success: false, error: '无权限', code: 'not_merchant' }
      if (merchant._expired) return { success: false, error: '服务已到期，请联系平台续费', code: 'expired' }
      const where = { storeId: merchant.storeId }
      if (event.status && TRANSITIONS[event.status]) where.status = event.status
      const res = await db.collection('orders').where(where).orderBy('createTime', 'desc').limit(200).get()
      return { success: true, orders: res.data || [], storeId: merchant.storeId }
    }

    // ===== 商家：状态流转 =====  
    case 'updateStatus': {
      const merchant = await getMerchant()
      if (!merchant) return { success: false, error: '无权限', code: 'not_merchant' }
      if (merchant._expired) return { success: false, error: '服务已到期，请联系平台续费', code: 'expired' }
      const { orderId, status } = event
      const order = await getOrder(orderId)
      if (!order) return { success: false, error: '订单不存在' }
      if (order.storeId !== merchant.storeId) return { success: false, error: '无权限' }
      if ((TRANSITIONS[order.status] || []).indexOf(status) === -1) {
        return { success: false, error: '非法状态流转: ' + order.status + ' -> ' + status }
      }
      const updateData = { status: status, updateTime: Date.now() }
      if (status === STATUS.ACCEPTED) updateData.acceptedTime = Date.now()
      if (status === STATUS.READY) updateData.readyTime = Date.now()
      if (status === STATUS.DONE) updateData.doneTime = Date.now()
      await db.collection('orders').doc(orderId).update({ data: updateData })
      return { success: true }
    }

    default:
      return { success: false, error: 'unknown action: ' + action }
  }
}
