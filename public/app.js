class WhatsAppBotApp {
  constructor() {
    this.currentUserId = null
    this.activeSection = "dashboard"
    this.sessions = new Map()
    this.messageHistory = []
    this.isCheckingConnection = false
    this.isGettingQR = false
    this.connectionNotified = false
    this.stats = {
      totalSessions: 0,
      totalMessages: 0,
      uptime: 0,
      systemStatus: "Isolated",
    }

    this.init()
  }

  init() {
    this.bindEvents()
    this.loadFromStorage()
    this.startPeriodicUpdates()
    this.updateStats()
    this.showSection("dashboard")
  }

  bindEvents() {
    // Navigation events
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault()
        const section = link.dataset.section
        if (section) {
          this.showSection(section)
        }
      })
    })

    // Dashboard quick create
    document.getElementById("quickCreateBtn").addEventListener("click", () => {
      const userId = document.getElementById("quickUserId").value.trim()
      if (userId) {
        this.createSession(userId)
      }
    })

    document.getElementById("quickUserId").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const userId = e.target.value.trim()
        if (userId) {
          this.createSession(userId)
        }
      }
    })

    // Session management
    document.getElementById("createSessionBtn").addEventListener("click", () => {
      const userId = document.getElementById("sessionUserId").value.trim()
      if (userId) {
        this.createSession(userId)
      }
    })

    document.getElementById("sessionUserId").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const userId = e.target.value.trim()
        if (userId) {
          this.createSession(userId)
        }
      }
    })

    document.getElementById("refreshSessions").addEventListener("click", () => {
      this.loadSessions()
    })

    // Message form
    document.getElementById("messageForm").addEventListener("submit", (e) => {
      e.preventDefault()
      this.sendMessage()
    })

    document.getElementById("clearMessage").addEventListener("click", () => {
      this.clearMessageForm()
    })

    // File upload
    document.getElementById("mediaFile").addEventListener("change", (e) => {
      this.handleFileSelect(e)
    })

    document.getElementById("removeFile").addEventListener("click", () => {
      this.removeFile()
    })

    // File upload drag & drop
    const fileUploadArea = document.getElementById("fileUploadArea")
    fileUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault()
      fileUploadArea.classList.add("drag-over")
    })

    fileUploadArea.addEventListener("dragleave", () => {
      fileUploadArea.classList.remove("drag-over")
    })

    fileUploadArea.addEventListener("drop", (e) => {
      e.preventDefault()
      fileUploadArea.classList.remove("drag-over")
      const files = e.dataTransfer.files
      if (files.length > 0) {
        document.getElementById("mediaFile").files = files
        this.handleFileSelect({ target: { files } })
      }
    })

    // History
    document.getElementById("historySession").addEventListener("change", (e) => {
      this.loadMessageHistory(e.target.value)
    })

    document.getElementById("refreshHistory").addEventListener("click", () => {
      const sessionId = document.getElementById("historySession").value
      if (sessionId) {
        this.loadMessageHistory(sessionId)
      }
    })

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
      this.logout()
    })
  }

  async createSession(userId) {
    if (!userId || userId.trim().length === 0) {
      this.showToast("Please enter a valid User ID", "error")
      return
    }

    this.showLoading(true)

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userId.trim() }),
      })

      const data = await response.json()

      if (data.status) {
        this.currentUserId = userId.trim()
        this.saveToStorage()
        this.showToast("Your personal session created successfully!", "success")
        this.updateUserInfo()
        this.addActivity(`Personal session created for ${userId}`)

        // Clear input fields
        document.getElementById("quickUserId").value = ""
        document.getElementById("sessionUserId").value = ""

        // Show QR section and start checking
        this.showQRSection()
        this.checkConnection()

        // Update sessions list
        this.loadSessions()
      } else {
        if (response.status === 409) {
          this.showToast("You already have a session. Only one session per person is allowed.", "warning")
        } else {
          this.showToast(data.message, "error")
        }
      }
    } catch (error) {
      console.error("Create session error:", error)
      this.showToast("Failed to create session: " + error.message, "error")
    } finally {
      this.showLoading(false)
    }
  }

  async checkConnection() {
    if (!this.currentUserId || this.isCheckingConnection) return

    this.isCheckingConnection = true

    try {
      const response = await fetch(`/api/sessions/${this.currentUserId}/status`)
      const data = await response.json()

      if (data.connected) {
        this.hideQRSection()
        this.showMessageInterface()

        // Only show success toast once
        if (!this.connectionNotified) {
          this.showToast("Your WhatsApp connected successfully!", "success")
          this.addActivity(`${this.currentUserId} connected to WhatsApp`)
          this.connectionNotified = true
        }
        this.updateStats()
      } else {
        this.connectionNotified = false
        this.getQRCode()
      }
    } catch (error) {
      console.error("Connection check error:", error)
      setTimeout(() => {
        this.isCheckingConnection = false
        this.checkConnection()
      }, 5000)
      return
    }

    this.isCheckingConnection = false
  }

  async getQRCode() {
    if (!this.currentUserId || this.isGettingQR) return

    this.isGettingQR = true

    try {
      const response = await fetch(`/api/sessions/${this.currentUserId}/qr`)
      const data = await response.json()

      if (data.qr) {
        document.getElementById("qrContainer").innerHTML = `
          <img src="${data.qr}" alt="QR Code" style="max-width: 300px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);" />
        `
        document.getElementById("qrStatus").textContent = "Scan QR code with your WhatsApp"

        setTimeout(() => {
          this.isGettingQR = false
          this.getQRCode()
        }, 5000)
      } else if (data.connected) {
        this.hideQRSection()
        this.showMessageInterface()
        if (!this.connectionNotified) {
          this.showToast("Your WhatsApp connected!", "success")
          this.connectionNotified = true
        }
        this.isGettingQR = false
      } else {
        document.getElementById("qrContainer").innerHTML = `
          <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Generating your personal QR Code...</p>
          </div>
        `
        setTimeout(() => {
          this.isGettingQR = false
          this.getQRCode()
        }, 3000)
      }
    } catch (error) {
      console.error("QR code error:", error)
      setTimeout(() => {
        this.isGettingQR = false
        this.getQRCode()
      }, 5000)
    }
  }

  async sendMessage() {
    const phoneNumber = document.getElementById("phoneNumber").value.trim()
    const messageText = document.getElementById("messageText").value.trim()
    const fileInput = document.getElementById("mediaFile")
    const file = fileInput.files[0]

    if (!phoneNumber) {
      this.showToast("Phone number is required", "error")
      return
    }

    if (!messageText && !file) {
      this.showToast("Message or file is required", "error")
      return
    }

    this.showLoading(true)

    try {
      let response

      if (file) {
        const formData = new FormData()
        formData.append("number", phoneNumber)
        formData.append("message", messageText)
        formData.append("file", file)

        response = await fetch(`/api/sessions/${this.currentUserId}/messages/media`, {
          method: "POST",
          body: formData,
        })
      } else {
        response = await fetch(`/api/sessions/${this.currentUserId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: phoneNumber,
            message: messageText,
          }),
        })
      }

      const data = await response.json()

      if (data.status) {
        // Show appropriate message based on whether it's being sent or already sent
        if (data.data && data.data.sending) {
          this.showToast("Message is being sent from your session...", "info")
        } else {
          this.showToast("Message sent successfully from your session!", "success")
        }

        this.addToMessageHistory(phoneNumber, messageText, file)
        this.clearMessageForm()
        this.addActivity(`Message sent to ${phoneNumber} from your session`)
        this.updateStats()

        // Check message status after a delay
        setTimeout(() => {
          this.checkMessageStatus(phoneNumber, messageText)
        }, 5000)
      } else {
        this.showToast(data.message, "error")
      }
    } catch (error) {
      console.error("Send message error:", error)
      this.showToast("Failed to send message from your session: " + error.message, "error")
    } finally {
      this.showLoading(false)
    }
  }

  async checkMessageStatus(phoneNumber, messageText) {
    try {
      const response = await fetch(`/api/sessions/${this.currentUserId}/pending`)
      const data = await response.json()

      if (data.status && data.data.pending.length > 0) {
        const recentPending = data.data.pending.find(
          (p) => p.to.includes(phoneNumber.replace(/\D/g, "")) && p.content === messageText,
        )

        if (recentPending) {
          if (recentPending.status === "sent") {
            this.showToast("Message delivered successfully!", "success")
          } else if (recentPending.status === "failed") {
            this.showToast(`Message failed: ${recentPending.error}`, "error")
          }
        }
      }
    } catch (error) {
      console.error("Check message status error:", error)
    }
  }

  async loadSessions() {
    try {
      const response = await fetch("/api/sessions")
      const data = await response.json()

      this.displaySessions(data.sessions || [])
      this.updateHistorySessionSelect(data.sessions || [])
      this.stats.totalSessions = data.sessions?.length || 0
      this.updateStatsDisplay()
    } catch (error) {
      console.error("Load sessions error:", error)
    }
  }

  async loadMessageHistory(sessionId) {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/sessions/${sessionId}/history`)
      const data = await response.json()

      if (data.status) {
        this.displayMessageHistory(data.data.messages || [])
      }
    } catch (error) {
      console.error("Load history error:", error)
    }
  }

  async logout() {
    if (!this.currentUserId) return

    this.showLoading(true)

    try {
      const response = await fetch(`/api/sessions/${this.currentUserId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.status) {
        this.addActivity(`${this.currentUserId} logged out`)
        this.currentUserId = null
        this.clearStorage()
        this.updateUserInfo()
        this.hideQRSection()
        this.hideMessageInterface()
        this.showToast("Logged out successfully from your session", "success")
        this.loadSessions()
      } else {
        this.showToast(data.message, "error")
      }
    } catch (error) {
      console.error("Logout error:", error)
      this.showToast("Failed to logout from your session: " + error.message, "error")
    } finally {
      this.showLoading(false)
    }
  }

  displaySessions(sessions) {
    const sessionsList = document.getElementById("sessionsList")

    if (sessions.length === 0) {
      sessionsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user"></i>
          <p>No active session</p>
          <small>Create your personal session to get started</small>
        </div>
      `
      return
    }

    // Only show sessions that belong to the current user
    const userSessions = sessions.filter((session) => !this.currentUserId || session.userId === this.currentUserId)

    sessionsList.innerHTML = userSessions
      .map(
        (session) => `
      <div class="session-item">
        <div class="session-info">
          <div class="session-avatar">
            ${session.userId.charAt(0).toUpperCase()}
          </div>
          <div class="session-details">
            <h4>${session.userId} ${session.userId === this.currentUserId ? "(Your Session)" : ""}</h4>
            <p>Created: ${new Date(session.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div class="session-status ${session.connected ? "connected" : "disconnected"}">
          <i class="fas fa-circle"></i>
          ${session.connected ? "Connected" : "Disconnected"}
        </div>
        <div class="session-actions">
          ${
            session.userId === this.currentUserId
              ? `<button class="btn btn-danger btn-sm" onclick="app.logout()">
              <i class="fas fa-sign-out-alt"></i> Logout
            </button>`
              : `<button class="btn btn-primary btn-sm" onclick="app.switchSession('${session.userId}')" disabled>
              <i class="fas fa-ban"></i> Private
            </button>`
          }
        </div>
      </div>
    `,
      )
      .join("")
  }

  displayMessageHistory(messages) {
    const messageHistory = document.getElementById("messageHistory")

    if (messages.length === 0) {
      messageHistory.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-comments"></i>
          <p>No messages found</p>
          <small>Your personal message history will appear here</small>
        </div>
      `
      return
    }

    messageHistory.innerHTML = messages
      .map(
        (msg) => `
      <div class="message-item ${msg.type}">
        <div class="message-avatar">
          ${msg.type === "sent" ? "S" : "R"}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-contact">
              ${msg.type === "sent" ? msg.to : msg.from}
            </span>
            <span class="message-time">
              ${new Date(msg.timestamp).toLocaleString()}
            </span>
            ${msg.status ? `<span class="message-status status-${msg.status}">${msg.status}</span>` : ""}
          </div>
          <div class="message-body">${msg.body || "No text content"}</div>
          ${
            msg.hasMedia
              ? `<div class="message-media">
            <i class="fas fa-paperclip"></i> 
            ${msg.fileName || "Media attachment"}
          </div>`
              : ""
          }
          ${msg.error ? `<div class="message-error">Error: ${msg.error}</div>` : ""}
        </div>
      </div>
    `,
      )
      .join("")
  }

  updateHistorySessionSelect(sessions) {
    const select = document.getElementById("historySession")

    // Only show the current user's session
    const userSessions = sessions.filter((session) => !this.currentUserId || session.userId === this.currentUserId)

    select.innerHTML =
      '<option value="">Select Your Session</option>' +
      userSessions
        .map((session) => `<option value="${session.userId}">${session.userId} (Your Session)</option>`)
        .join("")
  }

  switchSession(userId) {
    // Prevent switching to other users' sessions
    if (userId !== this.currentUserId) {
      this.showToast("You can only access your own session", "error")
      return
    }

    this.currentUserId = userId
    this.saveToStorage()
    this.updateUserInfo()
    this.checkConnection()
    this.showToast(`Switched to your session: ${userId}`, "success")
  }

  handleFileSelect(event) {
    const file = event.target.files[0]
    if (file) {
      const fileName = file.name
      const fileSize = (file.size / 1024 / 1024).toFixed(2)

      document.getElementById("fileName").textContent = `${fileName} (${fileSize} MB)`
      document.getElementById("filePreview").style.display = "block"

      // Hide upload placeholder
      document.querySelector(".upload-placeholder").style.display = "none"
    }
  }

  removeFile() {
    document.getElementById("mediaFile").value = ""
    document.getElementById("filePreview").style.display = "none"
    document.querySelector(".upload-placeholder").style.display = "block"
  }

  clearMessageForm() {
    document.getElementById("phoneNumber").value = ""
    document.getElementById("messageText").value = ""
    this.removeFile()
  }

  addToMessageHistory(phone, message, file) {
    const historyItem = {
      type: "sent",
      to: phone,
      body: message,
      hasMedia: !!file,
      fileName: file?.name,
      timestamp: new Date(),
      status: "sending",
    }

    this.messageHistory.unshift(historyItem)
    this.stats.totalMessages++
    this.saveToStorage()
  }

  showSection(sectionId) {
    // Update navigation
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active")
    })
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add("active")

    // Show section
    document.querySelectorAll(".section").forEach((section) => {
      section.classList.remove("active")
    })
    document.getElementById(sectionId)?.classList.add("active")

    this.activeSection = sectionId

    // Load data for specific sections
    if (sectionId === "sessions") {
      this.loadSessions()
    } else if (sectionId === "history") {
      this.loadSessions() // For session select
    }
  }

  showQRSection() {
    document.getElementById("qrSection").style.display = "block"
  }

  hideQRSection() {
    document.getElementById("qrSection").style.display = "none"
  }

  showMessageInterface() {
    document.getElementById("messageInterface").style.display = "block"
    document.getElementById("noSessionMessage").style.display = "none"
    document.getElementById("currentSessionId").textContent = `${this.currentUserId} (Your Session)`
  }

  hideMessageInterface() {
    document.getElementById("messageInterface").style.display = "none"
    document.getElementById("noSessionMessage").style.display = "block"
  }

  updateUserInfo() {
    const userSpan = document.getElementById("activeUser")
    const logoutBtn = document.getElementById("logoutBtn")

    if (this.currentUserId) {
      userSpan.textContent = `${this.currentUserId} (Your Session)`
      logoutBtn.style.display = "block"
    } else {
      userSpan.textContent = "No Active Session"
      logoutBtn.style.display = "none"
    }
  }

  showLoading(show) {
    const overlay = document.getElementById("loadingOverlay")
    if (show) {
      overlay.classList.add("show")
    } else {
      overlay.classList.remove("show")
    }
  }

  showToast(message, type = "success") {
    // Remove existing toasts with same message to prevent duplicates
    const existingToasts = document.querySelectorAll(".toast")
    existingToasts.forEach((toast) => {
      if (toast.textContent.includes(message)) {
        toast.remove()
      }
    })

    const toast = document.createElement("div")
    toast.className = `toast toast-${type}`

    const icon =
      type === "success"
        ? "check-circle"
        : type === "error"
          ? "exclamation-circle"
          : type === "info"
            ? "info-circle"
            : type === "warning"
              ? "exclamation-triangle"
              : "info-circle"
    const iconColor =
      type === "success"
        ? "#27ae60"
        : type === "error"
          ? "#e74c3c"
          : type === "info"
            ? "#3498db"
            : type === "warning"
              ? "#f39c12"
              : "#3498db"

    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-${icon}" style="color: ${iconColor}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.closest('.toast').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `

    const container = document.getElementById("toastContainer")
    container.appendChild(toast)

    // Animate in
    setTimeout(() => {
      toast.classList.add("toast-show")
    }, 10)

    // Auto remove after 4 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove("toast-show")
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove()
          }
        }, 300)
      }
    }, 4000)
  }

  addActivity(message) {
    const activityList = document.getElementById("recentActivity")
    const activityItem = document.createElement("div")
    activityItem.className = "activity-item"
    activityItem.innerHTML = `
      <i class="fas fa-info-circle"></i>
      <span>${message}</span>
      <small>${new Date().toLocaleTimeString()}</small>
    `

    activityList.insertBefore(activityItem, activityList.firstChild)

    // Keep only last 10 activities
    const activities = activityList.querySelectorAll(".activity-item")
    if (activities.length > 10) {
      activities[activities.length - 1].remove()
    }
  }

  async updateStats() {
    try {
      const response = await fetch("/api/health")
      const data = await response.json()

      this.stats.uptime = data.uptime
      this.stats.systemStatus = data.status === "healthy" ? "Isolated" : "Issues"
      this.stats.totalSessions = data.activeSessions || 0

      this.updateStatsDisplay()
    } catch (error) {
      console.error("Stats update error:", error)
    }
  }

  updateStatsDisplay() {
    document.getElementById("totalSessions").textContent = this.currentUserId ? "1" : "0"
    document.getElementById("totalMessages").textContent = this.stats.totalMessages
    document.getElementById("systemStatus").textContent = this.stats.systemStatus

    // Format uptime
    const hours = Math.floor(this.stats.uptime / 3600)
    const minutes = Math.floor((this.stats.uptime % 3600) / 60)
    document.getElementById("uptime").textContent = `${hours}h ${minutes}m`
  }

  startPeriodicUpdates() {
    // Clear existing intervals
    if (this.statsInterval) clearInterval(this.statsInterval)
    if (this.connectionInterval) clearInterval(this.connectionInterval)

    // Update stats every 30 seconds
    this.statsInterval = setInterval(() => {
      this.updateStats()
    }, 30000)

    // Check connection every 15 seconds if we have an active session
    this.connectionInterval = setInterval(() => {
      if (this.currentUserId && !this.isCheckingConnection) {
        this.checkConnection()
      }
    }, 15000)
  }

  saveToStorage() {
    const data = {
      currentUserId: this.currentUserId,
      messageHistory: this.messageHistory,
      stats: this.stats,
    }
    localStorage.setItem("whatsappBotApp", JSON.stringify(data))
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem("whatsappBotApp")
      if (saved) {
        const data = JSON.parse(saved)
        this.currentUserId = data.currentUserId
        this.messageHistory = data.messageHistory || []
        this.stats = { ...this.stats, ...data.stats }

        this.updateUserInfo()
        this.updateStatsDisplay()

        if (this.currentUserId) {
          this.checkConnection()
        }
      }
    } catch (error) {
      console.error("Load from storage error:", error)
    }
  }

  clearStorage() {
    localStorage.removeItem("whatsappBotApp")
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new WhatsAppBotApp()
})

