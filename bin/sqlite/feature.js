// feature : 一个测试文件中的测试, 对应mocha中的一个describe
let _db
function initDB (db) {
  _db = db
  /**
     * feature 对应mocha中的一次 describe .建议一个文件使用一个describe , 是测试用例的集合。
     * id : 自增主键。
     * suite_id : 对应suite的ID， 设置外健
     * title : 标题
     * scenarios : scenarios 的数量， 测试用例的数量。
     * status : 状态 ， passed / failed / error / crashed / skipped 当前面有测试错误时，后面的用例都会被跳过。
     * start_time : 开始时间
     * end_time : 结束时间
     * duration : 时长。开始时间和结束时间可能不够精确， 但是这个时长是比较精确的。 单位毫秒
     */
  return _db.run(`CREATE TABLE IF NOT EXISTS feature (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suite_id INTEGER NOT NULL,
      title VARCHAR(100) NOT NULL,
      scenarios INTEGER,
      status VARCHAR(50),
      start_time INT(14),
      end_time INT(14),
      duration INTEGER,
      FOREIGN KEY(suite_id) REFERENCES suite(id) ON DELETE CASCADE
      )`)
}

/**
 * 创建一个feature , 返回值为 id.
 */
function createFeature (featureInfo) {
  return _db.run(`INSERT INTO feature VALUES (NULL, ? , ? , ? , ? , ? , ? , ?)`,
    [featureInfo.suiteID, featureInfo.title, featureInfo.scenarios, featureInfo.status,
      featureInfo.startTime, featureInfo.endTime, featureInfo.duration]).then(stmt => {
    return stmt.lastID
  })
}

function updateFeature (featureInfo) {
  // console.log(featureInfo)
  return _db.run(`UPDATE feature SET scenarios = ?, status = ? , end_time = ? , duration = ?  WHERE id = ?`,
    [featureInfo.scenarios, featureInfo.status, featureInfo.endTime, featureInfo.duration, featureInfo.id])
}

function getFeatureList (suiteID) {
  return _db.all(`SELECT * FROM feature WHERE suite_id = ?`, suiteID).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        suiteID: row.suite_id,
        title: row.title,
        scenarios: row.scenarios,
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration
      })
    })
    return list
  })
}

module.exports = {
  initDB: initDB,
  createFeature: createFeature,
  updateFeature: updateFeature,
  getFeatureList: getFeatureList
}
