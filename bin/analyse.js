// 根据上传的测试数据，进行分析，更新当前数据的细节。
const sqlite = require('./sqlite')
const fs = require('fs')
const path = require('path')
const dateformat = require('dateformat')
const {exec} = require('child_process')
const {parseAllocationData, parseTimeProfilerData, parseJsonToLocalJS} = require('./parseSpeedScope')
const {AXEDataItemType} = require('axe-data-serialization')
const parseG2Data = require('./parseG2Data')
const rimraf = require('rimraf')

// 从崩溃日志中获取崩溃时间，以定位到具体的测试用例
function getCrashTimeFromCrashLog (crashLog) {
  let lines = crashLog.split('\n')
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (/Date\/Time:/.test(line)) {
      let time = line.replace('Date/Time:')
      return new Date(time).getTime()
    }
  }
}

async function analyse (uploadData, savePath) {
  try {
    // 测试状态记录。
    let testsuite = uploadData.data.testsuite
    // let startTime = new Date(uploadData.timestamp).getTime()
    let suiteStatus = 'passed'
    let scenarios = testsuite.tests
    // 崩溃日志。
    let crashLog = uploadData.crashLog
    let crashTime
    if (crashLog) {
      // 崩溃日志导出到本地。
      fs.writeFileSync(path.join(savePath, String(uploadData.suiteID), 'crash.crash'), crashLog)
      crashTime = getCrashTimeFromCrashLog(crashLog)
    }

    // 进行数据的分析。
    let currentFeature = {}
    let featureCount = 0
    let passedCount = 0
    // let time = startTime
    let scenariosInSuite = await sqlite.scenario.getScenarioList(uploadData.suiteID)
    // 顺序遍历 scenario.
    let scenariosIndex = 0
    for (let index = 0; index < testsuite.testcase.length; index++) {
      const testcase = testsuite.testcase[index]
      const scenario = scenariosInSuite[scenariosIndex++]
      if (scenario.status === 'passed') {
        passedCount++
      }
      let featureTitle = testcase.classname
      if (currentFeature.title !== featureTitle) {
        currentFeature = {
          title: featureTitle,
          startTime: scenario.startTime,
          duration: 0,
          endTime: scenario.startTime,
          status: scenario.status,
          scenarios: 0,
          suiteID: uploadData.suiteID
        }
        featureCount++
        currentFeature.id = await sqlite.feature.createFeature(currentFeature)
      }
      await sqlite.scenario.linkScenarioToFeature({
        id: scenario.id,
        featureID: currentFeature.id
      })
      if (scenario.status !== 'skipped') {
        // 只会有一个 error 或 fail
        // 如果在 崩溃时间内，则修改为crashed.
        if (crashLog && crashTime <= scenario.endTime && crashTime >= scenario.startTime) {
          scenario.status = 'crashed'
          // 同时更新 scenario的状态。
          await sqlite.scenario.endScenario(scenario)
        }
        currentFeature.status = scenario.status
        suiteStatus = scenario.status
        // TODO 这里有一个问题， 异常时，没有 scenario.status
        console.log('suiteStatus ' + suiteStatus)
      }
      let stack = testcase.failure
      if (stack) {
        // 写入堆栈。
        await sqlite.scenario.addStack({
          stack: stack,
          id: scenario.id
        })
      }
      // time += scenario.duration
      currentFeature.endTime += scenario.duration
      currentFeature.duration += scenario.duration
      currentFeature.scenarios += 1
      await sqlite.feature.updateFeature(currentFeature)
    }
    if (crashLog) {
      // 这边可能有找不到崩溃的详细测试用例的可能。
      suiteStatus = 'crashed'
    }
    await sqlite.suite.updateSuite({
      status: suiteStatus,
      endTime: uploadData.endTime,
      duration: testsuite.time * 1000,
      features: featureCount,
      scenarios: scenarios,
      passedNumber: passedCount,
      suiteID: uploadData.suiteID
    })
    await summary(uploadData.suiteID, savePath)
  } catch (error) {
    console.log(error)
  }
}

