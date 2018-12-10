const readline = require('readline')
// const path = require('path')
const fs = require('fs')

// activityData 包含，内存、CPU、磁盘读写。
// 其中内存(key: memory)计数为 MB，
// CPU(key: cpu)为百分比（可能超过一百，因为多核），
// 磁盘读写(key : read,write)为 MB, 为累计数据。
// 直接返回数据
function parseActivityData (filepath) {
  return new Promise((resolve, reject) => {
    let input = fs.createReadStream(filepath)
    const rl = readline.createInterface({
      input: input
    })
    let skipLine = 1// 过滤第一行。
    let output = []
    rl.on('line', (line) => {
      if (skipLine > 0) {
        skipLine--
        return
      }
      // 解析数据
      let splitsArray = line.split('|')
      if (splitsArray.length !== 7) {
        console.error('数据错误 ！！！')
        reject(new Error('parseActivityData 数据错误 ！！！'))
        return
      }
      let data = {
        timestamp: parseInt(splitsArray[0]),
        interval: parseInt(splitsArray[1]),
        cpu: parseFloat(parseFloat(splitsArray[2]).toFixed(2)),
        memory: parseFloat((parseInt(splitsArray[4]) / 1000000.0).toFixed(2)),
        diskRead: parseFloat((parseInt(splitsArray[5]) / 1000000.0).toFixed(2)),
        diskWrite: parseFloat((parseInt(splitsArray[6]) / 1000000.0).toFixed(2))
      }
      output.push({
        value: [data.timestamp, data.timestamp + data.interval],
        cpu: data.cpu > 1000 ? 0 : data.cpu,
        memory: data.memory,
        read: data.diskRead,
        write: data.diskWrite
      })
    })
    rl.on('close', () => {
      resolve(output)
    })
  })
}

// GPU数据：整理成线性图，而不是直方图。
// fps 帧率， 不够靠谱，如果页面本身是静止的，那帧率就一直是0了。
// gpu gpu性能使用率， 百分比。
function parseGPUData (filepath) {
  return new Promise((resolve, reject) => {
    let input = fs.createReadStream(filepath)
    const rl = readline.createInterface({
      input: input
    })
    let skipLine = 1// 过滤第一行。
    let output = []
    rl.on('line', (line) => {
      if (skipLine > 0) {
        skipLine--
        return
      }
      // 解析数据
      let splitsArray = line.split('|')
      if (splitsArray.length !== 4) {
        console.error('数据错误 ！！！')
        reject(new Error('parseGPUData 数据错误 ！！！'))
        return
      }
      output.push({
        timestamp: parseInt(splitsArray[0]),
        interval: parseInt(splitsArray[1]),
        fps: parseFloat(splitsArray[2]) < 100 ? parseFloat(splitsArray[2]) : 0,
        gpu: parseFloat(splitsArray[3]) < 200 ? parseFloat(splitsArray[3]) : 0
      })
    })
    rl.on('close', () => {
      resolve(output)
    })
  })
}

// 网络数据
// 直方图，
// bytesIn 输入流量，单位为KB
// bytesOut 输出流量，单位为KB.
function parseNetworkData (filepath) {
  return new Promise((resolve, reject) => {
    let input = fs.createReadStream(filepath)
    const rl = readline.createInterface({
      input: input
    })
    let skipLine = 1// 过滤第一行。
    let output = []
    let timeMap = {}
    rl.on('line', (line) => {
      if (skipLine > 0) {
        skipLine--
        return
      }
      // 解析数据
      let splitsArray = line.split('|')
      if (splitsArray.length !== 14) {
        console.error('数据错误 ！！！')
        reject(new Error('parseNetworkData 数据错误 ！！！'))
        return
      }
      let data = {
        timestamp: parseInt(splitsArray[0]),
        interval: parseInt(splitsArray[1]),
        bytesIn: parseFloat((parseFloat(splitsArray[9]) / 1000).toFixed(2)),
        bytesOut: parseFloat((parseFloat(splitsArray[11]) / 1000).toFixed(2))
      }
      let saved = timeMap[splitsArray[0]]
      if (saved) {
        saved.bytesIn += data.bytesIn
        saved.bytesOut += data.bytesOut
      } else {
        timeMap[splitsArray[0]] = data
        output.push({
          value: [data.timestamp, data.interval + data.timestamp],
          bytesIn: data.bytesIn,
          bytesOut: data.bytesOut
        })
      }
    })
    rl.on('close', () => {
      output.sort((a, b) => a.value[0] > b.value[0])
      resolve(output)
    })
  })
}

// Leaks, 先放这里。 TODO
function parseLeaksData (filepath) {
  return new Promise((resolve, reject) => {
    let input = fs.createReadStream(filepath)
    const rl = readline.createInterface({
      input: input
    })
    let skipLine = 1// 过滤第一行。
    let output = []
    rl.on('line', (line) => {
      if (skipLine > 0) {
        skipLine--
        return
      }
      // 解析数据
      let splitsArray = line.split('|')
      if (splitsArray.length !== 8) {
        console.error('数据错误 ！！！')
        reject(new Error('parseLeaksData 数据错误 ！！！'))
        return
      }
      output.push({
        time: parseInt(splitsArray[0]),
        name: splitsArray[2],
        address: splitsArray[3],
        symbol: splitsArray[4],
        library: splitsArray[7],
        size: parseInt(splitsArray[5])
      })
    })
    rl.on('close', () => {
      // 时间排序。
      resolve(output.sort((a, b) => a.time > b.time))
    })
  })
}

function parseBlockData (filepath) {
  return new Promise((resolve, reject) => {
    let input = fs.createReadStream(filepath)
    const rl = readline.createInterface({
      input: input
    })
    let skipLine = 1// 过滤第一行。
    let output = []
    rl.on('line', (line) => {
      if (skipLine > 0) {
        skipLine--
        return
      }
      // 解析数据
      let splitsArray = line.split('|')
      if (splitsArray.length !== 4) {
        console.error('数据错误 ！！！')
        reject(new Error('parseBlockData 数据错误 ！！！'))
        return
      }
      output.push({
        time: parseInt(splitsArray[0]),
        symbol: splitsArray[1],
        library: splitsArray[2],
        size: parseInt(splitsArray[3])
      })
    })
    rl.on('close', () => {
      // 时间排序。
      console.log(JSON.stringify(output))
      output = output.sort((a, b) => a.time > b.time)
      console.log(JSON.stringify(output))
      resolve(output)
    })
  })
}

module.exports = {
  parseActivityData,
  parseGPUData,
  parseNetworkData,
  parseLeaksData,
  parseBlockData
}
