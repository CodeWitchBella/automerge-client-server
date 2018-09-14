import Automerge, { DocSet } from 'automerge'

export default class AutomergeClient {
  constructor({ socket } = {}) {
    if(!socket) throw new Error('You have to specify websocket as socket param')
    this.socket = socket

    const docSet = this.docSet = new DocSet()
    docSet.registerHandler((docId, doc) => {
      console.log(docId, doc)
    })

    const autocon = new Automerge.Connection(docSet, (data) => {
      socket.send(JSON.stringify({ action: 'automerge', data }))
    })

    socket.addEventListener('message', msg => {
      const frame = JSON.parse(msg.data)
      console.log('message', frame)

      if(frame.action === 'automerge') {
        autocon.receiveMsg(frame.data)
      } else if(frame.action === 'error') {
        console.error('Recieved server-side error '+frame.message)
      } else if(frame.action === 'subscribed') {
        console.error('Subscribed to '+JSON.stringify(frame.id))
      } else {
        console.error('Unknown action "'+frame.action+'"')
      }
    })

    socket.addEventListener('open', () => {
      console.log('open')
      autocon.open()
      //socket.send(JSON.stringify({ action: 'register', docs: this.props.docs }))
    })
    socket.addEventListener('close', () => {
      console.log('close')
      autocon.close()
    })
    socket.addEventListener('error', evt => console.log('error', evt))
    socket.addEventListener('connecting', (evt) => console.log('connecting', evt))
  }

  subscribe(ids) {
    console.log('Trying to subscribe to '+JSON.stringify(ids))
    this.socket.send(JSON.stringify({ action: 'subscribe', ids }))
  }
}
