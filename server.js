const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin şifresi
const ADMIN_USERNAME = "gorkem";
const ADMIN_PASSWORD = "123454321";

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Gerekli klasörlerin oluşturulması
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'assets', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Klasör izinlerini zorla aç (Hata olursa görmezden gel)
try {
    fs.chmodSync(DATA_DIR, 0o777);
    fs.chmodSync(UPLOADS_DIR, 0o777);
} catch(e) {
    console.log("İzin ayarı atlandı.");
}

// Veri tabanı dosyaları
const DB_FILE = path.join(DATA_DIR, 'gallery.json');
const DB_TRANSLATIONS = path.join(DATA_DIR, 'translations.json');

if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
if (!fs.existsSync(DB_TRANSLATIONS)) fs.writeFileSync(DB_TRANSLATIONS, JSON.stringify({tr:{}, en:{}, de:{}, ru:{}}));

// Multer Ayarları
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|mp4|mov|quicktime/i;
        const isExtOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const isMimeOk = allowedTypes.test(file.mimetype);
        if (isExtOk || isMimeOk) return cb(null, true);
        cb(new Error("Sadece Resim veya Video yüklenebilir!"));
    }
});

// Yardımcı Fonksiyonlar
const getGallery = () => JSON.parse(fs.readFileSync(DB_FILE));
const saveGallery = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const getTranslations = () => JSON.parse(fs.readFileSync(DB_TRANSLATIONS));
const saveTranslations = (data) => fs.writeFileSync(DB_TRANSLATIONS, JSON.stringify(data, null, 2));

function checkAuth(req, res, next) {
    const user = req.headers['x-admin-username'] || req.query.u;
    const pwd = req.headers['x-admin-password'] || req.query.p;
    if (user === ADMIN_USERNAME && pwd === ADMIN_PASSWORD) return next();
    res.status(401).json({ error: 'Yetkisiz erişim.' });
}

// API Endpoints
app.get('/api/gallery', (req, res) => res.json(getGallery()));
app.get('/api/translations', (req, res) => res.json(getTranslations()));

app.post('/api/translations', checkAuth, (req, res) => {
    saveTranslations(req.body);
    res.json({ success: true });
});

app.post('/api/upload', checkAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenemedi.' });
    const gallery = getGallery();
    const newItem = {
        id: Date.now().toString(),
        filename: req.file.filename,
        category: req.body.category || 'all',
        uploadedAt: new Date().toISOString(),
        type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
    };
    gallery.unshift(newItem);
    saveGallery(gallery);
    res.json({ success: true, photo: newItem });
});

app.delete('/api/gallery/:id', checkAuth, (req, res) => {
    let gallery = getGallery();
    const item = gallery.find(p => p.id === req.params.id);
    if (item) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, item.filename)); } catch(e) {}
        gallery = gallery.filter(p => p.id !== req.params.id);
        saveGallery(gallery);
        return res.json({ success: true });
    }
    res.status(404).json({ error: 'Bulunamadı.' });
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

app.post('/api/login', loginLimiter, (req, res) => {
    if (req.body.username === ADMIN_USERNAME && req.body.password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

app.use((err, req, res, next) => {
    res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

