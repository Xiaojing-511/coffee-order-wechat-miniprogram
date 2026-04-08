/**
 * 数据库工具模块
 * 提供统一的数据库访问接口，支持云数据库和本地存储降级
 */

// 云开发环境配置
const ENV_ID = 'cloud1-7gjfr85i3b664708';
/**
 * 获取数据库实例
 */
const getDb = () => {
  if (!wx.cloud) {
    console.error('云开发未初始化');
    return null;
  }

  try {
    const db = wx.cloud.database({
      env: ENV_ID
    });
    return db;
  } catch (err) {
    console.error('获取数据库实例失败:', err);
    return null;
  }
};

/**
 * 查询数据
 * @param {string} collection - 集合名称
 * @param {object} query - 查询条件
 * @param {object} options - 查询选项（orderBy, skip, limit）
 */
const query = async (collection, query = {}, options = {}) => {
  const db = getDb();

  if (db) {
    // 使用云数据库
    try {
      console.log(`[云数据库] 查询集合: ${collection}, 环境ID: ${ENV_ID}`);
      console.log(`[云数据库] 查询条件:`, query);
      console.log(`[云数据库] 查询选项:`, options);

      let dbQuery = db.collection(collection).where(query);

      if (options.orderBy) {
        dbQuery = dbQuery.orderBy(options.orderBy.field, options.orderBy.order || 'desc');
        console.log(`[云数据库] 排序: ${options.orderBy.field} ${options.orderBy.order}`);
      }

      if (options.skip) {
        dbQuery = dbQuery.skip(options.skip);
        console.log(`[云数据库] 跳过: ${options.skip}`);
      }

      if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
        console.log(`[云数据库] 限制数量: ${options.limit}`);
      } else {
        // 如果没有指定limit，默认设置为100
        dbQuery = dbQuery.limit(100);
        console.log(`[云数据库] 使用默认限制: 100`);
      }

      const res = await dbQuery.get();

      console.log(`[云数据库] 查询成功，返回 ${res.data.length} 条数据`);
      console.log(`[云数据库] total: ${res.total}, errMsg: ${res.errMsg}`);

      return {
        success: true,
        data: res.data,
        source: 'cloud'
      };
    } catch (err) {
      console.error('[云数据库] 查询失败:', err);

      // 降级到本地存储
      console.log('[本地存储] 降级使用本地存储');
      return queryFromLocal(collection, query, options);
    }
  } else {
    // 降级到本地存储
    console.log('[本地存储] 云数据库不可用，使用本地存储');
    return queryFromLocal(collection, query, options);
  }
};

/**
 * 从本地存储查询数据
 */
const queryFromLocal = (collection, query, options) => {
  const data = wx.getStorageSync(collection) || [];
  let result = data;
  
  // 简单的本地筛选
  if (Object.keys(query).length > 0) {
    result = data.filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }
  
  // 排序
  if (options.orderBy) {
    const { field, order = 'desc' } = options.orderBy;
    result.sort((a, b) => {
      if (order === 'desc') {
        return (b[field] || 0) - (a[field] || 0);
      } else {
        return (a[field] || 0) - (b[field] || 0);
      }
    });
  }
  
  // 跳过
  if (options.skip) {
    result = result.slice(options.skip);
  }
  
  // 限制数量
  if (options.limit) {
    result = result.slice(0, options.limit);
  }
  
  return {
    success: true,
    data: result,
    source: 'local'
  };
};

/**
 * 添加数据
 * @param {string} collection - 集合名称
 * @param {object} data - 要添加的数据
 */
const add = async (collection, data) => {
  const db = getDb();
  
  if (db) {
    // 使用云数据库
    try {
      console.log(`[云数据库] 添加数据到集合: ${collection}`);
      
      const res = await db.collection(collection).add({
        data: data
      });
      
      console.log('[云数据库] 添加成功');
      
      return {
        success: true,
        _id: res._id,
        source: 'cloud'
      };
    } catch (err) {
      console.error('[云数据库] 添加失败:', err);
      
      // 降级到本地存储
      return addToLocal(collection, data);
    }
  } else {
    // 降级到本地存储
    return addToLocal(collection, data);
  }
};

/**
 * 添加数据到本地存储
 */
const addToLocal = (collection, data) => {
  const items = wx.getStorageSync(collection) || [];
  
  // 生成临时ID
  const newItem = {
    ...data,
    _id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    _createTime: new Date().getTime()
  };
  
  items.push(newItem);
  wx.setStorageSync(collection, items);
  
  console.log('[本地存储] 添加成功');
  
  return {
    success: true,
    _id: newItem._id,
    source: 'local'
  };
};

/**
 * 更新数据
 * @param {string} collection - 集合名称
 * @param {string} id - 记录ID
 * @param {object} data - 要更新的数据
 */
