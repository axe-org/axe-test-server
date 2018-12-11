var formidable = require('formidable')
const sqlite = require('./sqlite')
const path = require('path')
const fs = require('fs')
const unzipper = require('unzipper')
const {analyse, clean} = require('./analyse')

// 设备上传 AXE操作详情。
function uploadOperation (req, res) {
  // 保存到本地。
  sqlite.operation.saveOperation(req.body).then(() => {
    res.json({})
  }).catch(err => {
    console.log('uploadOperation')
    console.log(err)
    res.json({error: err.message})
  })
}

// TODO ， 一个服务器只能起一次测试。。。
let savePath
let currentPath
// 初始化时必须要进行设置。
function setSavePath (req, res) {
  // 本地文件存储路径。
  savePath = req.body.path
  clean()
  sqlite.initDB(path.join(savePath, 'sqlite3.db')).then(() => {
    res.json({})
  }).catch(err => {
    console.log('setSavePath')
    console.log(err)
    res.json({error: err.message})
  })
}

// 开始一个设备的测试.
function startSuite (req, res) {
  // 测试状态记录。
  sqlite.suite.createSuite(req.body).then(id => {
    currentPath = path.join(savePath, String(id))
    fs.mkdirSync(currentPath)
    res.json({id: id})
  }).catch(err => {
    console.log('startSuite')
    console.log(err)
    res.json({error: err.message})
  })
}

// 上传性能测试文件。
function uploadTrace (req, res) {
  let form = new formidable.IncomingForm()
  form.maxFileSize = 4 * 1024 * 1024 * 1024
  let zipPath = path.join(currentPath, 'instruments.zip')
  form.parse(req)
  form.on('fileBegin', function (name, file) {
    file.path = zipPath
  })
  form.on('error', err => {
    console.log('An error has occured: \n' + err)
    res.json({error: '网络异常！！！'})
  })
  form.on('end', function () {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: currentPath }))
      .promise()
      .then(() => {
        res.json({})
      })
  })
}

// 上传完成后，放置到指定位置
// TODO 使用traceUtil 进行分析。
function endUploadTrace (req, res) {
  // let suiteID = req.body.suiteID
  let profile = req.body.profile
  // let currentPath = path.join(savePath, String(suiteID))
  let profileTraceFile = profile.replace(/ /g, '_')
  let traceFilePath = path.join(currentPath, profileTraceFile + '.trace')
  let files = fs.readdirSync(currentPath)
  let found = false
  files.forEach(file => {
    if (/.*\.trace/.test(file)) {
      if (file.includes(profileTraceFile)) {
        found = true
        fs.renameSync(path.join(currentPath, file), traceFilePath)
        res.json({})
      }
    }
  })
  if (!found) {
    res.json({})
  }
}

// 结束 , 接受suite信息，更新整个数据库状态。
function endSuite (req, res) {
  res.json({})
  analyse(req.body, savePath)
}

// beforeEach 去创建 一个测试用例。
function createScenario (req, res) {
  sqlite.scenario.createScenario(req.body).then(id => {
    res.json({id: id})
  }).catch(err => {
    console.log('createScenario')
    console.log(err)
    res.json({error: err.message})
  })
}

// afterEach 去关闭一个测试用例。
function endScenario (req, res) {
  sqlite.scenario.endScenario(req.body).then(id => {
    res.json({})
  }).catch(err => {
    console.log('endScenario')
    console.log(err)
    res.json({error: err.message})
  })
}

// 截图标记操作的处理。数据：
// data: base64的图片
// title: 标题
// time: 触发时间。
function mark (req, res) {
  let screenshotData = Buffer.from(req.body.data, 'base64')
  let currentPath = path.join(savePath, String(req.body.suiteID))
  let pngPath = path.join(currentPath, req.body.time + '.png')
  fs.writeFileSync(pngPath, screenshotData)
  sqlite.mark.createMark(req.body).then(() => {
    res.json({})
  }).catch(err => {
    console.log('mark')
    console.log(err)
    res.json({error: err.message})
  })
}

// 记录 Asset的错误，将 Asset失败 与 error 进行分离。
function recordAssetError (req, res) {

}

// 获取route事件。
function getRouteActions (req, res) {
  // startTime , endTime , type
  sqlite.operation.getRouteActions(req.body).then((actions) => {
    res.json({'actions': actions})
  }).catch(err => {
    console.log('getRouteActions')
    console.log(err)
    res.json({error: err.message})
  })
}

// 获取route事件。
function getEventActions (req, res) {
  // startTime , endTime , name
  sqlite.operation.getEventActions(req.body).then((actions) => {
    res.json({'actions': actions})
  }).catch(err => {
    console.log('getEventActions')
    console.log(err)
    res.json({error: err.message})
  })
}

function getDataCenterActions (req, res) {
  sqlite.operation.getDataCenterActions(req.body).then((actions) => {
    res.json({'actions': actions})
  }).catch(err => {
    console.log('getDataCenterActions')
    console.log(err)
    res.json({error: err.message})
  })
}

// 客户端可能与服务器的时间不同，做简单的同步处理。
function timeSynchronization (req, res) {
  res.json({serverTime: new Date().getTime()})
}

function dispatchRouter (app) {
  app.post('/operation.json', uploadOperation)
  app.post('/uploadTrace', uploadTrace)
  app.post('/endUploadTrace.json', endUploadTrace)
  app.post('/setSavePath.json', setSavePath)
  app.post('/test/startSuite.json', startSuite)
  app.post('/test/endSuite.json', endSuite)
  app.post('/test/mark.json', mark)
  app.post('/test/createScenario.json', createScenario)
  app.post('/test/endScenario.json', endScenario)
  app.post('/action/getRouteActions.json', getRouteActions)
  app.post('/action/getEventActions.json', getEventActions)
  app.post('/action/getDataCenterActions.json', getDataCenterActions)
  app.get('/time.json', timeSynchronization)
}

module.exports = dispatchRouter