let summaryData
const dateTimeFormat = 'yyyy-mm-dd HH:MM:ss'
const timeFormat = 'HH:MM:ss'
let savePath

function clean () {
  summaryData = {
    overview: {
      type: undefined,
      time: undefined, // 测试开始时间
      duration: undefined,
      deviceNumber: 0,
      suiteNumber: 0,
      passedSuite: 0,
      failedSuite: 0,
      crashedSuite: 0,
      errorSuite: 0,
      caseNumber: 0,
      passedCase: 0
    },
    suites: []
  }
}

async function summary (suiteID, _savePath) {
  let suite = await sqlite.suite.getSuite(suiteID)
  savePath = _savePath
  summaryData.suites.push(suite)
  await summarySuite(suite)
  if (!summaryData.overview.type) {
    // 设置开始时间和类型
    summaryData.overview.type = suite.type === 'profile' ? '性能测试' : '普通测试'
    summaryData.overview.time = dateformat(new Date(suite.startTime), dateTimeFormat)
    // 辅助数据
    summaryData.overview.timeValue = suite.startTime
    summaryData.overview.durationValue = 0
    summaryData.overview.deviceUDIDList = []
  }
  // 时间计算， 用suite结束时间减去开始时间。
  let suiteDuration = suite.endTime - summaryData.overview.timeValue
  summaryData.overview.durationValue += suiteDuration
  // 整体测试时间，计算分钟
  summaryData.overview.duration = ((summaryData.overview.durationValue / 60000) | 0) + '分钟'
  // 统计其他数据。
  if (!summaryData.overview.deviceUDIDList.includes(suite.udid)) {
    summaryData.overview.deviceUDIDList.push(suite.udid)
    summaryData.overview.deviceNumber += 1
  }
  summaryData.overview.suiteNumber += 1
  // passed / failed / error / crashed
  if (suite.status === 'passed') {
    summaryData.overview.passedSuite += 1
  } else if (suite.status === 'failed') {
    summaryData.overview.failedSuite += 1
  } else if (suite.status === 'error') {
    summaryData.overview.errorSuite += 1
  } else if (suite.status === 'crashed') {
    summaryData.overview.crashedSuite += 1
  }
  summaryData.overview.caseNumber += suite.scenarios
  summaryData.overview.passedCase += suite.passedNumber
  // 更新文件。
  fs.writeFileSync(path.join(savePath, 'data.js'), 'window.reporterData=' + JSON.stringify(summaryData, null, 2))
}

// Promisified child_process.exec
function execp (cmd, opts) {
  opts || (opts = {})
  return new Promise((resolve, reject) => {
    const child = exec(cmd, opts,
      (err, stdout, stderr) => err ? reject(err) : resolve({
        stdout: stdout,
        stderr: stderr
      }))
    if (opts.stdout) {
      child.stdout.pipe(opts.stdout)
    }
    if (opts.stderr) {
      child.stderr.pipe(opts.stderr)
    }
  })
}

