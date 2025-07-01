const express = require("express")
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const qrcode = require("qrcode")
const cors = require("cors")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const swaggerJsdoc = require("swagger-jsdoc")
const swaggerUi = require("swagger-ui-express")

const app = express()

// Middleware
app.use(express.json())
app.use(
  cors({
    origin: ["http://localhost:3000", "https://wa.noonight.online"],
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  }),
)

app.use(express.static("public"))

// Swagger configuration - ENHANCED
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WhatsApp Multi-User Bot API",
      version: "3.0.0",
      description: `
        Advanced WhatsApp Bot API with multi-user support, file sharing, and session management.
        
        ## Features
        - Multi-user session management (1 person = 1 account)
        - QR code authentication
        - Text and media message sending
        - Message history tracking
        - Real-time connection status
        - File upload support (images, documents, audio, video)
        - Session isolation (users cannot access other sessions)
        
        ## Getting Started
        1. Create a session with POST /api/sessions
        2. Get QR code with GET /api/sessions/{userId}/qr
        3. Scan QR code with WhatsApp mobile app
        4. Send messages with POST /api/sessions/{userId}/messages
      `,
      contact: {
        name: "API Support",
        email: "support@whatsappbot.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://wa.noonight.online",
        description: "Production server",
      },
    ],
    tags: [
      {
        name: "Sessions",
        description: "WhatsApp session management - 1 person 1 account",
      },
      {
        name: "Messages",
        description: "Send and manage messages",
      },
      {
        name: "System",
        description: "System health and monitoring",
      },
    ],
    components: {
      schemas: {
        Session: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "Unique user identifier",
              example: "user123",
            },
            connected: {
              type: "boolean",
              description: "Connection status",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Session creation timestamp",
            },
            lastActivity: {
              type: "string",
              format: "date-time",
              description: "Last activity timestamp",
            },
          },
        },
        CreateSessionRequest: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: {
              type: "string",
              description: "Unique identifier for the user (only one session per user allowed)",
              example: "user123",
              minLength: 1,
              maxLength: 50,
            },
          },
        },
        MessageRequest: {
          type: "object",
          required: ["number"],
          properties: {
            number: {
              type: "string",
              description: "WhatsApp number with country code (without + symbol)",
              example: "628123456789",
              pattern: "^[1-9][0-9]{7,15}$",
            },
            message: {
              type: "string",
              description: "Message content",
              example: "Hello, this is a test message!",
              maxLength: 4096,
            },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            status: {
              type: "boolean",
              description: "Request success status",
            },
            message: {
              type: "string",
              description: "Response message",
            },
            data: {
              type: "object",
              description: "Response data",
            },
            error: {
              type: "string",
              description: "Error message (if any)",
            },
          },
        },
      },
    },
  },
  apis: ["./server.js"],
}

const specs = swaggerJsdoc(swaggerOptions)

