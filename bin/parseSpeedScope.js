const readline = require('readline')
const path = require('path')
const fs = require('fs')
const stream = require('stream')

class Node {
  constructor (parent, weight, address) {
    if (!parent) {
      this.startValue = 0
    } else {
      // 否则，去parent中找到 startFrame
      if (parent.children.length) {
        let lastChildren = parent.children[parent.children.length - 1]
        this.startValue = lastChildren.endValue
      } else {
        this.startValue = parent.startValue
      }
    }
    this.weight = weight
    this.children = []
    this.endValue = this.startValue + weight
    this.parent = parent
    this.address = address
  }
}

// 处理 allocation数据， 输出用于 speedscope的文件。
function parseAllocationData (filepath, outputFile) {
  return new Promise((resolve, reject) => {
    let rootNode
    // 用于快速寻找 parent.
    let nodeMap = {}
    // address 和 symbol 对应表。
    let symbolMap = {}
    let input = fs.createReadStream(filepath)
    const rl = readline.createInterface({
      input: input
    })
    let skipLine = 1// 过滤第一行。
    rl.on('line', (line) => {
      if (skipLine > 0) {
        skipLine--
        return
      }
      // 解析数据
      let splitsArray = line.split('|')
      if (splitsArray.length !== 7) {
        console.error('数据错误 ！！！')
        reject(new Error('parseAllocationData 数据错误 ！！！'))
        return
      }
      let data = {
        address: splitsArray[0],
        symbol: splitsArray[1],
        library: splitsArray[2],
        parent: splitsArray[3],
        childCount: parseInt(splitsArray[4]),
        bytes: parseInt(splitsArray[5]),
        count: parseInt(splitsArray[6])
      }
      symbolMap[data.address] = data.symbol
      let parentNode = nodeMap[data.parent]
      let node = new Node(parentNode, data.bytes, data.address)
      if (!parentNode) {
        // 这个就是rootNode .
        rootNode = node
      } else {
        parentNode.children.push(node)
      }
      nodeMap[data.address] = node
    })
    rl.on('close', () => {
      if (!rootNode) {
        console.error('数据错误 ！！！')
        reject(new Error('parseAllocationData 数据错误 ！！！'))
        return
      }
      // 读取完成后，整理数据输出。
      let speedscopeData = {
        exporter: 'speedscope@1.3.1',
        name: 'AXE Memory All Allcoations',
        activeProfileIndex: 0,
        '$schema': 'https://www.speedscope.app/file-format-schema.json',
        shared: {
          frames: [
          ]
        },
        profiles: [
          {
            type: 'evented',
            name: 'AXE Memory All Allcoations',
            unit: 'bytes',
            startValue: 0,
            endValue: rootNode.weight,
            events: []
          }
        ]
      }
      let addressIndexMap = {}
      let index = 0
      for (let key of Object.keys(symbolMap)) {
        addressIndexMap[key] = index++
        speedscopeData.shared.frames.push({name: symbolMap[key]})
      }

      let events = []
      let traversalNode = (node) => {
        if (!node) {
          return
        }
        events.push({
          'type': 'O',
          'frame': addressIndexMap[node.address],
          'at': node.startValue
        })
        for (let children of node.children) {
          traversalNode(children)
        }
        events.push({
          'type': 'C',
          'frame': addressIndexMap[node.address],
          'at': node.endValue
        })
      }
      traversalNode(rootNode)
      speedscopeData.profiles[0].events = events

      let data = JSON.stringify(speedscopeData)
      fs.writeFileSync(outputFile, data)
      resolve()
    })
  })
}

// 处理 time profiler 数据， 输出用于 speedscope的文件。
function parseTimeProfilerData (filepath, outputFile) {
  return new Promise((resolve, reject) => {
    let rootNode
    // 用于快速寻找 parent.
    let nodeMap = {}
    // address 和 symbol 对应表。
    let symbolMap = {}

    let input = fs.createReadStream(filepath)
    const rl = readline.createInterface({
      input: input
    })
    let skipLine = 1// 过滤第一行。
    rl.on('line', (line) => {
      if (skipLine > 0) {
        skipLine--
        return
      }
      // 解析数据
      let splitsArray = line.split('|')
      if (splitsArray.length !== 6) {
        console.error('数据错误 ！！！')
        reject(new Error('parseAllocationData 数据错误 ！！！'))
        return
      }
      let data = {
        address: splitsArray[0],
        symbol: splitsArray[1],
        library: splitsArray[2],
        parent: splitsArray[3],
        childCount: parseInt(splitsArray[4]),
        count: parseInt(splitsArray[5])
      }
      symbolMap[data.address] = data.symbol
      let parentNode = nodeMap[data.parent]
      let node = new Node(parentNode, data.count, data.address)
      if (!parentNode) {
        // 这个就是rootNode .
        rootNode = node
      } else {
        parentNode.children.push(node)
      }
      nodeMap[data.address] = node
    })

    rl.on('close', () => {
      if (!rootNode) {
        console.error('数据错误 ！！！')
        reject(new Error('parseAllocationData 数据错误 ！！！'))
        return
      }
      // 读取完成后，整理数据输出。
      let speedscopeData = {
        exporter: 'speedscope@1.3.1',
        name: 'AXE Time Profiler',
        activeProfileIndex: 0,
        '$schema': 'https://www.speedscope.app/file-format-schema.json',
        shared: {
          frames: [
          ]
        },
        profiles: [
          {
            type: 'evented',
            name: 'AXE Time Profiler',
            unit: 'milliseconds',
            startValue: 0,
            endValue: rootNode.weight,
            events: []
          }
        ]
      }

      let addressIndexMap = {}
      let index = 0
      for (let key of Object.keys(symbolMap)) {
        addressIndexMap[key] = index++
        speedscopeData.shared.frames.push({name: symbolMap[key]})
      }

      let events = []
      let traversalNode = (node) => {
        if (!node) {
          return
        }
        events.push({
          'type': 'O',
          'frame': addressIndexMap[node.address],
          'at': node.startValue
        })
        for (let children of node.children) {
          traversalNode(children)
        }
        events.push({
          'type': 'C',
          'frame': addressIndexMap[node.address],
          'at': node.endValue
        })
      }
      traversalNode(rootNode)
      speedscopeData.profiles[0].events = events

      let data = JSON.stringify(speedscopeData)
      fs.writeFileSync(outputFile, data)
      resolve()
    })
  })
}

function getProfileBuffer (filePath) {
  const profileStream = fs.createReadStream(filePath)
  const chunks = []
  return new Promise((resolve, reject) => {
    profileStream.pipe(
      stream.Writable({
        write (chunk, encoding, callback) {
          chunks.push(chunk)
          callback()
        },
        final () {
          resolve(Buffer.concat(chunks))
        }
      })
    )
    profileStream.on('error', ev => reject(ev))
  })
}

// 当在本地打开 speedscope页面时，还要特殊处理一下，使用 jsonp.
async function parseJsonToLocalJS (inputFile, outputFile) {
  // 再处理一份本地数据格式。
  const sourceBuffer = await getProfileBuffer(inputFile)
  const filename = path.basename(inputFile)
  const sourceBase64 = sourceBuffer.toString('base64')
  const jsSource = `speedscope.loadFileFromBase64(${JSON.stringify(filename)}, ${JSON.stringify(
    sourceBase64
  )})`
  fs.writeFileSync(outputFile, jsSource)
}

module.exports = {
  parseAllocationData,
  parseTimeProfilerData,
  parseJsonToLocalJS
}
