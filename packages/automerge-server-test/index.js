const AutomergeServer = require('automerge-server').default
const http = require('http')
const WebSocket = require('ws')
const Automerge = require('automerge')

const automergeServer = new AutomergeServer({
  loadDocument: (id) => {
    if(id === 'one') {
      return Promise.resolve(Automerge.change(Automerge.init(), d => {
        d.prop = 1
      }))
    }

    return Promise.resolve(false)
  },
  saveDocument: (id, text) => Promise.resolve(),
})

const server = http.createServer()
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws, req) => {
  if (req.url === '/automerge') {
    automergeServer.handleSocket(ws, req)
  } else {
    ws.send('Invalid route')
    ws.close()
  }
})

const PORT = 3000
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`)
})