// 处理性能测试数据。
async function parseProfileData (suite) {
  let suitePath = path.join(savePath, String(suite.id))
  let profileFileName = suite.profile.replace(/ /g, '_') + '.trace'
  let profilePath = path.join(suitePath, profileFileName)
  if (fs.existsSync(profilePath)) {
    // 导出instruments 数据
    await execp(`TraceUtility ${profilePath} -o ${suitePath}`)
    // 已有zip包，进行删除
    rimraf.sync(profilePath)
    // 再处理成可视化数据格式。
    if (suite.profile === 'AXE') {
      // 对于基础性能测试，直接将数据放到 data.js中。
      let activityFile = path.join(suitePath, 'activity.txt')
      if (fs.existsSync(activityFile)) {
        let activityData = await parseG2Data.parseActivityData(activityFile)
        // 对数据进行处理，分配到每个feature上。
        for (const feature of suite.featureList) {
          let activityDataInFeature = []
          for (const activityItem of activityData) {
            if (activityItem.value[0] >= feature.startTime && activityItem.value[0] <= feature.endTime) {
              let startTime = parseFloat(((activityItem.value[0] - feature.startTime) / 1000).toFixed(2))
              let endTime = parseFloat(((activityItem.value[1] - feature.startTime) / 1000).toFixed(2))
              activityDataInFeature.push({
                value: [startTime, endTime],
                cpu: activityItem.cpu,
                memory: activityItem.memory,
                read: activityItem.read,
                write: activityItem.write
              })
            }
          }
          feature.activityData = activityDataInFeature
        }
        suite.activityData = activityData
      }
      let gpuFile = path.join(suitePath, 'fps.txt')
      if (fs.existsSync(gpuFile)) {
        let gpuData = await parseG2Data.parseGPUData(gpuFile)
        for (const feature of suite.featureList) {
          let gpuDataInFeature = []
          for (const gpuItem of gpuData) {
            if (gpuItem.timestamp >= feature.startTime && gpuItem.timestamp <= feature.endTime) {
              let time = parseFloat(((gpuItem.timestamp - feature.startTime) / 1000).toFixed(2))
              gpuDataInFeature.push({
                value: time,
                fps: gpuItem.fps,
                gpu: gpuItem.gpu
              })
            }
          }
          feature.gpuData = gpuDataInFeature
        }
        suite.gpuData = gpuData
      }
      let networkFile = path.join(suitePath, 'network.txt')
      if (fs.existsSync(networkFile)) {
        let networkData = await parseG2Data.parseNetworkData(networkFile)
        // 对数据进行处理，分配到每个feature上。
        for (const feature of suite.featureList) {
          let networkDataInFeature = []
          for (const networkItem of networkData) {
            // 边界处理。
            if (networkItem.value[0] >= feature.startTime && networkItem.value[0] <= feature.endTime) {
              let startTime = parseFloat(((networkItem.value[0] - feature.startTime) / 1000).toFixed(2))
              let endTime = parseFloat(((networkItem.value[1] - feature.startTime) / 1000).toFixed(2))
              networkDataInFeature.push({
                value: [startTime, endTime],
                bytesIn: networkItem.bytesIn,
                bytesOut: networkItem.bytesOut
              })
            }
          }
          feature.networkData = networkDataInFeature
        }
        suite.networkData = networkData
      }
    } else if (suite.profile === 'Time Profiler') {
      // 对于 Time Profiler, 输出两份 SpeedScope数据。
      let timeInputFile = path.join(savePath, `${suite.id}/timeprofiler.txt`)
      if (fs.existsSync(timeInputFile)) {
        let timeOutputFile = path.join(suitePath, `time.json`)
        await parseTimeProfilerData(timeInputFile, timeOutputFile)
        suite.timeSpeedScopeFile = `${suite.id}/time.json`
        let timeOutputJSFile = path.join(suitePath, `time.js`)
        await parseJsonToLocalJS(timeOutputFile, timeOutputJSFile)
        suite.timeSpeedScopeJSFile = `${suite.id}/time.js`
      } else {
        console.error(`找不到文件。 ${timeInputFile}`)
      }
      let filteredTimeInputFile = path.join(savePath, `${suite.id}/timeprofiler-filtered.txt`)
      if (fs.existsSync(timeInputFile)) {
        let filteredTimeOutputFile = path.join(savePath, `${suite.id}/filteredTime.json`)
        await parseTimeProfilerData(filteredTimeInputFile, filteredTimeOutputFile)
        suite.filteredTimeSpeedScopedFile = `${suite.id}/filteredTime.json`
        let filteredTimeOutputJSFile = path.join(suitePath, `filteredTime.js`)
        await parseJsonToLocalJS(filteredTimeOutputFile, filteredTimeOutputJSFile)
        suite.filteredTimeSpeedScopedJSFile = `${suite.id}/filteredTime.js`
      } else {
        console.error(`找不到文件。 ${filteredTimeInputFile}`)
      }
      let blockInputFile = path.join(suitePath, `blockedcall.txt`)
      if (fs.existsSync(blockInputFile)) {
        // 对于泄漏，直接读取，放到数据中。
        suite.blockData = await parseG2Data.parseBlockData(blockInputFile)
        // 再根据时间分配到各个Feature中。
        for (const feature of suite.featureList) {
          let blockDataInFeature = []
          for (const blockItem of suite.blockData) {
            // 边界处理。
            if (blockItem.time >= feature.startTime && blockItem.time <= feature.endTime) {
              blockDataInFeature.push(blockItem)
            }
          }
          feature.blockData = blockDataInFeature
        }
      }
    } else if (suite.profile === 'Leaks') { // Leaks
      // 对于 leaks, 输出两份内存的 speedScope , 输出一份泄漏数据到data.js中。
      let memoryInputFile = path.join(suitePath, `allocation.calltree.txt`)
      if (fs.existsSync(memoryInputFile)) {
        let memoryOutputFile = path.join(suitePath, `allocations.json`)
        await parseAllocationData(memoryInputFile, memoryOutputFile)
        suite.allocationsSpeedScopeFile = `${suite.id}/allocations.json`
        let memoryOutputJSFile = path.join(suitePath, `allocations.js`)
        await parseJsonToLocalJS(memoryOutputFile, memoryOutputJSFile)
        suite.allocationsSpeedScopeJSFile = `${suite.id}/allocations.js`
      } else {
        console.error(`找不到文件。 ${memoryInputFile}`)
      }
      let filteredMemoryInputFile = path.join(suitePath, `allocation.calltree.filtered.txt`)
      if (fs.existsSync(filteredMemoryInputFile)) {
        let memoryOutputFile = path.join(suitePath, `allocations-filtered.json`)
        await parseAllocationData(filteredMemoryInputFile, memoryOutputFile)
        suite.filteredAllocationsSpeedScopedFile = `${suite.id}/allocations-filtered.json`
        let memoryOutputJSFile = path.join(suitePath, `allocations-filtered.js`)
        await parseJsonToLocalJS(memoryOutputFile, memoryOutputJSFile)
        suite.filteredAllocationsSpeedScopedJSFile = `${suite.id}/allocations-filtered.js`
      } else {
        console.error(`找不到文件。 ${filteredMemoryInputFile}`)
      }
      let leaksInputFile = path.join(suitePath, `leaks.txt`)
      if (fs.existsSync(leaksInputFile)) {
        // 对于泄漏，直接读取，放到数据中。
        suite.leakData = await parseG2Data.parseLeaksData(leaksInputFile)
        // 再根据时间分配到各个Feature中。
        for (const feature of suite.featureList) {
          let neakDataInFeature = []
          for (const leakItem of suite.leakData) {
            // 边界处理。
            if (leakItem.time >= feature.startTime && leakItem.time <= feature.endTime) {
              neakDataInFeature.push(leakItem)
            }
          }
          feature.leakData = neakDataInFeature
        }
      }
    }
  }
}