// Add some CSS for drag and drop and message status
const style = document.createElement("style")
style.textContent = `
  .file-upload-area.drag-over {
    border-color: var(--primary-color) !important;
    background: rgba(37, 211, 102, 0.1) !important;
  }
  
  .toast {
    animation: slideInRight 0.3s ease;
    margin-bottom: 0.5rem;
    border-radius: 12px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(10px);
    background: rgba(255,255,255,0.95);
  }
  
  .toast.toast-success {
    border-left: 4px solid #27ae60;
  }
  
  .toast.toast-error {
    border-left: 4px solid #e74c3c;
  }
  
  .toast.toast-info {
    border-left: 4px solid #3498db;
  }
  
  .toast.toast-warning {
    border-left: 4px solid #f39c12;
  }
  
  .message-status {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .status-sent {
    background: rgba(39, 174, 96, 0.2);
    color: #27ae60;
  }
  
  .status-failed {
    background: rgba(231, 76, 60, 0.2);
    color: #e74c3c;
  }
  
  .status-sending {
    background: rgba(52, 152, 219, 0.2);
    color: #3498db;
  }
  
  .message-error {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #e74c3c;
    font-style: italic;
  }
  
  .privacy-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .privacy-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(37, 211, 102, 0.1);
    border-radius: 8px;
    border-left: 3px solid var(--primary-color);
  }
  
  .privacy-item i {
    color: var(--primary-color);
    width: 20px;
  }
  
  .privacy-notice {
    margin-top: 1rem;
    padding: 0.75rem;
    background: rgba(37, 211, 102, 0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .privacy-notice i {
    color: var(--primary-color);
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .message-history {
    scrollbar-width: thin;
    scrollbar-color: var(--primary-color) transparent;
  }
  
  .message-history::-webkit-scrollbar {
    width: 6px;
  }
  
  .message-history::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .message-history::-webkit-scrollbar-thumb {
    background: var(--primary-color);
    border-radius: 3px;
  }
`
document.head.appendChild(style)
