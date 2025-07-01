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
app.use(cors())
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
        - Multi-user session management
        - QR code authentication
        - Text and media message sending
        - Message history tracking
        - Real-time connection status
        - File upload support (images, documents, audio, video)
        
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
        url: "https://your-domain.com",
        description: "Production server",
      },
    ],
    tags: [
      {
        name: "Sessions",
        description: "WhatsApp session management",
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
              description: "Unique identifier for the user",
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
        QRResponse: {
          type: "object",
          properties: {
            status: {
              type: "boolean",
            },
            connected: {
              type: "boolean",
              description: "Whether WhatsApp is connected",
            },
            qr: {
              type: "string",
              description: "Base64 encoded QR code image (data URL)",
              example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
            },
            message: {
              type: "string",
              description: "Status message",
            },
          },
        },
        MessageHistory: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["sent", "received"],
              description: "Message direction",
            },
            to: {
              type: "string",
              description: "Recipient number (for sent messages)",
            },
            from: {
              type: "string",
              description: "Sender number (for received messages)",
            },
            body: {
              type: "string",
              description: "Message content",
            },
            hasMedia: {
              type: "boolean",
              description: "Whether message contains media",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Message timestamp",
            },
            status: {
              type: "string",
              enum: ["sending", "sent", "failed"],
              description: "Message status",
            },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "healthy",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
            activeSessions: {
              type: "integer",
              description: "Number of active sessions",
            },
            uptime: {
              type: "number",
              description: "Server uptime in seconds",
            },
            pendingMessages: {
              type: "integer",
              description: "Number of pending messages",
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiResponse",
              },
              example: {
                status: false,
                message: "Invalid request data",
              },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiResponse",
              },
              example: {
                status: false,
                message: "Session not found",
              },
            },
          },
        },
        InternalError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiResponse",
              },
              example: {
                status: false,
                message: "Internal server error",
              },
            },
          },
        },
      },
    },
  },
  apis: ["./server.js"], // Make sure this path is correct
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
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
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

// Storage for clients and sessions
const clients = new Map()
const userSessions = new Map()
const qrCodes = new Map()
const messageHistory = new Map()
const pendingMessages = new Map() // Track pending messages

