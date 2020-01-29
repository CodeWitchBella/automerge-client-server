# Automerge Client-Server 

This project builds on [Automerge](https://github.com/automerge/automerge) to provide server-centered synchronization features. This is especially useful when providing access control to users. 

The project currently provides: 

* loading and saving documents on server-side (via provided functions)
* It allows different clients to sync different documents
* Document-level access control (very under-tested)
* Offline-first client (will sync after reconnect using reconnecting-websocket)

## Client API 

``` 
const client = new AutomergeClient({
  // websocket
  socket,
  // string with data which were saved with save. like localStorage.getItem('automerge')
  savedData, 
  // function which accepts string to save
  save: data => ...,
  // called when doc changes (locally or remotely)
  onChange: (id, doc) => ...,
})
client.subscribe(['a', 'b']) // begins sync of a and b
client.change('a', doc => ...) // changes document a
```

The ```websocket``` can be any regular socket, however in the example projects a ```reconnecting-websocket``` is used. 

Subscribing to a document will update the client ```docSet```, an automerge concept used to keep track of document synchronization with the server instance. 

Once you subscribe to a document, the client will sync even after the instance has been closed. On re-opening, these documents will update to the latest version. 

The library implements ```pause()``` and ```resume()``` functions in case you need to temporarily disable the automatic updates on your document. 

## Server API

```
const server = new AutomergeServer({
  // return promise of 
  //  - false (failed to load) 
  //  - or string (loaded saved doc)
  //  - or null (new document)
  loadDocument: (id) => ..., 
  // text is what should be saved (and later returned from load).
  // Doc contains automerge document (usefull for saving in other formats)
  saveDocument: (id, text, doc) => ...,
  // Returns promise of true (access granted) or false (access denied)
  checkAccess: (id, req) => ..., 
})
// in wss.on('connection')
server.handleSocket(ws, req)
```

The server is mainly an interface on saving automerge documents by serializing them, loading and providing access control. 

The access control function needs to be implemented according to the project needs. 