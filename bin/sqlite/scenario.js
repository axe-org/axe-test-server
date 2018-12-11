// scenario : 一个具体的测试用例， 对应mocha中的一个it
let _db
function initDB (db) {
  _db = db
  /**
     * feature 对应mocha中的一次 describe .建议一个文件使用一个describe , 是测试用例的集合。
     * id : 自增主键。
     * suite_id : 对应suite的ID， 设置外健
     * feature_id: 对应的feature的ID， 设置外键。
     * title : 标题
     * status : 状态 ， passed / failed / error / crashed / skipped 当前面有测试错误时，后面的用例都会被跳过。
     * start_time : 开始时间
     * end_time : 结束时间
     * duration : 时长。开始时间和结束时间可能不够精确， 但是这个时长是比较精确的。 单位毫秒
     * stack : 错误或者失败的堆栈。
     */
  return _db.run(`CREATE TABLE IF NOT EXISTS scenario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id INTEGER NOT NULL,
    feature_id INTEGER,
    title VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    start_time INT(14),
    end_time INT(14),
    duration INTEGER,
    stack TEXT,
    FOREIGN KEY(suite_id) REFERENCES suite(id) ON DELETE CASCADE,
    FOREIGN KEY(feature_id) REFERENCES feature(id) ON DELETE CASCADE
  )`)
}

/**
 * 创建一个feature , 返回值为 id.
 */
function createScenario (scenarioInfo) {
  return _db.run(`INSERT INTO scenario VALUES (NULL, ? , NULL, ? , 'passed' , ? , NULL , NULL , NULL)`,
    [scenarioInfo.suiteID, scenarioInfo.title, scenarioInfo.startTime]).then(stmt => {
    return stmt.lastID
  })
}

/**
 * 结束时设置 end_time 和 status
 */
function endScenario (scenarioInfo) {
  return _db.run(`UPDATE scenario SET status = ? , end_time = ? , duration = ? WHERE id = ?`,
    [scenarioInfo.status, scenarioInfo.endTime, scenarioInfo.duration, scenarioInfo.id])
}

/**
 * 最后再填充上 时长 和 对应的 feature。
 * @param {*} scenarioInfo
 */
function linkScenarioToFeature (scenarioInfo) {
  return _db.run(`UPDATE scenario SET feature_id = ? WHERE id = ?`,
    [scenarioInfo.featureID, scenarioInfo.id])
}

function addStack (scenarioInfo) {
  return _db.run(`UPDATE scenario SET stack = ? WHERE id = ?`,
    [scenarioInfo.stack, scenarioInfo.id])
}

/**
 *  获取 全部的测试用例信息。 返回值是一个列表。
 * @param  suiteID
 */
function getScenarioList (suiteID) {
  return _db.all(`SELECT * FROM scenario WHERE suite_id = ?`, [suiteID]).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        suiteID: row.suite_id,
        featureID: row.feature_id,
        title: row.title,
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        stack: row.stack
      })
    })
    return list
  })
}

function getScenarioListInFeature (featureID) {
  return _db.all(`SELECT * FROM scenario WHERE feature_id = ?`, [featureID]).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        suiteID: row.suite_id,
        featureID: row.feature_id,
        title: row.title,
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        stack: row.stack
      })
    })
    return list
  })
}

module.exports = {
  initDB: initDB,
  createScenario: createScenario,
  endScenario: endScenario,
  linkScenarioToFeature: linkScenarioToFeature,
  getScenarioList: getScenarioList,
  addStack: addStack,
  getScenarioListInFeature: getScenarioListInFeature
}
