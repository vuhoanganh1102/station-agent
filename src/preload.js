const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentAPI", {
  // Get screen sources - uses 'once' to prevent listener accumulation
  getSources: () => ipcRenderer.invoke("get-sources"),
  onSourcesList: (callback) => {
    ipcRenderer.removeAllListeners("sources-list"); // remove old listeners
    ipcRenderer.once("sources-list", (event, sources) => callback(sources)); // fire once only
  },

  // Screen sharing control
  onStartScreenShare: (callback) =>
    ipcRenderer.on("start-screen-share", (event, data) => callback(data)),
  onStopScreenShare: (callback) =>
    ipcRenderer.on("stop-screen-share", (event, data) => callback(data)),

  // WebRTC signaling
  onWebRTCOffer: (callback) =>
    ipcRenderer.on("webrtc-offer", (event, data) => callback(data)),
  onWebRTCAnswer: (callback) =>
    ipcRenderer.on("webrtc-answer", (event, data) => callback(data)),
  onWebRTCIceCandidate: (callback) =>
    ipcRenderer.on("webrtc-icecandidate", (event, data) => callback(data)),

  sendOffer: (data) => ipcRenderer.send("webrtc-offer", data),
  sendAnswer: (data) => ipcRenderer.send("webrtc-answer", data),
  sendIceCandidate: (data) => ipcRenderer.send("webrtc-icecandidate", data),

  // Remote control
  onMouseMove: (callback) =>
    ipcRenderer.on("remote-mouse-move", (event, data) => callback(data)),
  onMouseClick: (callback) =>
    ipcRenderer.on("remote-mouse-click", (event, data) => callback(data)),
  onMouseScroll: (callback) =>
    ipcRenderer.on("remote-mouse-scroll", (event, data) => callback(data)),
  onKeyTap: (callback) =>
    ipcRenderer.on("remote-key-tap", (event, data) => callback(data)),
  onKeyType: (callback) =>
    ipcRenderer.on("remote-key-type", (event, data) => callback(data)),

  // Management
  onLock: (callback) => ipcRenderer.on("lock-station", (event) => callback()),
  onUnlock: (callback) =>
    ipcRenderer.on("unlock-station", (event) => callback()),
  onShowMessage: (callback) =>
    ipcRenderer.on("show-message", (event, data) => callback(data)),

  // Screenshot
  onTakeScreenshot: (callback) =>
    ipcRenderer.on("take-screenshot", (event, data) => callback(data)),
  sendScreenshot: (data) => ipcRenderer.send("screenshot-ready", data),
});
