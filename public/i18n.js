let translations = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Fetch translations from server
    try {
        const res = await fetch('/api/translations');
        translations = await res.json();
    } catch (e) {
        console.error("Çeviriler yüklenemedi:", e);
        return;
    }

    // Determine language: localStorage -> default 'tr'
    let currentLang = localStorage.getItem('salonruj_lang') || 'tr';
    
    // Apply initial translations
    applyTranslations(currentLang);
    
    // Set language switcher UI if it exists
    const langSelects = document.querySelectorAll('.lang-select');
    langSelects.forEach(select => {
        select.value = currentLang;
        
        select.addEventListener('change', (e) => {
            const newLang = e.target.value;
            localStorage.setItem('salonruj_lang', newLang);
            applyTranslations(newLang);
            
            // Sync all selects
            langSelects.forEach(s => {
                if (s !== e.target) s.value = newLang;
            });
        });
    });
    
    // Fallback for custom dropdown logic (if using buttons instead of select)
    const langButtons = document.querySelectorAll('.lang-btn');
    langButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const newLang = btn.getAttribute('data-lang');
            localStorage.setItem('salonruj_lang', newLang);
            applyTranslations(newLang);
            
            // Update active state
            langButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
});

function applyTranslations(lang) {
    if (!translations || !translations[lang]) return;
    
    const dict = translations[lang];
    
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            // Some elements might need innerHTML (if they contain <br> or <strong>)
            el.innerHTML = dict[key];
        }
    });
}
