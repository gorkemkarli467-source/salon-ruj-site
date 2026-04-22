const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin şifresi (İleride değiştirilebilir)
const ADMIN_USERNAME = "görkem";
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

// Veri tabanı dosyaları
const DB_FILE = path.join(DATA_DIR, 'gallery.json');
const DB_TRANSLATIONS = path.join(DATA_DIR, 'translations.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}
if (!fs.existsSync(DB_TRANSLATIONS)) {
    // translations.json yoksa boş bir yapı oluştur veya hata ver (ben oluşturmuştum ama güvenlik için)
    fs.writeFileSync(DB_TRANSLATIONS, JSON.stringify({tr:{}, en:{}, de:{}, ru:{}}));
}

// Multer ile dosya yükleme ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Güvenlik: Sadece istenilen tiplere izin ver
    const allowedTypes = /jpeg|jpg|png|mp4|mov/i;
    const isExtensionOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const isMimeTypeOk = allowedTypes.test(file.mimetype);

    if (isExtensionOk && isMimeTypeOk) {
        cb(null, true);
    } else {
        cb(new Error("Güvenlik ihlali: Yalnızca Resim (JPG, PNG) veya Video (MP4, MOV) yükleyebilirsiniz!"));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB Sınırı
    fileFilter: fileFilter
});

// JSON okuma
function getGallery() {
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
}

// JSON yazma
function saveGallery(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- Çeviri Fonksiyonları ---
function getTranslations() {
    const data = fs.readFileSync(DB_TRANSLATIONS);
    return JSON.parse(data);
}

function saveTranslations(data) {
    fs.writeFileSync(DB_TRANSLATIONS, JSON.stringify(data, null, 2));
}

// Şifre kontrol middleware
function checkAuth(req, res, next) {
    const user = req.headers['x-admin-username'];
    const pwd = req.headers['x-admin-password'];
    if (user === ADMIN_USERNAME && pwd === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Yetkisiz erişim. Hatalı şifre veya kullanıcı adı.' });
    }
}

// --- API ENDPOINT'LERİ ---

// 1. Tüm galeriyi getir
app.get('/api/gallery', (req, res) => {
    res.json(getGallery());
});

// 1.1 Tüm çevirileri getir
app.get('/api/translations', (req, res) => {
    res.json(getTranslations());
});

// 1.2 Çevirileri güncelle
app.post('/api/translations', checkAuth, (req, res) => {
    const newTranslations = req.body;
    if (!newTranslations || typeof newTranslations !== 'object') {
        return res.status(400).json({ error: 'Geçersiz veri formatı.' });
    }
    saveTranslations(newTranslations);
    res.json({ success: true });
});

// 2. Fotoğraf/Video Yükle
app.post('/api/upload', checkAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Dosya yüklenemedi.' });
    }
    
    const category = req.body.category || 'all';

    const newPhoto = {
        id: Date.now().toString(),
        filename: req.file.filename,
        category: category,
        uploadedAt: new Date().toISOString(),
        type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
    };

    const gallery = getGallery();
    gallery.unshift(newPhoto); // En başa ekle
    saveGallery(gallery);

    res.json({ success: true, photo: newPhoto });
});

// 3. Fotoğraf Sil
app.delete('/api/gallery/:id', checkAuth, (req, res) => {
    const { id } = req.params;
    let gallery = getGallery();
    const photo = gallery.find(p => p.id === id);
    
    if (photo) {
        // Dosyayı sistemden kalıcı olarak sil
        const filePath = path.join(UPLOADS_DIR, photo.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        // DB'den çıkar
        gallery = gallery.filter(p => p.id !== id);
        saveGallery(gallery);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Silinecek dosya bulunamadı.' });
    }
});

// Saniyede binlerce şifre deneme (Brute-Force) koruması
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 10, // Toplam 10 giriş denemesi hakkı
    message: { success: false, error: 'Sisteme çok fazla deneme yapıldı. Lütfen 15 dakika bekleyin.' }
});

// 4. Admin Giriş Kontrolü (Kullanıcı Adı ve Şifre doğrulama)
app.post('/api/login', loginLimiter, (req, res) => {
    if (req.body.username === ADMIN_USERNAME && req.body.password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

// Yükleme sırasında oluşan hataları (Dosya çok büyük vb.) Admin paneline düzgün iletmek için
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: "Dosya yükleme hatası: " + err.message });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