const update = async (collection, id, data) => {
  const db = getDb();
  
  if (db) {
    // 使用云数据库
    try {
      console.log(`[云数据库] 更新集合 ${collection} 中的记录: ${id}`);
      
      await db.collection(collection).doc(id).update({
        data: data
      });
      
      console.log('[云数据库] 更新成功');
      
      return {
        success: true,
        source: 'cloud'
      };
    } catch (err) {
      console.error('[云数据库] 更新失败:', err);
      
      // 降级到本地存储
      return updateLocal(collection, id, data);
    }
  } else {
    // 降级到本地存储
    return updateLocal(collection, id, data);
  }
};

/**
 * 更新本地存储中的数据
 */
const updateLocal = (collection, id, data) => {
  const items = wx.getStorageSync(collection) || [];
  const index = items.findIndex(item => item._id === id);
  
  if (index > -1) {
    items[index] = {
      ...items[index],
      ...data,
      _updateTime: new Date().getTime()
    };
    wx.setStorageSync(collection, items);
    
    console.log('[本地存储] 更新成功');
    
    return {
      success: true,
      source: 'local'
    };
  } else {
    return {
      success: false,
      error: '记录不存在',
      source: 'local'
    };
  }
};

/**
 * 删除数据
 * @param {string} collection - 集合名称
 * @param {string} id - 记录ID
 */
const remove = async (collection, id) => {
  const db = getDb();
  
  if (db) {
    // 使用云数据库
    try {
      console.log(`[云数据库] 删除集合 ${collection} 中的记录: ${id}`);
      
      await db.collection(collection).doc(id).remove();
      
      console.log('[云数据库] 删除成功');
      
      return {
        success: true,
        source: 'cloud'
      };
    } catch (err) {
      console.error('[云数据库] 删除失败:', err);
      
      // 降级到本地存储
      return removeLocal(collection, id);
    }
  } else {
    // 降级到本地存储
    return removeLocal(collection, id);
  }
};

/**
 * 从本地存储删除数据
 */
const removeLocal = (collection, id) => {
  const items = wx.getStorageSync(collection) || [];
  const index = items.findIndex(item => item._id === id);
  
  if (index > -1) {
    items.splice(index, 1);
    wx.setStorageSync(collection, items);
    
    console.log('[本地存储] 删除成功');
    
    return {
      success: true,
      source: 'local'
    };
  } else {
    return {
      success: false,
      error: '记录不存在',
      source: 'local'
    };
  }
};

/**
 * 统计记录数
 * @param {string} collection - 集合名称
 * @param {object} query - 查询条件
 */
const count = async (collection, query = {}) => {
  const db = getDb();

  if (db) {
    try {
      const res = await db.collection(collection).where(query).count();
      return {
        success: true,
        total: res.total,
        source: 'cloud'
      };
    } catch (err) {
      console.error('[云数据库] 统计失败:', err);

      // 降级到本地存储
      const data = queryFromLocal(collection, query, {});
      return {
        success: true,
        total: data.data.length,
        source: 'local'
      };
    }
  } else {
    const data = queryFromLocal(collection, query, {});
    return {
      success: true,
      total: data.data.length,
      source: 'local'
    };
  }
};

/**
 * 批量删除数据（删除满足条件的所有记录）
 * @param {string} collection - 集合名称
 * @param {object} query - 查询条件
 */
const removeAll = async (collection, query = {}) => {
  const db = getDb();

  if (db) {
    // 使用云数据库
    try {
      console.log(`[云数据库] 批量删除集合: ${collection}, 查询条件:`, query);

      // 先查询所有符合条件的记录
      const res = await db.collection(collection).where(query).get();
      const records = res.data || [];

      console.log(`[云数据库] 查询到 ${records.length} 条待删除记录`);

      // 逐条删除
      let removedCount = 0;
      for (const record of records) {
        try {
          await db.collection(collection).doc(record._id).remove();
          removedCount++;
          console.log(`[云数据库] 删除记录: ${record._id}`);
        } catch (err) {
          console.error(`[云数据库] 删除记录 ${record._id} 失败:`, err);
        }
      }

      console.log(`[云数据库] 批量删除成功，共删除 ${removedCount} 条记录`);

      return {
        success: true,
        removed: removedCount,
        source: 'cloud'
      };
    } catch (err) {
      console.error('[云数据库] 批量删除失败:', err);

      // 降级到本地存储
      return removeAllLocal(collection, query);
    }
  } else {
    // 降级到本地存储
    return removeAllLocal(collection, query);
  }
};

/**
 * 从本地存储批量删除数据
 */
const removeAllLocal = (collection, query = {}) => {
  const data = wx.getStorageSync(collection) || [];
  const originalLength = data.length;

  // 简单的本地筛选
  const filtered = data.filter(item => {
    // 如果查询条件为空，删除所有记录
    if (Object.keys(query).length === 0) {
      return false;
    }
    // 否则只删除满足条件的记录
    return !Object.keys(query).every(key => item[key] === query[key]);
  });

  const removedCount = originalLength - filtered.length;
  wx.setStorageSync(collection, filtered);

  console.log(`[本地存储] 批量删除成功，删除 ${removedCount} 条记录`);

  return {
    success: true,
    removed: removedCount,
    source: 'local'
  };
};

module.exports = {
  getDb,
  query,
  add,
  update,
  remove,
  count,
  removeAll,
  ENV_ID
};
