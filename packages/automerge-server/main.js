import Automerge, { DocSet } from 'automerge'

/*
 * checkAccess: (id: string, req: Request) => Promise<boolean>
 * loadDocument: (id: string) => Promise<string | false | AutomergeDoc>
 * saveDocument: (id: string, document: string) => Promise<void>
 */

/*

# Protocol

## Same in both directions

Object with key action. Other keys depend on action

### automerge

frame.data is forwarded to automerge

### error

prints the error

## Client to server

### subscribe

subscribes to documents identified by frame.ids

### unsubscribe

unsubscribes from documents identified by frame.ids

## Server to client

### subscribed

Sent after successful subscription. Contains id field as doc identifier.

*/

class Document {
  constructor(id) {
    this.sets = [] // { set, handler }
    this.id = id
  }

  set(doc) {
    this.doc = doc
    for (const set of this.sets) {
      set.setDoc(this.id, this.doc)
    }
    return this
  }

  addToSet(docSet) {
    if(this.sets.some(set => set.set === docSet)) {
      // prevent adding twice
      return
    }

    docSet.setDoc(this.id, this.doc)

    const handler = (docId, doc) => {
      this.sets.forEach(other => {
        if(other.set === docSet) return
        other.set.setDoc(docId, doc)
      })
    }
    docSet.registerHandler(handler)
    this.sets.push({ set: docSet, handler })
  }

  removeFromSet(docSet) {
    const set = this.sets.find(set => set.set === docSet)
    if(!set) return // this doc is not in specified set

    docSet.unregisterHandler(set.handler)
    this.sets = this.sets.filter(set => set.set !== docSet)
  }
}

export default class AutomergeServer {
  constructor({
    loadDocument,
    saveDocument,
    checkAccess = (id, req) => Promise.resolve(true)
  }) {
    if(typeof loadDocument !== 'function')
      throw new Error('loadDocument option must be function')
    if(typeof saveDocument !== 'function')
      throw new Error('saveDocument option must be function')

    this.loadDocument = loadDocument
    this.saveDocument = saveDocument
    this.checkAccess = checkAccess

    this.docs = {}
  }

  getDoc(id) {
    if(this.docs[id]) return this.docs[id]
    this.docs[id] = Promise.resolve(this.loadDocument(id))
      .then(doc => {
        if(doc === false) return false // 404

        // ok
        if(typeof doc === 'string') {
          // string means loading previously save doc
          return Automerge.load(doc)
        }
        if(!doc) {
          // if falsy create new empty document 
          return Automerge.init()
        }
        // if not falsy nor string we expect automerge document
        // created via Automerge.init()
        return doc
      }).then(doc => {
        if(doc === false) return false // 404
        return new Document(id).set(doc)
      })
    return this.docs[id]
  }

  handleSocket(ws, req) {
    console.log('open')
    const docSet = new DocSet()

    docSet.registerHandler((id, doc) => console.log('handler', id, doc))

    let subscribedDocuments = [] // Document[]
    let subscribingDocuments = [] // { id: string, cancel: boolean }[]
    const removeFromSubscribedDocuments = (id) => {
      subscribingDocuments = subscribingDocuments.filter(d => d.id !== id)
      subscribedDocuments = subscribedDocuments.filter(d => d.id !== id)
    }

    const send = (action, data) =>
      console.log('sending',action,data) ||
      ws.send(JSON.stringify({ action, ...data }))

    const autocon = new Automerge.Connection(docSet, (data) => {
      send('automerge', { data })
    })

    const subscribeToDoc = (id) => {
      if (subscribingDocuments.some(a => a.id === id) || subscribedDocuments.some(a => a.id === id)) {
        send('error', {
          message: 'Already subscribed or subscribing',
          id,
        })
        return
      }
      subscribingDocuments.push({ id, cancel: false })
      
      this.checkAccess(id, req)
      .then(access => {
        if(access) {
          return this.getDoc(id)
        } else {
          send('error', {
            message: 'Access denied',
            id,
          })
          removeFromSubscribedDocuments(id)
          return null
        }
      })
      .then(doc => {
        if(doc === null) return
        if(doc === false) {
          // 404
          send('error', {
            message: 'Document not found',
            id,
          })
          removeFromSubscribedDocuments(id)
        } else {
          const { cancel } = subscribingDocuments.find(d => d.id === id)
          if(!cancel) {
            doc.addToSet(docSet)
            subscribedDocuments.push(doc)
            send('subscribed', { id })
          }
          subscribingDocuments = subscribingDocuments.filter(d => d.id !== id)
        }
      })
      .catch(e => {
        removeFromSubscribedDocuments(id)
        send('error', {
          message: 'Internal server error',
          id,
        })
        console.error('Error occurred while checking access for '+id)
        console.error(e)
      })
    }

    const unsubscribe = (id) => {
      const subscribing = subscribingDocuments.find(d => d.id === id)
      if(subscribing) {
        subscribing.cancel = true
      } else {
        const subscribed = subscribedDocuments.find(d => d.id === id)
        subscribed.removeFromSet(docSet)
        subscribedDocuments = subscribedDocuments.filter(d => d.id !== id)
      }
    }

    const handleFrame = (frame) => {
      console.log('handling', frame)
      if(frame.action === 'automerge') {
        autocon.receiveMsg(frame.data)
      } else if(frame.action === 'error') {
        console.error('Recieved error frame from client', frame)
      } else if(frame.action === 'subscribe') {
        frame.ids.forEach(id => subscribeToDoc(id))
      } else if(frame.action === 'unsubscribe') {
        frame.ids.forEach(id => unsubscribe(id))
      } else {
        send('error', {
          message: 'Unknown action '+frame.action
        })
      }
    }

    ws.on('message', message => {
      try {
        const frame = JSON.parse(message.toString())
        if(typeof frame === 'object' && frame !== null) {
          handleFrame(frame)
        }
      } catch(e) {
        console.error(e)
      }
    })

    autocon.open()

    ws.on('close', () => {
      console.log('close')
      autocon.close()
      subscribedDocuments.forEach(doc => doc.removeFromSet(docSet))
    })
  }
}