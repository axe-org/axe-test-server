// mark :  测试中对一个操作进行的标记，以进行截图。
// 保存图片的地址为 ：  ./suite_id/mark_id
let _db
function initDB (db) {
  _db = db
  /**
   * mark  标记截图
   * id : 自增主键。
   * suite_id： 对应测试设备ID， 设置外键
   * scenario_id : 对应测试用例的ID. 设置外键。
   * title : 标题
   * time : 标记时间, 时间戳，毫秒。。以发送请求时间 ， 可能不够精准。
   */
  return _db.run(`CREATE TABLE IF NOT EXISTS mark (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id INTEGER NOT NULL,
    scenario_id INTEGER,
    title VARCHAR(100) NOT NULL,
    time INT(14) NOT NULL,
    FOREIGN KEY(suite_id) REFERENCES suite(id) ON DELETE CASCADE,
    FOREIGN KEY(scenario_id) REFERENCES scenario(id) ON DELETE CASCADE
  )`)
}

/**
 * 创建一个 mark , 返回值为 id.
 */
function createMark (markInfo) {
  return _db.run(`INSERT INTO mark VALUES (NULL, ? , ? , ? , ?)`,
    [markInfo.suiteID, markInfo.scenarioID, markInfo.title, markInfo.time]).then(stmt => {
    return stmt.lastID
  })
}

function getMarkList (scenarioID) {
  return _db.all(`SELECT * FROM mark WHERE scenario_id = ?`, [scenarioID]).then(rows => {
    let list = []
    rows.forEach(row => {
      list.push({
        id: row.id,
        suiteID: row.suite_id,
        scenarioID: row.scenario_id,
        title: row.title,
        time: row.time
      })
    })
    return list
  })
}

module.exports = {
  initDB: initDB,
  createMark: createMark,
  getMarkList: getMarkList
}
