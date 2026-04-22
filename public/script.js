document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Elements
    const header = document.getElementById('header');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    
    // 1. Header Scrolled State
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 2. Mobile Menu Toggle
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.add('active');
    });

    mobileMenuClose.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
    });

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Sadece gerçek linkler (a tag) menüyü kapatsın.
            // summary (Hizmetlerimiz açılır başlığı) menüyü kapatmasın.
            if (link.tagName === 'A') {
                mobileMenu.classList.remove('active');
            }
        });
    });

    // 3. Scroll Animations (Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: stop observing once animated
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
        observer.observe(el);
    });

    // 4. Dinamik Galeri Yükleme Modülü
    loadDynamicGallery();
});

// Backend'den fotoğrafları çeken fonksiyon
async function loadDynamicGallery() {
    const galleryContainer = document.querySelector('.dynamic-gallery-container');
    if (!galleryContainer) return;

    try {
        const res = await fetch('/api/gallery');
        const items = await res.json();
        const category = galleryContainer.getAttribute('data-category');
        
        let filteredItems = items;
        
        // Eğer kategori 'all' ise (Ana Sayfa), tümünü göster
        if (category !== 'all') {
            filteredItems = items.filter(i => i.category === category);
        }

        galleryContainer.innerHTML = '';

        if (filteredItems.length === 0) {
            galleryContainer.innerHTML = `
                <div class="gallery-item" style="border: 2px dashed #ccc; display:flex; justify-content:center; align-items:center; flex-direction:column; color:#999; width: 100%; min-height: 200px;">
                    <i data-lucide="image" style="width:40px;height:40px;margin-bottom:1rem;"></i>
                    <p style="font-size: 0.9rem;">Henüz fotoğraf yüklenmedi</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            
            if (item.type === 'video') {
                div.innerHTML = `<video src="/assets/uploads/${item.filename}" autoplay loop muted playsinline></video>`;
            } else {
                div.innerHTML = `<img src="/assets/uploads/${item.filename}" alt="Salon Ruj Çalışması">`;
            }
            galleryContainer.appendChild(div);
        });

    } catch (e) {
        console.error("Gallery yükleme hatası:", e);
    }
}