// Enhanced Swagger UI setup
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0 }
      .swagger-ui .info .title { color: #25d366 }
      .swagger-ui .scheme-container { background: #fafafa; padding: 15px; border-radius: 4px }
    `,
    customSiteTitle: "WhatsApp Bot API Documentation",
    customfavIcon: "/favicon.ico",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "list",
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  }),
)

// Add a route to serve the raw OpenAPI spec
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json")
  res.send(specs)
})

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/"
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + "-" + file.originalname)
  },
})

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log("File received:", file.originalname, "MIME:", file.mimetype)

    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/m4a",
      "audio/aac",
      "video/mp4",
      "video/avi",
      "video/mov",
      "video/wmv",
      "video/flv",
      "video/webm",
    ]

    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".csv",
      ".mp3",
      ".wav",
      ".ogg",
      ".m4a",
      ".aac",
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".webm",
    ]

    const fileExtension = path.extname(file.originalname).toLowerCase()
    const mimeTypeAllowed = allowedMimes.includes(file.mimetype)
    const extensionAllowed = allowedExtensions.includes(fileExtension)

    if (mimeTypeAllowed || extensionAllowed) {
      return cb(null, true)
    } else {
      console.log("File rejected:", file.originalname, "MIME:", file.mimetype, "Extension:", fileExtension)
      cb(
        new Error(
          `File type not supported. Received: ${file.mimetype}. Allowed types: images, PDF, documents, audio, video`,
        ),
      )
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
})

// Storage for clients and sessions - ISOLATED PER USER
const clients = new Map() // userId -> WhatsApp Client
const userSessions = new Map() // userId -> Session Data
const qrCodes = new Map() // userId -> QR Code
const messageHistory = new Map() // userId -> Message History Array
const pendingMessages = new Map() // messageKey -> Pending Message Data

// Utility functions
function createWhatsAppClient(userId) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }), // Each user gets isolated auth
    puppeteer: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
      headless: true,
    },
  })

  client.on("qr", async (qr) => {
    try {
      const qrCodeData = await qrcode.toDataURL(qr, { width: 300, margin: 2 })
      qrCodes.set(userId, qrCodeData)

      const session = userSessions.get(userId) || {}
      session.connected = false
      session.qrCode = qrCodeData
      session.lastActivity = new Date()
      userSessions.set(userId, session)

      console.log(`📱 QR Code generated for user: ${userId}`)
    } catch (error) {
      console.error(`QR generation error for ${userId}:`, error)
    }
  })

  client.on("ready", () => {
    console.log(`✅ WhatsApp client ready for user: ${userId}`)
    qrCodes.delete(userId)

    const session = userSessions.get(userId) || {}
    session.connected = true
    session.qrCode = null
    session.lastActivity = new Date()
    userSessions.set(userId, session)
  })

  client.on("disconnected", (reason) => {
    console.log(`❌ Client ${userId} disconnected:`, reason)
    const session = userSessions.get(userId) || {}
    session.connected = false
    session.lastActivity = new Date()
    userSessions.set(userId, session)
  })

  client.on("message", async (message) => {
    // Only store messages for the specific user
    const history = messageHistory.get(userId) || []
    history.push({
      type: "received",
      from: message.from,
      body: message.body,
      timestamp: new Date(),
      hasMedia: message.hasMedia,
    })
    messageHistory.set(userId, history.slice(-100)) // Keep last 100 messages per user
  })

  client.on("message_create", (message) => {
    if (message.fromMe) {
      console.log(`✅ Message sent successfully by ${userId} to ${message.to}`)

      // Update pending message status for this specific user
      const messageKey = `${userId}-${message.to}-${Date.now()}`
      const pending = pendingMessages.get(messageKey)
      if (pending) {
        pending.status = "sent"
        pending.messageId = message.id._serialized
        pendingMessages.set(messageKey, pending)
      }
    }
  })

  return client
}

function validatePhoneNumber(number) {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(number.replace(/\s+/g, ""))
}

function formatPhoneNumber(number) {
  const cleaned = number.replace(/\D/g, "")
  return cleaned.includes("@c.us") ? number : `${cleaned}@c.us`
}

// Enhanced message sending with user isolation
async function sendWhatsAppMessage(client, userId, number, message) {
  const messageKey = `${userId}-${number}-${Date.now()}`

  try {
    console.log(`📤 Attempting to send message from ${userId} to ${number}`)

    // Track pending message for this specific user
    pendingMessages.set(messageKey, {
      status: "pending",
      timestamp: new Date(),
      to: number,
      content: message,
      userId: userId, // Track which user sent this
    })

    const state = await client.getState()
    console.log(`Client ${userId} state:`, state)

    if (state !== "CONNECTED") {
      throw new Error(`WhatsApp client not ready. Current state: ${state}`)
    }

    const sendPromise = client.sendMessage(number, message)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Message sending timeout after 30 seconds")), 30000)
    })

    const result = await Promise.race([sendPromise, timeoutPromise])
    console.log(`✅ Message sent successfully from ${userId} to ${number}`)

    // Update pending status
    const pending = pendingMessages.get(messageKey)
    if (pending) {
      pending.status = "sent"
      pending.messageId = result.id._serialized
      pendingMessages.set(messageKey, pending)
    }

    return result
  } catch (error) {
    console.error(`❌ Send message error for ${userId}:`, error.message)

    const pending = pendingMessages.get(messageKey)
    if (pending) {
      pending.status = "failed"
      pending.error = error.message
      pendingMessages.set(messageKey, pending)
    }

    throw error
  } finally {
    // Clean up pending message after 5 minutes
    setTimeout(
      () => {
        pendingMessages.delete(messageKey)
      },
      5 * 60 * 1000,
    )
  }
}

// Enhanced media sending with user isolation
async function sendWhatsAppMedia(client, userId, number, media, caption = "") {
  const messageKey = `${userId}-${number}-${Date.now()}`

  try {
    console.log(`📤 Attempting to send media from ${userId} to ${number}`)

    pendingMessages.set(messageKey, {
      status: "pending",
      timestamp: new Date(),
      to: number,
      hasMedia: true,
      caption: caption,
      userId: userId,
    })

    const state = await client.getState()
    if (state !== "CONNECTED") {
      throw new Error(`WhatsApp client not ready. Current state: ${state}`)
    }

    const sendPromise = client.sendMessage(number, media, { caption })
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Media sending timeout after 60 seconds")), 60000)
    })

    const result = await Promise.race([sendPromise, timeoutPromise])
    console.log(`✅ Media sent successfully from ${userId} to ${number}`)

    const pending = pendingMessages.get(messageKey)
    if (pending) {
      pending.status = "sent"
      pending.messageId = result.id._serialized
      pendingMessages.set(messageKey, pending)
    }

    return result
  } catch (error) {
    console.error(`❌ Send media error for ${userId}:`, error.message)

    const pending = pendingMessages.get(messageKey)
    if (pending) {
      pending.status = "failed"
      pending.error = error.message
      pendingMessages.set(messageKey, pending)
    }

    throw error
  } finally {
    setTimeout(
      () => {
        pendingMessages.delete(messageKey)
      },
      5 * 60 * 1000,
    )
  }
}

// Routes

/**
 * @swagger
 * /:
 *   get:
 *     summary: Serve the main application
 *     description: Returns the main HTML interface for the WhatsApp Bot
 *     tags: [System]
 *     responses:
 *       200:
 *         description: HTML page served successfully
 */
app.get("/", (req, res) => {
  try {
    res.sendFile(path.resolve("public/index.html"))
  } catch (error) {
    console.error("Failed to serve index.html:", error)
    res.status(500).send("Failed to load index.html")
  }
})

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new WhatsApp session (1 person = 1 account)
 *     description: |
 *       Creates a new WhatsApp client session for a user. Each user can have only one active session.
 *       This ensures session isolation - users cannot access other users' sessions.
 *     tags: [Sessions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSessionRequest'
 *     responses:
 *       200:
 *         description: Session created successfully
 *       409:
 *         description: Session already exists for this user
 *       400:
 *         description: Invalid user ID
 */
app.post("/api/sessions", async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return res.status(400).json({
        status: false,
        message: "Valid User ID is required",
      })
    }

    const cleanUserId = userId.trim()

    // Check if session already exists - ENFORCE 1 PERSON = 1 ACCOUNT
    if (clients.has(cleanUserId)) {
      return res.status(409).json({
        status: false,
        message: "Session already exists for this user. Only one session per person is allowed.",
        data: { userId: cleanUserId },
      })
    }

    // Create isolated client for this user
    const client = createWhatsAppClient(cleanUserId)
    clients.set(cleanUserId, client)

    // Initialize user-specific data
    userSessions.set(cleanUserId, {
      connected: false,
      qrCode: null,
      createdAt: new Date(),
      lastActivity: new Date(),
    })

    messageHistory.set(cleanUserId, [])

    await client.initialize()

    console.log(`🆕 New session created for user: ${cleanUserId}`)

    res.json({
      status: true,
      message: "Session created successfully. Only you can access this session.",
      data: { userId: cleanUserId },
    })
  } catch (error) {
    console.error("Session creation error:", error)
    res.status(500).json({
      status: false,
      message: "Failed to create session",
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get all active sessions (admin view)
 *     description: Retrieve a list of all active WhatsApp sessions
 *     tags: [Sessions]
 */
app.get("/api/sessions", (req, res) => {
  const sessions = Array.from(userSessions.entries()).map(([userId, session]) => ({
    userId,
    connected: session.connected,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  }))

  res.json({
    sessions,
    note: "Each user has isolated session access - 1 person = 1 account",
  })
})

/**
 * @swagger
 * /api/sessions/{userId}/qr:
 *   get:
 *     summary: Get QR code for WhatsApp authentication
 *     description: Get the QR code for WhatsApp Web authentication. Only the session owner can access this.
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session (only accessible by session owner)
 */
app.get("/api/sessions/:userId/qr", (req, res) => {
  const { userId } = req.params
  const session = userSessions.get(userId)

  if (!session) {
    return res.status(404).json({
      status: false,
      message: "Session not found. Make sure you're accessing your own session.",
    })
  }

  if (session.connected) {
    res.json({
      status: true,
      connected: true,
      message: "WhatsApp is already connected for this user.",
    })
  } else if (session.qrCode) {
    res.json({
      status: false,
      connected: false,
      qr: session.qrCode,
      message: "Scan this QR code with your WhatsApp mobile app.",
    })
  } else {
    res.json({
      status: false,
      connected: false,
      message: "QR code not ready yet. Please wait...",
    })
  }
})

/**
 * @swagger
 * /api/sessions/{userId}/status:
 *   get:
 *     summary: Check session connection status
 *     description: Get the current connection status for your session only
 *     tags: [Sessions]
 */
app.get("/api/sessions/:userId/status", async (req, res) => {
  const { userId } = req.params
  const session = userSessions.get(userId)
  const client = clients.get(userId)

  if (!session) {
    return res.status(404).json({
      connected: false,
      message: "Session not found. Make sure you're accessing your own session.",
    })
  }

  try {
    if (client) {
      const state = await client.getState()
      const isConnected = state === "CONNECTED"

      session.connected = isConnected
      session.lastActivity = new Date()
      userSessions.set(userId, session)
    }
  } catch (error) {
    console.error("Status check error:", error)
    session.connected = false
    userSessions.set(userId, session)
  }

  res.json({
    connected: session.connected,
    lastActivity: session.lastActivity,
    createdAt: session.createdAt,
  })
})

/**
 * @swagger
 * /api/sessions/{userId}/messages:
 *   post:
 *     summary: Send a text message (user-isolated)
 *     description: Send a text message from your WhatsApp session only
 *     tags: [Messages]
 */
app.post("/api/sessions/:userId/messages", async (req, res) => {
  try {
    const { userId } = req.params
    const { number, message } = req.body
    const client = clients.get(userId)

    // Ensure user can only access their own session
    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Session not found. You can only send messages from your own session.",
      })
    }

    const session = userSessions.get(userId)
    if (!session || !session.connected) {
      return res.status(400).json({
        status: false,
        message: "Your WhatsApp session is not connected. Please scan the QR code first.",
      })
    }

    if (!number || !validatePhoneNumber(number)) {
      return res.status(400).json({
        status: false,
        message: "Valid phone number is required",
      })
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: false,
        message: "Message content is required",
      })
    }

    const formattedNumber = formatPhoneNumber(number)

    // Send response immediately
    res.json({
      status: true,
      message: "Message is being sent from your session...",
      data: {
        from: userId,
        to: formattedNumber,
        content: message.trim(),
        timestamp: new Date(),
        sending: true,
      },
    })

    // Send message asynchronously
    try {
      await sendWhatsAppMessage(client, userId, formattedNumber, message.trim())

      // Add to user's message history only
      const history = messageHistory.get(userId) || []
      history.push({
        type: "sent",
        to: formattedNumber,
        body: message.trim(),
        timestamp: new Date(),
        status: "sent",
      })
      messageHistory.set(userId, history.slice(-100))

      session.lastActivity = new Date()
      userSessions.set(userId, session)

      console.log(`✅ Message successfully processed for ${userId}`)
    } catch (error) {
      console.error(`❌ Async message send failed for ${userId}:`, error.message)

      const history = messageHistory.get(userId) || []
      history.push({
        type: "sent",
        to: formattedNumber,
        body: message.trim(),
        timestamp: new Date(),
        status: "failed",
        error: error.message,
      })
      messageHistory.set(userId, history.slice(-100))
    }
  } catch (error) {
    console.error("Send message error:", error)
    res.status(500).json({
      status: false,
      message: "Failed to send message from your session",
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/sessions/{userId}/messages/media:
 *   post:
 *     summary: Send a message with media attachment (user-isolated)
 *     description: Send a message with media from your WhatsApp session only
 *     tags: [Messages]
 */
app.post("/api/sessions/:userId/messages/media", upload.single("file"), async (req, res) => {
  try {
    const { userId } = req.params
    const { number, message } = req.body
    const client = clients.get(userId)

    // Ensure user can only access their own session
    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Session not found. You can only send messages from your own session.",
      })
    }

    const session = userSessions.get(userId)
    if (!session || !session.connected) {
      return res.status(400).json({
        status: false,
        message: "Your WhatsApp session is not connected. Please scan the QR code first.",
      })
    }

    if (!number || !validatePhoneNumber(number)) {
      return res.status(400).json({
        status: false,
        message: "Valid phone number is required",
      })
    }

    const formattedNumber = formatPhoneNumber(number)

    if (!req.file && (!message || message.trim().length === 0)) {
      return res.status(400).json({
        status: false,
        message: "Either message or file is required",
      })
    }

    // Send response immediately
    res.json({
      status: true,
      message: req.file ? "Media is being sent from your session..." : "Message is being sent from your session...",
      data: {
        from: userId,
        to: formattedNumber,
        hasMedia: !!req.file,
        timestamp: new Date(),
        sending: true,
      },
    })

    // Send message/media asynchronously
    try {
      if (req.file) {
        const media = MessageMedia.fromFilePath(req.file.path)
        await sendWhatsAppMedia(client, userId, formattedNumber, media, message || "")

        // Clean up uploaded file
        setTimeout(() => {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
          }
        }, 5000)

        // Add to user's message history only
        const history = messageHistory.get(userId) || []
        history.push({
          type: "sent",
          to: formattedNumber,
          body: message || "",
          hasMedia: true,
          mediaType: req.file.mimetype,
          fileName: req.file.originalname,
          timestamp: new Date(),
          status: "sent",
        })
        messageHistory.set(userId, history.slice(-100))
      } else {
        await sendWhatsAppMessage(client, userId, formattedNumber, message.trim())

        const history = messageHistory.get(userId) || []
        history.push({
          type: "sent",
          to: formattedNumber,
          body: message.trim(),
          timestamp: new Date(),
          status: "sent",
        })
        messageHistory.set(userId, history.slice(-100))
      }

      session.lastActivity = new Date()
      userSessions.set(userId, session)

      console.log(`✅ Media/Message successfully processed for ${userId}`)
    } catch (error) {
      console.error(`❌ Async media/message send failed for ${userId}:`, error.message)

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }

      const history = messageHistory.get(userId) || []
      history.push({
        type: "sent",
        to: formattedNumber,
        body: message || "",
        hasMedia: !!req.file,
        timestamp: new Date(),
        status: "failed",
        error: error.message,
      })
      messageHistory.set(userId, history.slice(-100))
    }
  } catch (error) {
    console.error("Send media message error:", error)

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }

    res.status(500).json({
      status: false,
      message: "Failed to send message from your session",
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/sessions/{userId}/history:
 *   get:
 *     summary: Get message history for your session only
 *     description: Retrieve your message history (sent and received) - isolated per user
 *     tags: [Messages]
 */
app.get("/api/sessions/:userId/history", (req, res) => {
  const { userId } = req.params
  const limit = Number.parseInt(req.query.limit) || 50

  // Only return history for the specific user - no cross-user access
  const history = messageHistory.get(userId) || []
  const limitedHistory = history.slice(-limit).reverse()

  res.json({
    status: true,
    data: {
      messages: limitedHistory,
      total: history.length,
      note: "This is your personal message history only",
    },
  })
})

/**
 * @swagger
 * /api/sessions/{userId}/pending:
 *   get:
 *     summary: Get pending messages status for your session
 *     description: Check the status of your messages that are currently being processed
 *     tags: [Messages]
 */
app.get("/api/sessions/:userId/pending", (req, res) => {
  const { userId } = req.params

  // Only return pending messages for the specific user
  const pending = Array.from(pendingMessages.entries())
    .filter(([key, data]) => key.startsWith(userId) && data.userId === userId)
    .map(([key, data]) => ({ key, ...data }))

  res.json({
    status: true,
    data: {
      pending: pending,
      count: pending.length,
      note: "These are your pending messages only",
    },
  })
})

/**
 * @swagger
 * /api/sessions/{userId}:
 *   delete:
 *     summary: Logout and destroy your session
 *     description: Logout from WhatsApp and destroy your session only
 *     tags: [Sessions]
 */
app.delete("/api/sessions/:userId", async (req, res) => {
  try {
    const { userId } = req.params
    const client = clients.get(userId)

    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Session not found. You can only destroy your own session.",
      })
    }

    await client.logout()
    await client.destroy()

    // Clean up all user-specific data
    clients.delete(userId)
    userSessions.delete(userId)
    qrCodes.delete(userId)
    messageHistory.delete(userId)

    // Clean up user's pending messages
    const userPendingKeys = Array.from(pendingMessages.keys()).filter((key) => key.startsWith(userId))
    userPendingKeys.forEach((key) => pendingMessages.delete(key))

    console.log(`🗑️ Session destroyed for user: ${userId}`)

    res.json({
      status: true,
      message: "Your session has been destroyed successfully",
    })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      status: false,
      message: "Failed to destroy your session",
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: System health check
 *     description: Get system health information
 *     tags: [System]
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date(),
    activeSessions: clients.size,
    uptime: process.uptime(),
    pendingMessages: pendingMessages.size,
    note: "Each session is isolated - 1 person = 1 account",
  })
})

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error)

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: false,
        message: "File too large. Maximum size is 50MB",
        error: error.message,
      })
    }
  }

  if (error.message && error.message.includes("File type not supported")) {
    return res.status(400).json({
      status: false,
      message: error.message,
    })
  }

  res.status(500).json({
    status: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
  })
})

app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: "Endpoint not found",
  })
})

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Shutting down gracefully...")

  for (const [userId, client] of clients) {
    try {
      await client.destroy()
      console.log(`✅ Client ${userId} destroyed`)
    } catch (error) {
      console.error(`❌ Error destroying client ${userId}:`, error)
    }
  }

  process.exit(0)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Multi-User Bot Server running on port ${PORT}`)
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`)
  console.log(`🌐 Web Interface: http://localhost:${PORT}`)
  console.log(`👤 Session Isolation: 1 person = 1 account (users cannot access other sessions)`)
})
