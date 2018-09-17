const Automerge = require('automerge')
const AutomergeClient = require('automerge-client').default
const fs = require('fs')
const path = require('path')
const WebSocket = require('./reconnecting-websocket')

const readline = require('readline')

const socket = new WebSocket('http://localhost:3000/automerge')

socket.addEventListener('close', () => {
  if (socket._shouldReconnect) socket._connect()
})

const storeFile = path.join(__dirname, 'store.json')
const client = new AutomergeClient({
  socket,
  savedData: (() => {
    try {
      return fs.readFileSync(storeFile, 'utf8')
    } catch (e) {
      return undefined
    }
  })(),
  save: data => fs.writeFile(storeFile, data, 'utf8', () => {}),
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function handleLine() {
  rl.question('automerge> ', line => {
    const [cmd, ...args] = line.trim().split(/ +/)
    console.log(cmd, args)
    if (cmd === 'subscribe' || cmd === 's') {
      subscribe(args)
    } else if (['c', 'ch', 'change'].includes(cmd)) {
      change(args)
    } else {
      console.error('Unknown command "' + cmd + '"')
    }

    handleLine()
  })
}
handleLine()

function subscribe(args) {
  client.subscribe(args)
}

function change(args) {
  const ret = client.change(args[0], doc => {
    doc[args[1]] = args[2]
  })
  if (!ret) {
    console.error('Failed to change doc')
  }
}