async function summarySuite (suite) {
  let minutes = (suite.duration / 60000) | 0
  minutes = ('00' + minutes).slice(-2) + '分钟'
  let seconds = (suite.duration % 60000 / 1000) | 0
  seconds = ('00' + seconds).slice(-2) + '秒'
  suite.durationText = minutes + seconds
  suite.startTimeText = dateformat(new Date(suite.startTime), timeFormat)
  suite.endTimeText = dateformat(new Date(suite.endTime), timeFormat)
  suite.progressText = suite.passedNumber + ' / ' + suite.scenarios
  // 填充suite数据。
  let featureList = await sqlite.feature.getFeatureList(suite.id)
  suite.featureList = featureList
  for (let feature of featureList) {
    feature.profile = suite.profile
    await summaryFeature(feature)
  }
  if (suite.status === 'crashed') {
    suite.crashLogPath = `${suite.id}/crash.crash`
  }
  if (suite.profile) {
    suite.profileDownloadPath = `${suite.id}/instruments.zip`
  }
  // 处理性能测试数据。
  if (suite.profile) {
    await parseProfileData(suite)
  }
}

async function summaryFeature (feature) {
  feature.passedNumber = 0
  // 填充 feature数据.
  let scenarioList = await sqlite.scenario.getScenarioListInFeature(feature.id)
  feature.scenarioList = scenarioList
  for (const scenario of scenarioList) {
    await summaryScenario(scenario)
    if (scenario.status === 'passed') {
      feature.passedNumber += 1
    }
  }
  feature.progressText = feature.passedNumber + ' / ' + feature.scenarios
  feature.startTimeText = dateformat(new Date(feature.startTime), timeFormat)
  feature.durationText = ((feature.duration / 1000) | 0) + '秒'
}

