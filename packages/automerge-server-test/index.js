const AutomergeServer = require('automerge-server').default
const http = require('http')
const WebSocket = require('ws')
const Automerge = require('automerge')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const dir = path.join(__dirname, 'docs')
try {
  fs.mkdirSync(dir)
} catch (e) {
  if (e.code !== 'EEXIST') throw e
}

function fname(id) {
  return path.join(dir, id + '.json')
}

const automergeServer = new AutomergeServer({
  loadDocument: async id => {
    if (/[a-z]+/.exec(id)) {
      try {
        return await promisify(fs.readFile)(fname(id), 'utf8')
      } catch (e) {
        if (e.code === 'ENOENT') return null // create new
        return false // 404
      }
    }

    return Promise.resolve(false)
  },
  saveDocument: (id, text) => {
    console.log('Saving', id)
    if (/[a-z]+/.exec(id)) {
      return promisify(fs.writeFile)(fname(id), text, 'utf8')
    }
    return Promise.resolve()
  },
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
