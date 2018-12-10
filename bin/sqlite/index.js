// 将一些数据存储到数据库中。
const sqlite = require('sqlite')
// const path = require('path')
const operation = require('./operation')
const suite = require('./suite')
const feature = require('./feature')
const scenario = require('./scenario')
const mark = require('./mark')

let _db

function initDB (path) {
  return sqlite.open(path, {Promise}).then(db => {
    _db = db
    return db.exec('PRAGMA foreign_keys = ON') // 需要手动打开外键
  }).then(db => {
    return Promise.all([operation.initDB(_db), suite.initDB(_db),
      feature.initDB(_db), scenario.initDB(_db), mark.initDB(_db)])
  })
}

module.exports = {
  initDB: initDB,
  operation: operation,
  suite: suite,
  feature: feature,
  scenario: scenario,
  mark: mark
}
