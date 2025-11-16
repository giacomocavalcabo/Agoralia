export function createReconnectingWebSocket(url, {
  maxRetries = 8,
  backoffBaseMs = 500,
  onOpen,
  onMessage,
  onClose,
  onError,
} = {}) {
  let ws
  let retries = 0
  let closedByUser = false

  function connect() {
    ws = new WebSocket(url)
    ws.onopen = (ev) => {
      retries = 0
      onOpen && onOpen(ev)
    }
    ws.onmessage = (ev) => onMessage && onMessage(ev)
    ws.onerror = (ev) => onError && onError(ev)
    ws.onclose = (ev) => {
      onClose && onClose(ev)
      if (closedByUser) return
      if (retries >= maxRetries) return
      const delay = Math.min(10000, backoffBaseMs * Math.pow(2, retries))
      retries += 1
      setTimeout(connect, delay)
    }
  }
  connect()

  return {
    close: () => { closedByUser = true; try { ws && ws.close() } catch {} },
    get instance() { return ws }
  }
}


