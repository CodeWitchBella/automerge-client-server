const Automerge = require('automerge')
const AutomergeClient = require('automerge-client').default
const WebSocket = require('./reconnecting-websocket')

const readline = require('readline')

const socket = new WebSocket('http://localhost:3000/automerge')

socket.addEventListener('close', () => {
  if (socket._shouldReconnect) socket._connect()
})

const client = new AutomergeClient({
  socket
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function handleLine() {
  rl.question('automerge> ', (line) => {
    const [ cmd, ...args ] = line.trim().split(/ +/)
    console.log(cmd, args)
    if(cmd === 'subscribe' || cmd === 's') {
      subscribe(args)
    } else if(['c', 'ch', 'change'].includes(cmd)) {
      change(args)
    } else {
      console.error('Unknown command "'+cmd+'"')
    }
  
    handleLine()
  });
}
handleLine()

function subscribe(args) {
  client.subscribe(args)
}

function change(args) {
  const id = args[0]
  client.docSet.setDoc(id, Automerge.change(client.docSet.getDoc(id), doc => {
    doc[args[1]] = args[2]
  }))
}
