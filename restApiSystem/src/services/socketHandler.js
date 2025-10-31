const connectedUsers = new Map()
const allowedUseridList = ['11000']

function logoutMultipleConnections(userId, currentSocketId) {
  if (allowedUseridList.includes(`${userId}`)) return false
  let duplicateCount = 0
  connectedUsers.forEach((userData, socketId) => {
    if (userData.userId === userId && socketId !== currentSocketId) {
      // console.info('authenticated', false)
      // socket.emit('authenticated', {status: false})
      // userData.socket.emit('authenticated', {status: false})
      // userData.socket.disconnect(true)
      // connectedUsers.delete(currentSocketId)
      duplicateCount++
    }
  })
  return duplicateCount > 0
}

function SocketHandler() {
  return {init}

  function init(io, express) {
    io.on('connection', (socket) => {
      //console.log('socket handler: connection', socket.id)

      socket.on('authenticate', (userData) => {
        const { userId } = userData
        connectedUsers.set(socket.id, { userId })
        const duplicated = logoutMultipleConnections(userId, socket.id)
        // //console.log('authenticate', connectedUsers)
        if (duplicated) {
          //console.log('duplicated')
          socket.emit('authenticated', {status: false})
          socket.disconnect(true)
        } else {
          //console.log('no duplicated')
          socket.emit('authenticated', {status: true})
        }
      })

      socket.on('disconnect', (reason) => {
        //console.log(`socket handler: disconnect ${socket.id}`)
        connectedUsers.delete(socket.id)
      });
    })
  }
}

module.exports = SocketHandler