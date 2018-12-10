// operation数据库。

let _db;

function initDB (db) {
  _db = db
  /**
   * operation表， 记录axe的操作。
   * id : 自增主键
   * operation : 具体操作类型
   * time ： 发生时间，为时间戳 毫秒， 为了方便计算，这里以int类型存储，手动进行处理。
   * payload: 对于事件和路由中附带的数据， 存储的格式为序列化后的json字符串。
   * 以下是详细数据
   * route_url:  路由URL
   * data_key : dataCenter设置的 item的 键值
   * data_item : dataCenter 设置的 item 的值， 序列化后的json字符串。
   * event_name : 事件名称。
   */
  return db.run(`CREATE TABLE IF NOT EXISTS operation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation VARCHAR(50) NOT NULL,
    time INT(14) NOT NULL,
    payload TEXT,
    route_url VARCHAR(100),
    data_key VARCHAR(50),
    data_item TEXT,
    event_name VARCHAR(50)
  )`)
}

function saveOperation (operation) {
  // console.log(operation)
  return _db.run(`INSERT INTO operation VALUES (NULL, ? , ? , ? , ? , ? , ? , ? )`,
    [operation.operation, operation.time, JSON.stringify(operation.payload), operation.route_url,
      operation.data_key, JSON.stringify(operation.data_item), operation.event_name]).then(stmt => {
    return {
      id: stmt.lastID
    }
  })
}

function getRouteActions (routeInfo) {
  return _db.all(`SELECT * FROM operation WHERE operation = ? AND time > ? AND time < ? ORDER BY time DESC`,
    [routeInfo.type, routeInfo.startTime, routeInfo.endTime]).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        operation: row.operation,
        time: row.time,
        payload: row.payload,
        routeURL: row.route_url
      })
    })
    return list
  })
}

// 获取事件
function getEventActions (info) {
  let nameStatement = ''
  if (info.name) {
    nameStatement = ` AND event_name = "${info.name}" `
  }
  return _db.all(`SELECT * FROM operation WHERE time > ? AND time < ? ${nameStatement} ORDER BY time DESC`,
    [info.startTime, info.endTime]).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        operation: row.operation,
        time: row.time,
        payload: row.payload,
        eventName: row.event_name
      })
    })
    return list
  })
}

// 获取数据中心操作事件，type为 ： set , get 和 remove
function getDataCenterActions (info) {
  let keyStatement = ''
  if (info.dataKey) {
    keyStatement = ` AND data_key = "${info.dataKey}" `
  }
  return _db.all(`SELECT * FROM operation WHERE operation = ? AND time > ? AND time < ? ${keyStatement} ORDER BY time DESC`,
    [info.type, info.startTime, info.endTime]).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        operation: row.operation,
        time: row.time,
        dataKey: row.data_key,
        dataItem: row.data_item
      })
    })
    return list
  })
}

function getOperationLogs (startTime, endTime) {
  return _db.all(`SELECT * FROM operation WHERE  time > ? AND time < ? ORDER BY time ASC`,
    [startTime, endTime]).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        operation: row.operation,
        time: row.time,
        payload: row.payload,
        dataKey: row.data_key,
        dataItem: row.data_item,
        routeURL: row.route_url,
        eventName: row.event_name
      })
    })
    return list
  })
}

module.exports = {
  initDB: initDB,
  saveOperation: saveOperation,
  getRouteActions: getRouteActions,
  getEventActions: getEventActions,
  getDataCenterActions: getDataCenterActions,
  getOperationLogs: getOperationLogs
}