// Utility functions
function createWhatsAppClient(userId) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
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
    const history = messageHistory.get(userId) || []
    history.push({
      type: "received",
      from: message.from,
      body: message.body,
      timestamp: new Date(),
      hasMedia: message.hasMedia,
    })
    messageHistory.set(userId, history.slice(-100))
  })

  // Track message sending events
  client.on("message_create", (message) => {
    if (message.fromMe) {
      console.log(`✅ Message sent successfully by ${userId} to ${message.to}`)

      // Update pending message status
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

// Enhanced message sending with better tracking
async function sendWhatsAppMessage(client, userId, number, message) {
  const messageKey = `${userId}-${number}-${Date.now()}`

  try {
    console.log(`📤 Attempting to send message from ${userId} to ${number}`)

    // Track pending message
    pendingMessages.set(messageKey, {
      status: "pending",
      timestamp: new Date(),
      to: number,
      content: message,
    })

    // Check client state
    const state = await client.getState()
    console.log(`Client ${userId} state:`, state)

    if (state !== "CONNECTED") {
      throw new Error(`WhatsApp client not ready. Current state: ${state}`)
    }

    // Send message with timeout
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

    // Update pending status
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

// Enhanced media sending
async function sendWhatsAppMedia(client, userId, number, media, caption = "") {
  const messageKey = `${userId}-${number}-${Date.now()}`

  try {
    console.log(`📤 Attempting to send media from ${userId} to ${number}`)

    // Track pending message
    pendingMessages.set(messageKey, {
      status: "pending",
      timestamp: new Date(),
      to: number,
      hasMedia: true,
      caption: caption,
    })

    // Check client state
    const state = await client.getState()
    console.log(`Client ${userId} state:`, state)

    if (state !== "CONNECTED") {
      throw new Error(`WhatsApp client not ready. Current state: ${state}`)
    }

    // Send media with timeout
    const sendPromise = client.sendMessage(number, media, { caption })
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Media sending timeout after 60 seconds")), 60000)
    })

    const result = await Promise.race([sendPromise, timeoutPromise])

    console.log(`✅ Media sent successfully from ${userId} to ${number}`)

    // Update pending status
    const pending = pendingMessages.get(messageKey)
    if (pending) {
      pending.status = "sent"
      pending.messageId = result.id._serialized
      pendingMessages.set(messageKey, pending)
    }

    return result
  } catch (error) {
    console.error(`❌ Send media error for ${userId}:`, error.message)

    // Update pending status
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
 *         content:
 *           text/html:
 *             schema:
 *               type: string
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
 *     summary: Create a new WhatsApp session
 *     description: |
 *       Creates a new WhatsApp client session for a user. Each user can have only one active session.
 *       After creating a session, use the QR endpoint to get the authentication QR code.
 *     tags: [Sessions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSessionRequest'
 *           examples:
 *             basic:
 *               summary: Basic session creation
 *               value:
 *                 userId: "user123"
 *     responses:
 *       200:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               success:
 *                 summary: Successful creation
 *                 value:
 *                   status: true
 *                   message: "Session created successfully"
 *                   data:
 *                     userId: "user123"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Session already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               status: false
 *               message: "Session already exists for this user"
 *       500:
 *         $ref: '#/components/responses/InternalError'
 *   get:
 *     summary: Get all active sessions
 *     description: Retrieve a list of all active WhatsApp sessions
 *     tags: [Sessions]
 *     responses:
 *       200:
 *         description: List of all sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *             example:
 *               sessions:
 *                 - userId: "user123"
 *                   connected: true
 *                   createdAt: "2024-01-01T10:00:00Z"
 *                   lastActivity: "2024-01-01T10:30:00Z"
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

    if (clients.has(cleanUserId)) {
      return res.status(409).json({
        status: false,
        message: "Session already exists for this user",
        data: { userId: cleanUserId },
      })
    }

    const client = createWhatsAppClient(cleanUserId)
    clients.set(cleanUserId, client)

    userSessions.set(cleanUserId, {
      connected: false,
      qrCode: null,
      createdAt: new Date(),
      lastActivity: new Date(),
    })

    messageHistory.set(cleanUserId, [])

    await client.initialize()

    res.json({
      status: true,
      message: "Session created successfully",
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

app.get("/api/sessions", (req, res) => {
  const sessions = Array.from(userSessions.entries()).map(([userId, session]) => ({
    userId,
    connected: session.connected,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  }))

  res.json({ sessions })
})

/**
 * @swagger
 * /api/sessions/{userId}/qr:
 *   get:
 *     summary: Get QR code for WhatsApp authentication
 *     description: |
 *       Get the QR code for WhatsApp Web authentication.
 *       Scan this QR code with your WhatsApp mobile app to connect the session.
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session
 *         example: "user123"
 *     responses:
 *       200:
 *         description: QR code or connection status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QRResponse'
 *             examples:
 *               qr_available:
 *                 summary: QR code available
 *                 value:
 *                   status: false
 *                   connected: false
 *                   qr: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *               already_connected:
 *                 summary: Already connected
 *                 value:
 *                   status: true
 *                   connected: true
 *               qr_not_ready:
 *                 summary: QR not ready yet
 *                 value:
 *                   status: false
 *                   connected: false
 *                   message: "QR code not ready yet"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.get("/api/sessions/:userId/qr", (req, res) => {
  const { userId } = req.params
  const session = userSessions.get(userId)

  if (!session) {
    return res.status(404).json({
      status: false,
      message: "Session not found",
    })
  }

  if (session.connected) {
    res.json({
      status: true,
      connected: true,
    })
  } else if (session.qrCode) {
    res.json({
      status: false,
      connected: false,
      qr: session.qrCode,
    })
  } else {
    res.json({
      status: false,
      connected: false,
      message: "QR code not ready yet",
    })
  }
})

/**
 * @swagger
 * /api/sessions/{userId}/status:
 *   get:
 *     summary: Check session connection status
 *     description: Get the current connection status and activity information for a session
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session
 *         example: "user123"
 *     responses:
 *       200:
 *         description: Session status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                   description: Whether the session is connected to WhatsApp
 *                 lastActivity:
 *                   type: string
 *                   format: date-time
 *                   description: Last activity timestamp
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: Session creation timestamp
 *             example:
 *               connected: true
 *               lastActivity: "2024-01-01T10:30:00Z"
 *               createdAt: "2024-01-01T10:00:00Z"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.get("/api/sessions/:userId/status", async (req, res) => {
  const { userId } = req.params
  const session = userSessions.get(userId)
  const client = clients.get(userId)

  if (!session) {
    return res.status(404).json({
      connected: false,
      message: "Session not found",
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
 *     summary: Send a text message
 *     description: |
 *       Send a text message to a WhatsApp number. The session must be connected before sending messages.
 *       Messages are processed asynchronously for better performance.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session
 *         example: "user123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageRequest'
 *           examples:
 *             simple_message:
 *               summary: Simple text message
 *               value:
 *                 number: "628123456789"
 *                 message: "Hello! This is a test message from WhatsApp Bot."
 *             long_message:
 *               summary: Longer message
 *               value:
 *                 number: "628123456789"
 *                 message: "This is a longer message to demonstrate the API capabilities. You can send messages up to 4096 characters long."
 *     responses:
 *       200:
 *         description: Message sent successfully (or being sent)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               success:
 *                 summary: Message being sent
 *                 value:
 *                   status: true
 *                   message: "Message is being sent..."
 *                   data:
 *                     to: "628123456789@c.us"
 *                     content: "Hello! This is a test message."
 *                     timestamp: "2024-01-01T10:30:00Z"
 *                     sending: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
app.post("/api/sessions/:userId/messages", async (req, res) => {
  try {
    const { userId } = req.params
    const { number, message } = req.body
    const client = clients.get(userId)

    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Session not found",
      })
    }

    const session = userSessions.get(userId)
    if (!session || !session.connected) {
      return res.status(400).json({
        status: false,
        message: "WhatsApp not connected",
      })
    }

    if (!number) {
      return res.status(400).json({
        status: false,
        message: "Phone number is required",
      })
    }

    if (!validatePhoneNumber(number)) {
      return res.status(400).json({
        status: false,
        message: "Invalid phone number format",
      })
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: false,
        message: "Message content is required",
      })
    }

    const formattedNumber = formatPhoneNumber(number)

    // Send response immediately to prevent timeout
    res.json({
      status: true,
      message: "Message is being sent...",
      data: {
        to: formattedNumber,
        content: message.trim(),
        timestamp: new Date(),
        sending: true,
      },
    })

    // Send message asynchronously
    try {
      await sendWhatsAppMessage(client, userId, formattedNumber, message.trim())

      // Add to message history
      const history = messageHistory.get(userId) || []
      history.push({
        type: "sent",
        to: formattedNumber,
        body: message.trim(),
        timestamp: new Date(),
        status: "sent",
      })
      messageHistory.set(userId, history.slice(-100))

      // Update last activity
      session.lastActivity = new Date()
      userSessions.set(userId, session)

      console.log(`✅ Message successfully processed for ${userId}`)
    } catch (error) {
      console.error(`❌ Async message send failed for ${userId}:`, error.message)

      // Add failed message to history
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
      message: "Failed to send message",
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/sessions/{userId}/messages/media:
 *   post:
 *     summary: Send a message with media attachment
 *     description: |
 *       Send a message with media attachment (image, document, audio, video).
 *       Supports various file formats up to 50MB in size.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session
 *         example: "user123"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               number:
 *                 type: string
 *                 description: WhatsApp number with country code
 *                 example: "628123456789"
 *               message:
 *                 type: string
 *                 description: Optional caption for the media
 *                 example: "Check out this image!"
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file to send
 *             required:
 *               - number
 *           encoding:
 *             file:
 *               contentType: image/*, video/*, audio/*, application/pdf, application/msword, text/*
 *     responses:
 *       200:
 *         description: Media message sent successfully (or being sent)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               status: true
 *               message: "Media is being sent..."
 *               data:
 *                 to: "628123456789@c.us"
 *                 hasMedia: true
 *                 timestamp: "2024-01-01T10:30:00Z"
 *                 sending: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
app.post("/api/sessions/:userId/messages/media", upload.single("file"), async (req, res) => {
  try {
    const { userId } = req.params
    const { number, message } = req.body
    const client = clients.get(userId)

    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Session not found",
      })
    }

    const session = userSessions.get(userId)
    if (!session || !session.connected) {
      return res.status(400).json({
        status: false,
        message: "WhatsApp not connected",
      })
    }

    if (!number) {
      return res.status(400).json({
        status: false,
        message: "Phone number is required",
      })
    }

    if (!validatePhoneNumber(number)) {
      return res.status(400).json({
        status: false,
        message: "Invalid phone number format",
      })
    }

    const formattedNumber = formatPhoneNumber(number)

    if (!req.file && (!message || message.trim().length === 0)) {
      return res.status(400).json({
        status: false,
        message: "Either message or file is required",
      })
    }

    // Send response immediately to prevent timeout
    res.json({
      status: true,
      message: req.file ? "Media is being sent..." : "Message is being sent...",
      data: {
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

        // Add to message history
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

      // Update last activity
      session.lastActivity = new Date()
      userSessions.set(userId, session)

      console.log(`✅ Media/Message successfully processed for ${userId}`)
    } catch (error) {
      console.error(`❌ Async media/message send failed for ${userId}:`, error.message)

      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }

      // Add failed message to history
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
      message: "Failed to send message",
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/sessions/{userId}/history:
 *   get:
 *     summary: Get message history for a session
 *     description: Retrieve the message history (sent and received) for a specific session
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session
 *         example: "user123"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Number of messages to return
 *         example: 20
 *     responses:
 *       200:
 *         description: Message history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MessageHistory'
 *                     total:
 *                       type: integer
 *                       description: Total number of messages in history
 *             example:
 *               status: true
 *               data:
 *                 messages:
 *                   - type: "sent"
 *                     to: "628123456789@c.us"
 *                     body: "Hello!"
 *                     hasMedia: false
 *                     timestamp: "2024-01-01T10:30:00Z"
 *                     status: "sent"
 *                 total: 1
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.get("/api/sessions/:userId/history", (req, res) => {
  const { userId } = req.params
  const limit = Number.parseInt(req.query.limit) || 50

  const history = messageHistory.get(userId) || []
  const limitedHistory = history.slice(-limit).reverse()

  res.json({
    status: true,
    data: {
      messages: limitedHistory,
      total: history.length,
    },
  })
})

/**
 * @swagger
 * /api/sessions/{userId}/pending:
 *   get:
 *     summary: Get pending messages status
 *     description: Check the status of messages that are currently being processed
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session
 *         example: "user123"
 *     responses:
 *       200:
 *         description: Pending messages information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     pending:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [pending, sent, failed]
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           to:
 *                             type: string
 *                           content:
 *                             type: string
 *                     count:
 *                       type: integer
 *             example:
 *               status: true
 *               data:
 *                 pending: []
 *                 count: 0
 */
app.get("/api/sessions/:userId/pending", (req, res) => {
  const { userId } = req.params
  const pending = Array.from(pendingMessages.entries())
    .filter(([key]) => key.startsWith(userId))
    .map(([key, data]) => ({ key, ...data }))

  res.json({
    status: true,
    data: {
      pending: pending,
      count: pending.length,
    },
  })
})

/**
 * @swagger
 * /api/sessions/{userId}:
 *   delete:
 *     summary: Logout and destroy a session
 *     description: |
 *       Logout from WhatsApp and completely destroy the session.
 *       This will remove all session data and disconnect from WhatsApp.
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the session to destroy
 *         example: "user123"
 *     responses:
 *       200:
 *         description: Session destroyed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               status: true
 *               message: "Session destroyed successfully"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
app.delete("/api/sessions/:userId", async (req, res) => {
  try {
    const { userId } = req.params
    const client = clients.get(userId)

    if (!client) {
      return res.status(404).json({
        status: false,
        message: "Session not found",
      })
    }

    await client.logout()
    await client.destroy()

    clients.delete(userId)
    userSessions.delete(userId)
    qrCodes.delete(userId)
    messageHistory.delete(userId)

    res.json({
      status: true,
      message: "Session destroyed successfully",
    })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      status: false,
      message: "Failed to destroy session",
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: System health check
 *     description: Get system health information including active sessions and uptime
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "healthy"
 *               timestamp: "2024-01-01T10:30:00Z"
 *               activeSessions: 2
 *               uptime: 3600
 *               pendingMessages: 0
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date(),
    activeSessions: clients.size,
    uptime: process.uptime(),
    pendingMessages: pendingMessages.size,
  })
})

/**
 * @swagger
 * /api-docs.json:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the raw OpenAPI specification in JSON format
 *     tags: [System]
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

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
})
