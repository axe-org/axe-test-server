#!/usr/bin/env node
var express = require('express')

var app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json({limit: '10mb'}))
const dispatchRouter = require('./router')
dispatchRouter(app)

let server = app.listen(2670, function () {
  let host = server.address().address
  let port = server.address().port
  console.log('应用实例，访问地址为 http://%s:%s', host, port)
})