// 将 dataItem 中的 文件存储到本地。
function saveDataInFile (dataItemJson, suiteID) {
  if (dataItemJson.type === AXEDataItemType.Image) {
    // jpg 格式， 为  ‘data:image/jpeg;base64,’
    let base64Data = dataItemJson.value.split(',')[1]
    let jpgData = Buffer.from(base64Data, 'base64')
    let jpgFileName = 'image-' + new Date().getTime() + '.jpg'
    let jpgPath = path.join(savePath, suiteID, jpgFileName)
    fs.writeFileSync(jpgPath, jpgData)
    return {type: AXEDataItemType.Image, value: `${suiteID}/${jpgFileName}`}
  } else if (dataItemJson.type === AXEDataItemType.Data) {
    let data = Buffer.from(dataItemJson.value, 'base64')
    let dataFileName = 'data-' + new Date().getTime() + '.data'
    let dataFileNamePath = path.join(savePath, suiteID, dataFileName)
    fs.writeFileSync(data, dataFileNamePath)
    return {type: AXEDataItemType.Data, value: `${suiteID}/${dataFileName}`}
  }
  return dataItemJson
}

const operationTypesText = {
  route_jump: '跳转路由',
  route_view: '视图路由',
  data_set: '设置数据',
  data_remove: '删除数据',
  data_get: '获取数据',
  post_event: '发送事件'
}

async function summaryScenario (scenario) {
  scenario.startTimeText = dateformat(new Date(scenario.startTime), timeFormat)
  scenario.endTimeText = dateformat(new Date(scenario.endTime), timeFormat)
  scenario.durationText = scenario.duration / 1000 + ' 秒'
  scenario.markList = await sqlite.mark.getMarkList(scenario.id)
  for (const mark of scenario.markList) {
    mark.src = `${mark.suiteID}/${mark.time}.png`
    mark.timeText = dateformat(new Date(mark.time), dateTimeFormat)
  }
  scenario.logList = {
    routeList: [],
    eventList: [],
    dataList: [],
    otherList: []
  }
  let axeLogs = await sqlite.operation.getOperationLogs(scenario.startTime, scenario.endTime)
  for (let log of axeLogs) {
    if (log.payload) {
      let json = JSON.parse(log.payload)
      for (const [key, value] of Object.entries(json)) {
        json[key] = saveDataInFile(value, String(scenario.suiteID))
      }
      log.payload = json
    }
    if (log.dataItem) {
      let itemJson = JSON.parse(log.dataItem)
      log.dataItem = JSON.stringify(saveDataInFile(itemJson, String(scenario.suiteID)))
    }
    log.timeText = dateformat(new Date(log.time), dateTimeFormat)
    log.typeText = operationTypesText[log.operation]
    if (log.operation === 'route_jump' || log.operation === 'route_view') {
      scenario.logList.routeList.push(log)
    } else if (log.operation === 'data_set' || log.operation === 'data_remove' || log.operation === 'data_get') {
      scenario.logList.dataList.push(log)
    } else if (log.operation === 'post_event') {
      scenario.logList.eventList.push(log)
    }
  }
}

module.exports = {
  analyse,
  clean
}
