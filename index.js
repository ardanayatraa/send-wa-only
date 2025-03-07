const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Untuk menyajikan file statis (HTML, CSS, JS)

let qrCodeData = null;
let isConnected = false;

// Inisialisasi WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

// Generate QR Code jika belum login
client.on('qr', async qr => {
    qrCodeData = await qrcode.toDataURL(qr); // Simpan QR Code dalam format base64
    isConnected = false;
});

// Jika sudah terhubung
client.on('ready', () => {
    console.log('WhatsApp Bot siap digunakan!');
    qrCodeData = null; // Hapus QR setelah login
    isConnected = true;
});

// Route untuk halaman utama
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// API untuk mendapatkan QR Code
app.get('/get-qr', (req, res) => {
    if (qrCodeData) {
        res.json({ status: false, qr: qrCodeData });
    } else {
        res.json({ status: true });
    }
});

// API untuk memeriksa status koneksi
app.get('/status', (req, res) => {
    res.json({ connected: isConnected });
});

// API untuk logout dan restart client
app.get('/logout', async (req, res) => {
    try {
        await client.logout();
        isConnected = false;
        qrCodeData = null;

        // Restart WhatsApp client setelah logout
        console.log("Restarting WhatsApp client...");
        client.destroy(); // Hancurkan instance lama
        setTimeout(() => {
            client.initialize(); // Inisialisasi ulang
        }, 3000); // Tunggu 3 detik sebelum restart

        res.json({ status: true, message: "Berhasil logout, QR akan muncul lagi dalam beberapa detik." });
    } catch (error) {
        res.status(500).json({ status: false, message: "Gagal logout", error: error.message });
    }
});

app.post('/send-message', async (req, res) => {
    const { number, message, mediaUrl } = req.body;

    if (!number || (!message && !mediaUrl)) {
        return res.status(400).json({ status: false, message: 'Nomor dan minimal salah satu (pesan atau media) harus diisi!' });
    }

    try {
        const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`; // Format nomor WA

        if (mediaUrl) {
            // Kirim pesan dengan media (gambar/dokumen)
            const media = await MessageMedia.fromUrl(mediaUrl);
            await client.sendMessage(formattedNumber, media, { caption: message || '' });
        } else {
            // Kirim pesan teks saja
            await client.sendMessage(formattedNumber, message);
        }

        res.json({ status: true, message: 'Pesan berhasil dikirim!' });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Gagal mengirim pesan', error: error.message });
    }
});


// Jalankan server Express
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});

// Jalankan WhatsApp client
client.initialize();
