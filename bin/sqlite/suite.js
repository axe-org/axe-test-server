// suite : 一个设备的一次测试信息
let _db
function initDB (db) {
  _db = db
  /**
   * suite 一组测试，为一个设备的一次完整的测试信息
   * id : 自增主键
   * device_name ： 设备名称
   * platform_version 设备版本
   * udid：   设备号
   * model : 设备类型 ，真机型号或模拟器。
   * type ： 测试类型 debug release 和 profile. 如果是性能测试，则指向一个 profile表中的数据。
   * start_time : 开始时间。 当前系统中的时间都用时间戳表示，单位是毫秒。
   * end_time : 结束时间
   * duration : 耗时， 单位毫秒
   * features: 测试分组数量。
   * scenarios : 测试用例数量。
   * passedNumber: 通过的测试用例数量
   * status: 测试状态 ， TODO 说明 为 passed / failed / error / crashed 三种。 failed 为 asset的错误。 crashed 是崩溃导致的错误， 而error是其他异常，一般为找不到控件之类可以避免的错误。
   * profile : 性能测试类型。 性能测试的文件存储位置为 ./suite_id/profileName.trace
   */
  return _db.run(`CREATE TABLE IF NOT EXISTS suite (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name VARCHAR(50) NOT NULL,
    platform_version VARCHAR(50) NOT NULL,
    udid VARCHAR(80) NOT NULL,
    model VARCHAR(50),
    type VARCHAR(10) NOT NULL,
    start_time INT(14),
    end_time INT(14),
    duration INTEGER,
    features INTEGER,
    scenarios INTEGER,
    passed_number INTEGER,
    status VARCHAR(50),
    profile VARCHAR(50)
  )`)
}

/**
 * 创建一个suite , 返回值为 id.
 */
function createSuite (suiteInfo) {
  return _db.run(`INSERT INTO suite VALUES (NULL, ? , ? , ? , ? , ? , ? , NULL , NULL , NULL , NULL , NULL, NULL, ? )`,
    [suiteInfo.deviceName, suiteInfo.platformVersion, suiteInfo.udid, suiteInfo.model,
      suiteInfo.type, suiteInfo.starTime, suiteInfo.profile]).then(stmt => {
    return stmt.lastID
  })
}
// 结束后更新 suite信息
function updateSuite (suiteInfo) {
  return _db.run(`UPDATE suite SET status = ?, end_time = ? , duration = ? , features = ? , scenarios = ? ,passed_number = ?  WHERE id = ?`,
    [suiteInfo.status, suiteInfo.endTime, suiteInfo.duration, suiteInfo.features, suiteInfo.scenarios, suiteInfo.passedNumber , suiteInfo.suiteID])
}

// 获取全部测试信息。
function getAllSuites () {
  return _db.all(`SELECT * FROM suite`).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        deviceName: row.device_name,
        platformVersion: row.platform_version,
        udid: row.udid,
        model: row.model,
        type: row.type,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        features: row.features,
        scenarios: row.scenarios,
        passedNumber: row.passed_number,
        status: row.status,
        profile: row.profile
      })
    })
    return list
  })
}

function getSuite (suiteID) {
  return _db.get(`SELECT * FROM suite WHERE id = ?`, suiteID).then(row => {
    if (row) {
      return {
        id: row.id,
        deviceName: row.device_name,
        platformVersion: row.platform_version,
        udid: row.udid,
        model: row.model,
        type: row.type,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        features: row.features,
        scenarios: row.scenarios,
        passedNumber: row.passed_number,
        status: row.status,
        profile: row.profile
      }
    } else {
      throw new Error(`没有找到对应的suite 数据 ， id 为 ${suiteID}`)
    }
  })
}

module.exports = {
  initDB: initDB,
  createSuite: createSuite,
  updateSuite: updateSuite,
  getAllSuites: getAllSuites,
  getSuite: getSuite
}
