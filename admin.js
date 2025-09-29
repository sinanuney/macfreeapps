document.addEventListener('DOMContentLoaded', () => {
const API_URL = 'http://127.0.0.1:5001/api/apps';
const CATEGORIES_API_URL = 'http://127.0.0.1:5001/api/categories';
    const SCRAPE_API_URL = 'http://127.0.0.1:5001/api/scrape-url'; // Yeni API endpoint'i
    const appListBody = document.getElementById('app-list-body');
    const appTable = document.querySelector('.app-table');
    const spinner = document.querySelector('.spinner');
    const addForm = document.getElementById('add-app-form');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-app-form');
    const editModalTitle = document.getElementById('edit-modal-title');
    const closeModalBtn = editModal.querySelector('.close');
    const searchInput = document.getElementById('search-admin');
    const tableHeader = document.querySelector('.app-table thead');
    // Kategori yönetimi kaldırıldı - sadece seçenek olarak kullanılıyor
    const themeSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

    let allApps = [];
    // allCategories değişkeni kaldırıldı - artık API'den alınıyor
    let currentSort = { key: 'creationDate', order: 'desc' };
    let currentPage = 1;
    let itemsPerPage = 10;
    let filteredApps = [];

    // Theme functionality
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            themeSwitch.checked = true;
        }
    }

    // Navigation functionality
    function initializeNavigation() {
        // Add click handlers for navigation buttons
        const navButtons = document.querySelectorAll('a[href*=".html"], a[href*=".txt"], a[href*=".xml"], a[href*="localhost"]');
        navButtons.forEach(button => {
            if (button.style.display === 'inline-flex') { // Only our nav buttons
                button.addEventListener('click', function(e) {
                    // Add loading state
                    const originalText = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
                    this.style.pointerEvents = 'none';
                    
                    // Reset after a short delay
                    setTimeout(() => {
                        this.innerHTML = originalText;
                        this.style.pointerEvents = 'auto';
                    }, 500);
                });
            }
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl/Cmd + number keys for quick navigation
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
                e.preventDefault();
                const shortcuts = {
                    '1': 'index.html',
                    '2': 'ml-seo-trainer.html',
                    '3': 'performance-dashboard.html',
                    '4': 'robots.txt',
                    '5': 'sitemap.xml'
                };
                
                const target = shortcuts[e.key];
                if (target) {
                    window.open(target, '_blank');
                }
            }
        });
    }

    function switchTheme(e) {
        if (e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light-mode');
        }
    }

    themeSwitch.addEventListener('change', switchTheme, false);

    // SEO Functions
    function initializeSEOFields() {
        // Character counters for all SEO fields
        const seoFields = [
            { id: 'scraped-seo-title', countId: 'scraped-seo-title-count', max: 60 },
            { id: 'scraped-seo-description', countId: 'scraped-seo-description-count', max: 160 },
            { id: 'scraped-seo-keywords', countId: 'scraped-seo-keywords-count', max: 200 },
            { id: 'scraped-seo-slug', countId: 'scraped-seo-slug-count', max: 100 },
            { id: 'scraped-seo-image-alt', countId: 'scraped-seo-image-alt-count', max: 125 },
            { id: 'manual-seo-title', countId: 'manual-seo-title-count', max: 60 },
            { id: 'manual-seo-description', countId: 'manual-seo-description-count', max: 160 },
            { id: 'manual-seo-keywords', countId: 'manual-seo-keywords-count', max: 200 },
            { id: 'manual-seo-slug', countId: 'manual-seo-slug-count', max: 100 },
            { id: 'manual-seo-image-alt', countId: 'manual-seo-image-alt-count', max: 125 },
            { id: 'edit-seo-title', countId: 'edit-seo-title-count', max: 60 },
            { id: 'edit-seo-description', countId: 'edit-seo-description-count', max: 160 },
            { id: 'edit-seo-keywords', countId: 'edit-seo-keywords-count', max: 200 },
            { id: 'edit-seo-slug', countId: 'edit-seo-slug-count', max: 100 },
            { id: 'edit-seo-image-alt', countId: 'edit-seo-image-alt-count', max: 125 }
        ];

        seoFields.forEach(field => {
            const input = document.getElementById(field.id);
            const counter = document.getElementById(field.countId);
            
            if (input && counter) {
                // Initial count
                updateCharacterCount(input, counter, field.max);
                
                // Add event listener
                input.addEventListener('input', () => {
                    updateCharacterCount(input, counter, field.max);
                    updateSEOPreview(field.id);
                });
            }
        });

        // Auto-generate slug from name
        setupSlugGeneration();
        
        // Setup SEO preview updates
        setupSEOPreview();
    }

    function updateCharacterCount(input, counter, max) {
        const count = input.value.length;
        counter.textContent = count;
        
        // Update counter color based on usage
        counter.className = 'character-count';
        if (count > max * 0.9) {
            counter.classList.add('danger');
        } else if (count > max * 0.8) {
            counter.classList.add('warning');
        }
    }

    function setupSlugGeneration() {
        const nameFields = ['scraped-name', 'manual-name', 'edit-name'];
        const slugFields = ['scraped-seo-slug', 'manual-seo-slug', 'edit-seo-slug'];

        nameFields.forEach((nameField, index) => {
            const nameInput = document.getElementById(nameField);
            const slugInput = document.getElementById(slugFields[index]);
            
            if (nameInput && slugInput) {
                nameInput.addEventListener('input', () => {
                    if (!slugInput.value || slugInput.dataset.autoGenerated === 'true') {
                        const slug = generateSlug(nameInput.value);
                        slugInput.value = slug;
                        slugInput.dataset.autoGenerated = 'true';
                        updateCharacterCount(slugInput, document.getElementById(slugFields[index].replace('seo-slug', 'seo-slug-count')), 100);
                    }
                });
                
                // Reset auto-generated flag when user manually edits slug
                slugInput.addEventListener('input', () => {
                    slugInput.dataset.autoGenerated = 'false';
                });
            }
        });
    }

    function generateSlug(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }

    function setupSEOPreview() {
        const previewFields = [
            { title: 'scraped-seo-title', description: 'scraped-seo-description', slug: 'scraped-seo-slug', previewTitle: 'scraped-seo-preview-title', previewUrl: 'scraped-seo-preview-url', previewDesc: 'scraped-seo-preview-description' },
            { title: 'manual-seo-title', description: 'manual-seo-description', slug: 'manual-seo-slug', previewTitle: 'manual-seo-preview-title', previewUrl: 'manual-seo-preview-url', previewDesc: 'manual-seo-preview-description' },
            { title: 'edit-seo-title', description: 'edit-seo-description', slug: 'edit-seo-slug', previewTitle: 'edit-seo-preview-title', previewUrl: 'edit-seo-preview-url', previewDesc: 'edit-seo-preview-description' }
        ];

        previewFields.forEach(field => {
            const titleInput = document.getElementById(field.title);
            const descInput = document.getElementById(field.description);
            const slugInput = document.getElementById(field.slug);
            
            if (titleInput && descInput && slugInput) {
                [titleInput, descInput, slugInput].forEach(input => {
                    input.addEventListener('input', () => updateSEOPreview(field.title));
                });
            }
        });
    }

    function updateSEOPreview(triggerFieldId) {
        const formPrefix = triggerFieldId.split('-')[0]; // scraped, manual, or edit
        const titleInput = document.getElementById(`${formPrefix}-seo-title`);
        const descInput = document.getElementById(`${formPrefix}-seo-description`);
        const slugInput = document.getElementById(`${formPrefix}-seo-slug`);
        
        if (!titleInput || !descInput || !slugInput) return;

        const previewTitle = document.getElementById(`${formPrefix}-seo-preview-title`);
        const previewUrl = document.getElementById(`${formPrefix}-seo-preview-url`);
        const previewDesc = document.getElementById(`${formPrefix}-seo-preview-description`);

        if (previewTitle) {
            const title = titleInput.value || 'Uygulama Adı - MacFreeApps';
            previewTitle.textContent = title;
        }

        if (previewUrl) {
            const slug = slugInput.value || 'uygulama-adi';
            previewUrl.textContent = `https://macfreeapps.com/${slug}`;
        }

        if (previewDesc) {
            const description = descInput.value || 'Ücretsiz Mac uygulaması indirin. En popüler ve güncel Mac uygulamaları MacFreeApps\'de.';
            previewDesc.textContent = description;
        }
    }

    function validateSEOFields(formData) {
        const errors = [];
        
        // Validate title length
        if (formData.seoTitle && formData.seoTitle.length > 60) {
            errors.push('SEO başlığı 60 karakterden uzun olamaz');
        }
        
        // Validate description length
        if (formData.seoDescription && formData.seoDescription.length > 160) {
            errors.push('SEO açıklaması 160 karakterden uzun olamaz');
        }
        
        // Validate slug format
        if (formData.seoSlug && !/^[a-z0-9-]+$/.test(formData.seoSlug)) {
            errors.push('URL slug sadece küçük harf, rakam ve tire içerebilir');
        }
        
        // Validate keywords length
        if (formData.seoKeywords && formData.seoKeywords.length > 200) {
            errors.push('Anahtar kelimeler 200 karakterden uzun olamaz');
        }
        
        return errors;
    }

    function generateSEOMetaTags(app) {
        const seoTitle = app.seoTitle || `${app.name} - Ücretsiz Mac Uygulaması | MacFreeApps`;
        const seoDescription = app.seoDescription || app.description || `${app.name} ücretsiz Mac uygulamasını indirin. En popüler Mac uygulamaları MacFreeApps'de.`;
        const seoKeywords = app.seoKeywords || `${app.name}, mac, uygulama, ücretsiz, ${app.category}`;
        const seoSlug = app.seoSlug || generateSlug(app.name);
        const seoImageAlt = app.seoImageAlt || `${app.name} uygulama logosu ve özellikleri`;

        return {
            title: seoTitle,
            description: seoDescription,
            keywords: seoKeywords,
            slug: seoSlug,
            imageAlt: seoImageAlt,
            featured: app.featured || false
        };
    }

    // Auto SEO Fill Functions
    function autoFillSEOFields(formPrefix, data) {
        const appName = data.name || '';
        const category = data.category || '';
        const description = data.description || '';
        const imageUrl = data.image || '';
        
        // SEO Başlığı otomatik oluştur
        const seoTitle = generateAutoSEOTitle(appName, category);
        document.getElementById(`${formPrefix}-seo-title`).value = seoTitle;
        
        // SEO Açıklaması otomatik oluştur
        const seoDescription = generateAutoSEODescription(appName, category, description);
        document.getElementById(`${formPrefix}-seo-description`).value = seoDescription;
        
        // SEO Anahtar Kelimeleri otomatik oluştur
        const seoKeywords = generateAutoSEOKeywords(appName, category, description);
        document.getElementById(`${formPrefix}-seo-keywords`).value = seoKeywords;
        
        // SEO Slug otomatik oluştur
        const seoSlug = generateAutoSEOSlug(appName);
        document.getElementById(`${formPrefix}-seo-slug`).value = seoSlug;
        
        // Resim Alt Metni otomatik oluştur
        const seoImageAlt = generateAutoSEOImageAlt(appName, category);
        document.getElementById(`${formPrefix}-seo-image-alt`).value = seoImageAlt;
        
        // Featured durumunu otomatik belirle
        const shouldBeFeatured = determineFeaturedStatus(appName, category, description);
        document.getElementById(`${formPrefix}-seo-featured`).checked = shouldBeFeatured;
        
        // Karakter sayılarını güncelle
        updateAllCharacterCounts(formPrefix);
        
        // SEO önizlemesini güncelle
        updateSEOPreview(`${formPrefix}-seo-title`);
        
        // SEO skorunu güncelle
        updateSEOScore(formPrefix);
    }
    
    function generateAutoSEOTitle(appName, category) {
        if (!appName) return '';
        
        // Kategoriye göre özelleştirilmiş başlık şablonları
        const templates = {
            'Oyunlar': `${appName} - Ücretsiz Mac Oyunu | MacFreeApps`,
            'Programlar': `${appName} - Ücretsiz Mac Programı | MacFreeApps`,
            'İş': `${appName} - Mac İş Uygulaması | MacFreeApps`,
            'Eğitim': `${appName} - Mac Eğitim Uygulaması | MacFreeApps`,
            'Grafik ve Tasarım': `${appName} - Mac Tasarım Uygulaması | MacFreeApps`,
            'Fotoğraf ve Video': `${appName} - Mac Medya Uygulaması | MacFreeApps`,
            'Verimlilik': `${appName} - Mac Verimlilik Uygulaması | MacFreeApps`,
            'Yardımcı Programlar': `${appName} - Mac Yardımcı Program | MacFreeApps`
        };
        
        const baseTemplate = templates[category] || `${appName} - Ücretsiz Mac Uygulaması | MacFreeApps`;
        
        // Uzunluk kontrolü (60 karakter altında)
        if (baseTemplate.length <= 60) {
            return baseTemplate;
        }
        
        // Kısaltılmış versiyon
        const shortTemplate = `${appName} Mac Uygulaması | MacFreeApps`;
        return shortTemplate.length <= 60 ? shortTemplate : `${appName} | MacFreeApps`;
    }
    
    function generateAutoSEODescription(appName, category, description) {
        if (!appName) return '';
        
        // Mevcut açıklamayı temel al
        let baseDescription = description || `${appName} hakkında detaylı bilgi`;
        
        // Kategoriye göre özelleştir
        const categoryPrefixes = {
            'Oyunlar': 'Mac için ücretsiz oyun',
            'Programlar': 'Mac için ücretsiz program',
            'İş': 'Mac için iş uygulaması',
            'Eğitim': 'Mac için eğitim uygulaması',
            'Grafik ve Tasarım': 'Mac için tasarım uygulaması',
            'Fotoğraf ve Video': 'Mac için medya uygulaması',
            'Verimlilik': 'Mac için verimlilik uygulaması',
            'Yardımcı Programlar': 'Mac için yardımcı program'
        };
        
        const categoryPrefix = categoryPrefixes[category] || 'Mac uygulaması';
        const seoDescription = `${categoryPrefix} ${appName}. ${baseDescription} MacFreeApps ile ücretsiz indirin.`;
        
        // 160 karakter altında tut
        if (seoDescription.length <= 160) {
            return seoDescription;
        }
        
        // Kısaltılmış versiyon
        const shortDescription = `${categoryPrefix} ${appName}. MacFreeApps ile ücretsiz indirin.`;
        return shortDescription.length <= 160 ? shortDescription : `${appName} Mac uygulaması. MacFreeApps ile ücretsiz indirin.`;
    }
    
    function generateAutoSEOKeywords(appName, category, description) {
        const keywords = new Set();
        
        // Temel anahtar kelimeler
        keywords.add('mac');
        keywords.add('uygulama');
        keywords.add('ücretsiz');
        keywords.add('indir');
        keywords.add('macfreeapps');
        
        // Uygulama adından anahtar kelimeler
        if (appName) {
            const nameWords = appName.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            nameWords.forEach(word => keywords.add(word));
        }
        
        // Kategori anahtar kelimeleri
        const categoryKeywords = {
            'Oyunlar': ['oyun', 'game', 'eğlence', 'mac oyun'],
            'Programlar': ['program', 'software', 'yazılım', 'mac program'],
            'İş': ['iş', 'business', 'ofis', 'mac iş'],
            'Eğitim': ['eğitim', 'education', 'öğrenme', 'mac eğitim'],
            'Grafik ve Tasarım': ['tasarım', 'design', 'grafik', 'mac tasarım'],
            'Fotoğraf ve Video': ['fotoğraf', 'video', 'medya', 'mac medya'],
            'Verimlilik': ['verimlilik', 'productivity', 'mac verimlilik'],
            'Yardımcı Programlar': ['yardımcı', 'utility', 'araç', 'mac araç']
        };
        
        if (categoryKeywords[category]) {
            categoryKeywords[category].forEach(keyword => keywords.add(keyword));
        }
        
        // Açıklamadan anahtar kelimeler
        if (description) {
            const descWords = description.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3 && !['mac', 'uygulama', 'ücretsiz'].includes(word))
                .slice(0, 5); // En fazla 5 kelime
            descWords.forEach(word => keywords.add(word));
        }
        
        // Array'e çevir ve virgülle ayır
        return Array.from(keywords).slice(0, 10).join(', ');
    }
    
    function generateAutoSEOSlug(appName) {
        if (!appName) return '';
        
        return appName.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Özel karakterleri kaldır
            .replace(/\s+/g, '-') // Boşlukları tire ile değiştir
            .replace(/-+/g, '-') // Çoklu tireleri tek tire yap
            .replace(/^-|-$/g, ''); // Başta ve sonda tire varsa kaldır
    }
    
    function generateAutoSEOImageAlt(appName, category) {
        if (!appName) return '';
        
        const categoryPrefixes = {
            'Oyunlar': 'Mac oyunu',
            'Programlar': 'Mac programı',
            'İş': 'Mac iş uygulaması',
            'Eğitim': 'Mac eğitim uygulaması',
            'Grafik ve Tasarım': 'Mac tasarım uygulaması',
            'Fotoğraf ve Video': 'Mac medya uygulaması',
            'Verimlilik': 'Mac verimlilik uygulaması',
            'Yardımcı Programlar': 'Mac yardımcı program'
        };
        
        const categoryPrefix = categoryPrefixes[category] || 'Mac uygulaması';
        return `${categoryPrefix} ${appName} ekran görüntüsü`;
    }
    
    function determineFeaturedStatus(appName, category, description) {
        // Öne çıkarılacak uygulamalar için kriterler
        const featuredKeywords = ['popüler', 'en iyi', 'önerilen', 'yeni', 'güncel', 'trend'];
        const hasFeaturedKeyword = featuredKeywords.some(keyword => 
            description.toLowerCase().includes(keyword) || 
            appName.toLowerCase().includes(keyword)
        );
        
        // Belirli kategorilerde öne çıkar
        const featuredCategories = ['Oyunlar', 'Programlar', 'Grafik ve Tasarım'];
        const isFeaturedCategory = featuredCategories.includes(category);
        
        // Uzun açıklaması olan uygulamalar
        const hasDetailedDescription = description && description.length > 100;
        
        return hasFeaturedKeyword || isFeaturedCategory || hasDetailedDescription;
    }
    
    function updateAllCharacterCounts(formPrefix) {
        const seoFields = [
            { id: `${formPrefix}-seo-title`, countId: `${formPrefix}-seo-title-count`, max: 60 },
            { id: `${formPrefix}-seo-description`, countId: `${formPrefix}-seo-description-count`, max: 160 },
            { id: `${formPrefix}-seo-keywords`, countId: `${formPrefix}-seo-keywords-count`, max: 200 },
            { id: `${formPrefix}-seo-slug`, countId: `${formPrefix}-seo-slug-count`, max: 100 },
            { id: `${formPrefix}-seo-image-alt`, countId: `${formPrefix}-seo-image-alt-count`, max: 125 }
        ];

        seoFields.forEach(field => {
            const input = document.getElementById(field.id);
            const counter = document.getElementById(field.countId);
            
            if (input && counter) {
                updateCharacterCount(input, counter, field.max);
            }
        });
    }

    // ML Model Integration
    let mlModel = null;
    let isMLModelLoaded = false;

    async function loadMLModel() {
        try {
            // TensorFlow.js'i yükle
            if (typeof tf === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
                document.head.appendChild(script);
                await new Promise(resolve => script.onload = resolve);
            }

            // Modeli yükle
            mlModel = await tf.loadLayersModel('localstorage://seo-model');
            isMLModelLoaded = true;
            console.log('ML Model başarıyla yüklendi');
            return true;
        } catch (error) {
            console.log('ML Model yüklenemedi, simüle edilmiş AI kullanılacak:', error.message);
            isMLModelLoaded = false;
            return false;
        }
    }

    async function predictWithML(appName, category, description) {
        if (!isMLModelLoaded || !mlModel) {
            return null;
        }

        try {
            // Özellikleri çıkar
            const features = extractMLFeatures({
                name: appName,
                category: category,
                description: description
            });

            // Tahmin yap
            const input = tf.tensor2d([features]);
            const prediction = mlModel.predict(input);
            const result = await prediction.array();

            // Tensörleri temizle
            input.dispose();
            prediction.dispose();

            // Sonuçları SEO skorlarına dönüştür
            return {
                titleScore: Math.round(result[0][0] * 100),
                descriptionScore: Math.round(result[0][1] * 100),
                keywordsScore: Math.round(result[0][2] * 100),
                slugScore: Math.round(result[0][3] * 100)
            };
        } catch (error) {
            console.error('ML tahmin hatası:', error);
            return null;
        }
    }

    function extractMLFeatures(app) {
        // Metin özelliklerini vektörleştir
        const nameFeatures = textToVector(app.name || '');
        const descriptionFeatures = textToVector(app.description || '');
        const categoryFeatures = categoryToVector(app.category || '');
        
        // Sayısal özellikler
        const numericFeatures = [
            (app.name || '').length / 100,
            (app.description || '').length / 200,
            0, // keywords count (will be filled later)
            app.featured ? 1 : 0,
            app.badgeType === 'new' ? 1 : (app.badgeType === 'updated' ? 0.5 : 0)
        ];
        
        return [...nameFeatures, ...descriptionFeatures, ...categoryFeatures, ...numericFeatures];
    }

    function textToVector(text) {
        const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        const vocabulary = [
            'mac', 'uygulama', 'ücretsiz', 'indir', 'download', 'free', 'app', 'software',
            'oyun', 'game', 'program', 'tool', 'iş', 'business', 'eğitim', 'education',
            'tasarım', 'design', 'grafik', 'graphic', 'fotoğraf', 'photo', 'video',
            'verimlilik', 'productivity', 'yardımcı', 'utility', 'macfree'
        ];
        
        const vector = new Array(vocabulary.length).fill(0);
        words.forEach(word => {
            const index = vocabulary.indexOf(word);
            if (index !== -1) {
                vector[index] += 1;
            }
        });
        
        const sum = vector.reduce((a, b) => a + b, 0);
        return sum > 0 ? vector.map(x => x / sum) : vector;
    }

    function categoryToVector(category) {
        const categories = [
            'Oyunlar', 'Programlar', 'İş', 'Eğitim', 'Grafik ve Tasarım', 
            'Fotoğraf ve Video', 'Verimlilik', 'Yardımcı Programlar'
        ];
        
        const vector = new Array(categories.length).fill(0);
        const index = categories.indexOf(category);
        if (index !== -1) {
            vector[index] = 1;
        }
        
        return vector;
    }

    // AI SEO Functions
    function initializeAISEO() {
        // AI button event listeners
        const aiButtons = [
            'scraped-ai-suggest-title', 'scraped-ai-suggest-description', 'scraped-ai-suggest-keywords', 'scraped-ai-analyze-seo',
            'manual-ai-suggest-title', 'manual-ai-suggest-description', 'manual-ai-suggest-keywords', 'manual-ai-analyze-seo',
            'edit-ai-suggest-title', 'edit-ai-suggest-description', 'edit-ai-suggest-keywords', 'edit-ai-analyze-seo'
        ];

        aiButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => handleAIAction(buttonId));
            }
        });

        // Auto-update SEO scores when fields change
        const seoFields = [
            'scraped-seo-title', 'scraped-seo-description', 'scraped-seo-keywords',
            'manual-seo-title', 'manual-seo-description', 'manual-seo-keywords',
            'edit-seo-title', 'edit-seo-description', 'edit-seo-keywords'
        ];

        seoFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    const formPrefix = fieldId.split('-')[0];
                    updateSEOScore(formPrefix);
                });
            }
        });
    }

    function handleAIAction(buttonId) {
        const [formPrefix, action] = buttonId.split('-ai-');
        
        switch(action) {
            case 'suggest-title':
                generateAITitle(formPrefix);
                break;
            case 'suggest-description':
                generateAIDescription(formPrefix);
                break;
            case 'suggest-keywords':
                generateAIKeywords(formPrefix);
                break;
            case 'analyze-seo':
                analyzeSEO(formPrefix);
                break;
        }
    }

    async function generateAITitle(formPrefix) {
        const appName = document.getElementById(`${formPrefix}-name`).value;
        const category = document.getElementById(`${formPrefix}-category`).value;
        const description = document.getElementById(`${formPrefix}-description`).value;

        if (!appName) {
            showAISuggestion(formPrefix, 'Uygulama adı gerekli', 'Lütfen önce uygulama adını girin.');
            return;
        }

        showLoadingState(formPrefix);
        
        try {
            // ML modeli ile tahmin yap
            const mlPrediction = await predictWithML(appName, category, description);
            
            let suggestions;
            if (mlPrediction) {
                // ML modeli kullan
                suggestions = generateMLTitleSuggestions(appName, category, description, mlPrediction);
                showAISuggestion(formPrefix, 'AI Başlık Önerileri (ML Model)', suggestions);
            } else {
                // Simüle edilmiş AI kullan
                suggestions = generateTitleSuggestions(appName, category, description);
                showAISuggestion(formPrefix, 'Başlık Önerileri (Simüle)', suggestions);
            }
            
            hideLoadingState(formPrefix);
        } catch (error) {
            console.error('AI başlık üretme hatası:', error);
            const suggestions = generateTitleSuggestions(appName, category, description);
            showAISuggestion(formPrefix, 'Başlık Önerileri (Fallback)', suggestions);
            hideLoadingState(formPrefix);
        }
    }

    function generateAIDescription(formPrefix) {
        const appName = document.getElementById(`${formPrefix}-name`).value;
        const category = document.getElementById(`${formPrefix}-category`).value;
        const description = document.getElementById(`${formPrefix}-description`).value;

        if (!appName) {
            showAISuggestion(formPrefix, 'Uygulama adı gerekli', 'Lütfen önce uygulama adını girin.');
            return;
        }

        showLoadingState(formPrefix);
        
        setTimeout(() => {
            const suggestions = generateDescriptionSuggestions(appName, category, description);
            showAISuggestion(formPrefix, 'Açıklama Önerileri', suggestions);
            hideLoadingState(formPrefix);
        }, 1500);
    }

    function generateAIKeywords(formPrefix) {
        const appName = document.getElementById(`${formPrefix}-name`).value;
        const category = document.getElementById(`${formPrefix}-category`).value;
        const description = document.getElementById(`${formPrefix}-description`).value;

        if (!appName) {
            showAISuggestion(formPrefix, 'Uygulama adı gerekli', 'Lütfen önce uygulama adını girin.');
            return;
        }

        showLoadingState(formPrefix);
        
        setTimeout(() => {
            const suggestions = generateKeywordSuggestions(appName, category, description);
            showAISuggestion(formPrefix, 'Anahtar Kelime Önerileri', suggestions);
            hideLoadingState(formPrefix);
        }, 1500);
    }

    function analyzeSEO(formPrefix) {
        const seoData = {
            title: document.getElementById(`${formPrefix}-seo-title`).value,
            description: document.getElementById(`${formPrefix}-seo-description`).value,
            keywords: document.getElementById(`${formPrefix}-seo-keywords`).value,
            slug: document.getElementById(`${formPrefix}-seo-slug`).value
        };

        showLoadingState(formPrefix);
        
        setTimeout(() => {
            const analysis = performSEOAnalysis(seoData);
            showAISuggestion(formPrefix, 'SEO Analizi', analysis);
            updateSEOScore(formPrefix);
            hideLoadingState(formPrefix);
        }, 2000);
    }

    function generateMLTitleSuggestions(appName, category, description, mlPrediction) {
        // ML modeli tahminlerine göre özelleştirilmiş öneriler
        const baseSuggestions = [
            `${appName} - Ücretsiz Mac Uygulaması | MacFreeApps`,
            `${appName} Mac İndir - Ücretsiz ${category} Uygulaması`,
            `${appName} - En İyi Mac ${category} Uygulaması`,
            `Mac ${appName} İndir - Ücretsiz ve Güvenli`,
            `${appName} Mac Uygulaması - Hızlı İndirme`
        ];

        // ML tahminlerine göre önerileri optimize et
        const optimizedSuggestions = baseSuggestions.map((title, index) => {
            let optimizedTitle = title;
            
            // ML skoruna göre optimizasyonlar
            if (mlPrediction.titleScore < 60) {
                // Başlık skoru düşükse, daha SEO dostu hale getir
                if (!optimizedTitle.includes('Mac')) {
                    optimizedTitle = optimizedTitle.replace(appName, `Mac ${appName}`);
                }
                if (!optimizedTitle.includes('Ücretsiz')) {
                    optimizedTitle = optimizedTitle.replace('Mac Uygulaması', 'Ücretsiz Mac Uygulaması');
                }
            }
            
            // ML skorunu kullan
            const mlScore = Math.round(mlPrediction.titleScore + (Math.random() - 0.5) * 10);
            const finalScore = Math.max(0, Math.min(100, mlScore));
            
            return {
                text: optimizedTitle,
                score: finalScore,
                action: `applyTitle${index}`,
                mlEnhanced: true
            };
        });

        return optimizedSuggestions;
    }

    function generateTitleSuggestions(appName, category, description) {
        const suggestions = [
            `${appName} - Ücretsiz Mac Uygulaması | MacFreeApps`,
            `${appName} Mac İndir - Ücretsiz ${category} Uygulaması`,
            `${appName} - En İyi Mac ${category} Uygulaması`,
            `Mac ${appName} İndir - Ücretsiz ve Güvenli`,
            `${appName} Mac Uygulaması - Hızlı İndirme`
        ];

        return suggestions.map((title, index) => ({
            text: title,
            score: calculateTitleScore(title),
            action: `applyTitle${index}`
        }));
    }

    function generateDescriptionSuggestions(appName, category, description) {
        const baseDescription = description || `${appName} hakkında detaylı bilgi`;
        
        const suggestions = [
            `${appName} ücretsiz Mac uygulamasını indirin. En popüler ${category} uygulamaları arasında yer alan ${appName}, Mac kullanıcıları için özel olarak tasarlanmıştır. Hızlı indirme ve güvenli kurulum.`,
            `Mac ${appName} uygulaması ile ${category} işlemlerinizi kolaylaştırın. Ücretsiz indirme, detaylı kullanım kılavuzu ve 7/24 destek. MacFreeApps'de en güncel sürümü indirin.`,
            `${appName} Mac uygulaması - ${category} kategorisinde en çok tercih edilen uygulamalardan biri. Ücretsiz, güvenli ve hızlı. MacFreeApps ile hemen indirin.`
        ];

        return suggestions.map((desc, index) => ({
            text: desc,
            score: calculateDescriptionScore(desc),
            action: `applyDescription${index}`
        }));
    }

    function generateKeywordSuggestions(appName, category, description) {
        const baseKeywords = [
            appName.toLowerCase(),
            'mac',
            'uygulama',
            'ücretsiz',
            'indir',
            'download',
            'macfree'
        ];

        if (category) {
            baseKeywords.push(category.toLowerCase());
        }

        // Add category-specific keywords
        const categoryKeywords = {
            'Oyunlar': ['oyun', 'game', 'eğlence', 'entertainment'],
            'Programlar': ['program', 'software', 'yazılım', 'tool'],
            'İş': ['business', 'iş', 'productivity', 'verimlilik'],
            'Eğitim': ['education', 'eğitim', 'learning', 'öğrenme'],
            'Grafik ve Tasarım': ['design', 'tasarım', 'graphic', 'grafik'],
            'Fotoğraf ve Video': ['photo', 'video', 'fotoğraf', 'görsel']
        };

        if (categoryKeywords[category]) {
            baseKeywords.push(...categoryKeywords[category]);
        }

        // Generate keyword combinations
        const suggestions = [
            baseKeywords.slice(0, 8).join(', '),
            baseKeywords.slice(0, 6).join(', ') + ', mac uygulamaları, ücretsiz indirme',
            baseKeywords.slice(0, 5).join(', ') + ', mac software, free download, macfree'
        ];

        return suggestions.map((keywords, index) => ({
            text: keywords,
            score: calculateKeywordsScore(keywords),
            action: `applyKeywords${index}`
        }));
    }

    function performSEOAnalysis(seoData) {
        const analysis = {
            title: analyzeTitle(seoData.title),
            description: analyzeDescription(seoData.description),
            keywords: analyzeKeywords(seoData.keywords),
            slug: analyzeSlug(seoData.slug),
            overall: 0
        };

        analysis.overall = Math.round((analysis.title.score + analysis.description.score + analysis.keywords.score + analysis.slug.score) / 4);

        return [
            {
                text: `Genel SEO Skoru: ${analysis.overall}/100`,
                score: analysis.overall,
                type: 'score'
            },
            {
                text: `Başlık: ${analysis.title.score}/100 - ${analysis.title.feedback}`,
                score: analysis.title.score,
                type: 'feedback'
            },
            {
                text: `Açıklama: ${analysis.description.score}/100 - ${analysis.description.feedback}`,
                score: analysis.description.score,
                type: 'feedback'
            },
            {
                text: `Anahtar Kelimeler: ${analysis.keywords.score}/100 - ${analysis.keywords.feedback}`,
                score: analysis.keywords.score,
                type: 'feedback'
            },
            {
                text: `URL Slug: ${analysis.slug.score}/100 - ${analysis.slug.feedback}`,
                score: analysis.slug.score,
                type: 'feedback'
            }
        ];
    }

    function analyzeTitle(title) {
        if (!title) return { score: 0, feedback: 'Başlık eksik' };
        
        let score = 0;
        let feedback = [];

        if (title.length >= 30 && title.length <= 60) {
            score += 40;
            feedback.push('İdeal uzunluk');
        } else if (title.length < 30) {
            score += 20;
            feedback.push('Çok kısa');
        } else {
            score += 10;
            feedback.push('Çok uzun');
        }

        if (title.includes('Mac') || title.includes('mac')) {
            score += 20;
            feedback.push('Mac kelimesi var');
        }

        if (title.includes('Ücretsiz') || title.includes('ücretsiz')) {
            score += 20;
            feedback.push('Ücretsiz kelimesi var');
        }

        if (title.includes('MacFreeApps')) {
            score += 20;
            feedback.push('Marka adı var');
        }

        return { score: Math.min(score, 100), feedback: feedback.join(', ') };
    }

    function analyzeDescription(description) {
        if (!description) return { score: 0, feedback: 'Açıklama eksik' };
        
        let score = 0;
        let feedback = [];

        if (description.length >= 120 && description.length <= 160) {
            score += 40;
            feedback.push('İdeal uzunluk');
        } else if (description.length < 120) {
            score += 20;
            feedback.push('Çok kısa');
        } else {
            score += 10;
            feedback.push('Çok uzun');
        }

        if (description.includes('Mac')) {
            score += 20;
            feedback.push('Mac kelimesi var');
        }

        if (description.includes('ücretsiz') || description.includes('indir')) {
            score += 20;
            feedback.push('Eylem kelimeleri var');
        }

        if (description.includes('MacFreeApps')) {
            score += 20;
            feedback.push('Marka adı var');
        }

        return { score: Math.min(score, 100), feedback: feedback.join(', ') };
    }

    function analyzeKeywords(keywords) {
        if (!keywords) return { score: 0, feedback: 'Anahtar kelimeler eksik' };
        
        let score = 0;
        let feedback = [];

        const keywordCount = keywords.split(',').length;
        if (keywordCount >= 5 && keywordCount <= 10) {
            score += 40;
            feedback.push('İdeal sayıda anahtar kelime');
        } else if (keywordCount < 5) {
            score += 20;
            feedback.push('Az anahtar kelime');
        } else {
            score += 10;
            feedback.push('Çok fazla anahtar kelime');
        }

        if (keywords.includes('mac')) {
            score += 20;
            feedback.push('Mac kelimesi var');
        }

        if (keywords.includes('ücretsiz')) {
            score += 20;
            feedback.push('Ücretsiz kelimesi var');
        }

        if (keywords.includes('indir')) {
            score += 20;
            feedback.push('İndir kelimesi var');
        }

        return { score: Math.min(score, 100), feedback: feedback.join(', ') };
    }

    function analyzeSlug(slug) {
        if (!slug) return { score: 0, feedback: 'Slug eksik' };
        
        let score = 0;
        let feedback = [];

        if (slug.length >= 5 && slug.length <= 50) {
            score += 40;
            feedback.push('İdeal uzunluk');
        } else if (slug.length < 5) {
            score += 20;
            feedback.push('Çok kısa');
        } else {
            score += 10;
            feedback.push('Çok uzun');
        }

        if (/^[a-z0-9-]+$/.test(slug)) {
            score += 30;
            feedback.push('Doğru format');
        } else {
            score += 0;
            feedback.push('Yanlış format');
        }

        if (!slug.includes('--')) {
            score += 20;
            feedback.push('Temiz format');
        } else {
            score += 0;
            feedback.push('Çift tire var');
        }

        if (!slug.startsWith('-') && !slug.endsWith('-')) {
            score += 10;
            feedback.push('Temiz başlangıç/bitiş');
        } else {
            score += 0;
            feedback.push('Tire ile başlıyor/bitiyor');
        }

        return { score: Math.min(score, 100), feedback: feedback.join(', ') };
    }

    function calculateTitleScore(title) {
        let score = 0;
        if (title.length >= 30 && title.length <= 60) score += 40;
        if (title.includes('Mac')) score += 20;
        if (title.includes('Ücretsiz')) score += 20;
        if (title.includes('MacFreeApps')) score += 20;
        return Math.min(score, 100);
    }

    function calculateDescriptionScore(description) {
        let score = 0;
        if (description.length >= 120 && description.length <= 160) score += 40;
        if (description.includes('Mac')) score += 20;
        if (description.includes('ücretsiz')) score += 20;
        if (description.includes('MacFreeApps')) score += 20;
        return Math.min(score, 100);
    }

    function calculateKeywordsScore(keywords) {
        let score = 0;
        const keywordCount = keywords.split(',').length;
        if (keywordCount >= 5 && keywordCount <= 10) score += 40;
        if (keywords.includes('mac')) score += 20;
        if (keywords.includes('ücretsiz')) score += 20;
        if (keywords.includes('indir')) score += 20;
        return Math.min(score, 100);
    }

    function showAISuggestion(formPrefix, title, suggestions) {
        const suggestionsContainer = document.getElementById(`${formPrefix}-ai-suggestions`);
        const contentContainer = document.getElementById(`${formPrefix}-suggestion-content`);
        
        if (!suggestionsContainer || !contentContainer) return;

        let html = `<h6><i class="fas fa-lightbulb"></i> ${title}</h6>`;
        
        if (Array.isArray(suggestions)) {
            suggestions.forEach((suggestion, index) => {
                html += `
                    <div class="suggestion-item">
                        <div class="suggestion-title">${suggestion.text}</div>
                        <div class="suggestion-text">Skor: ${suggestion.score}/100</div>
                        <div class="suggestion-actions">
                            <button class="btn-suggestion" onclick="applyAISuggestion('${formPrefix}', '${suggestion.action}', '${suggestion.text.replace(/'/g, "\\'")}')">
                                <i class="fas fa-check"></i> Uygula
                            </button>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<div class="suggestion-item"><div class="suggestion-text">${suggestions}</div></div>`;
        }

        contentContainer.innerHTML = html;
        suggestionsContainer.style.display = 'block';
    }

    function showLoadingState(formPrefix) {
        const button = document.querySelector(`#${formPrefix}-ai-analyze-seo`);
        if (button) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analiz Ediliyor...';
            button.disabled = true;
        }
    }

    function hideLoadingState(formPrefix) {
        const button = document.querySelector(`#${formPrefix}-ai-analyze-seo`);
        if (button) {
            button.innerHTML = '<i class="fas fa-chart-line"></i> SEO Analiz Et';
            button.disabled = false;
        }
    }

    function updateSEOScore(formPrefix) {
        const title = document.getElementById(`${formPrefix}-seo-title`).value;
        const description = document.getElementById(`${formPrefix}-seo-description`).value;
        const keywords = document.getElementById(`${formPrefix}-seo-keywords`).value;

        const titleScore = calculateTitleScore(title);
        const descriptionScore = calculateDescriptionScore(description);
        const keywordsScore = calculateKeywordsScore(keywords);
        const overallScore = Math.round((titleScore + descriptionScore + keywordsScore) / 3);

        // Update score circle
        const scoreCircle = document.getElementById(`${formPrefix}-score-circle`);
        const scoreNumber = document.getElementById(`${formPrefix}-score-number`);
        if (scoreCircle && scoreNumber) {
            scoreNumber.textContent = overallScore;
            const percentage = (overallScore / 100) * 360;
            scoreCircle.style.background = `conic-gradient(#4caf50 ${percentage}deg, #e0e0e0 ${percentage}deg)`;
        }

        // Update individual scores
        updateScoreBar(`${formPrefix}-title-score`, `${formPrefix}-title-value`, titleScore);
        updateScoreBar(`${formPrefix}-description-score`, `${formPrefix}-description-value`, descriptionScore);
        updateScoreBar(`${formPrefix}-keywords-score`, `${formPrefix}-keywords-value`, keywordsScore);
    }

    function updateScoreBar(barId, valueId, score) {
        const bar = document.getElementById(barId);
        const value = document.getElementById(valueId);
        if (bar && value) {
            bar.style.width = `${score}%`;
            value.textContent = `${score}/100`;
        }
    }

    // Global function for AI suggestions
    window.applyAISuggestion = function(formPrefix, action, text) {
        if (action.startsWith('applyTitle')) {
            document.getElementById(`${formPrefix}-seo-title`).value = text;
            updateCharacterCount(document.getElementById(`${formPrefix}-seo-title`), document.getElementById(`${formPrefix}-seo-title-count`), 60);
        } else if (action.startsWith('applyDescription')) {
            document.getElementById(`${formPrefix}-seo-description`).value = text;
            updateCharacterCount(document.getElementById(`${formPrefix}-seo-description`), document.getElementById(`${formPrefix}-seo-description-count`), 160);
        } else if (action.startsWith('applyKeywords')) {
            document.getElementById(`${formPrefix}-seo-keywords`).value = text;
            updateCharacterCount(document.getElementById(`${formPrefix}-seo-keywords`), document.getElementById(`${formPrefix}-seo-keywords-count`), 200);
        }
        
        updateSEOPreview(`${formPrefix}-seo-title`);
        updateSEOScore(formPrefix);
    };

    async function fetchApps() {
        try {
            const response = await fetch(`${API_URL}?limit=0`);
            if (!response.ok) throw new Error(`HTTP Hatası: ${response.status}`);
            const data = await response.json();
            allApps = data.apps;
            filteredApps = [...allApps]; // Initialize filtered apps
            updateCategorySuggestions();
            populateCategoryFilter();
            renderAppsTable();
            updateStats(filteredApps);
            updatePagination();
            spinner.style.display = 'none';
            appTable.style.display = '';
        } catch (error) {
            console.error('Failed to fetch apps:', error);
            const errorMessage = error.message.includes('Failed to fetch') 
                ? 'Sunucuya bağlanılamıyor. Sunucunun çalıştığından emin olun.' 
                : `Hata: ${error.message}`;
            spinner.outerHTML = `<p class="error-message">${errorMessage}</p>`;
        }
    }

    function renderTable(appsToRender) {
        // Use the new rendering system
        renderAppsTable();
    }

    function sortAndRender() {
        // Use the new filtering system
        applyFilters();
    }

    function updateSortIndicators() {
        document.querySelectorAll('.sortable-header').forEach(header => {
            const key = header.dataset.sortKey;
            const indicator = header.querySelector('.sort-indicator');
            if (key === currentSort.key) {
                header.classList.remove('sort-asc', 'sort-desc');
                header.classList.add(`sort-${currentSort.order}`);
                indicator.textContent = currentSort.order === 'asc' ? '▲' : '▼';
            } else {
                header.classList.remove('sort-asc', 'sort-desc');
                indicator.textContent = '';
            }
        });
    }

    searchInput.addEventListener('input', sortAndRender);

    tableHeader.addEventListener('click', (e) => {
        const header = e.target.closest('.sortable-header');
        if (!header) return;

        const sortKey = header.dataset.sortKey;
        if (currentSort.key === sortKey) {
            currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.key = sortKey;
            currentSort.order = 'asc';
        }
        sortAndRender();
    });

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const urlInput = document.getElementById('app-url');
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Lütfen bir URL girin.');
            urlInput.focus();
            return;
        }

        // URL validation
        try {
            new URL(url);
        } catch {
            alert('Lütfen geçerli bir URL girin.');
            urlInput.focus();
            return;
        }

        const submitButton = addForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Bilgiler çekiliyor...';
        submitButton.disabled = true;

        try {
            const response = await fetch(SCRAPE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `URL'den veri çekilemedi: ${response.statusText}`);
            }
            
            const scrapedData = await response.json();
            
            // Fill the scraped data form
            fillScrapedDataForm(scrapedData);
            
            // Switch to scraped data form
            showScrapedDataForm();

        } catch (error) {
            alert(`Hata: ${error.message}`);
        } finally {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    });

    appListBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const appName = row.dataset.appName;
        const app = allApps.find(a => a.name === appName);
        if (!app) return;

        if (e.target.classList.contains('edit-btn')) {
            e.preventDefault();
            openEditModal(app, false); // isNew = false
        }
        if (e.target.classList.contains('delete-btn')) {
            e.preventDefault();
            if (confirm(`'${app.name}' uygulamasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
                deleteApp(app.name);
            }
        }
    });

    async function deleteApp(appName) {
        try {
            const response = await fetch(`${API_URL}/${encodeURIComponent(appName)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`Sunucu hatası: ${response.statusText}`);
            
            // Update both allApps and filteredApps
            allApps = allApps.filter(a => a.name !== appName);
            filteredApps = filteredApps.filter(a => a.name !== appName);
            
            // Reset to first page if current page is empty
            const totalPages = Math.ceil(filteredApps.length / itemsPerPage);
            if (currentPage > totalPages && totalPages > 0) {
                currentPage = totalPages;
            } else if (totalPages === 0) {
                currentPage = 1;
            }
            
            // Update display
            renderAppsTable();
            updateStats(filteredApps);
            updatePagination();
        } catch (error) {
            alert(`Uygulama silinemedi: ${error.message}`);
        }
    }

    function openEditModal(app, isNew = false) {
        editModalTitle.textContent = isNew ? 'Yeni Uygulama Ekle' : `Düzenle: ${app.name}`;
        
        // Form alanlarını doldur
        document.getElementById('edit-name').value = app.name || '';
        
        // Kategori seçimini otomatik yap - retry mekanizması ile
        const setCategoryValue = () => {
            const categorySelect = document.getElementById('edit-category');
            console.log('Kategori seçimi yapılıyor:', app.category, 'Seçici:', categorySelect);
            
            if (app.category && categorySelect) {
                // Önce basit value set et
                categorySelect.value = app.category;
                console.log('Kategori value set edildi:', categorySelect.value);
                
                // Sonra option'ları kontrol et
                const options = categorySelect.querySelectorAll('option');
                console.log('Bulunan option sayısı:', options.length);
                
                let categoryFound = false;
                for (let option of options) {
                    if (option.value === app.category) {
                        option.selected = true;
                        categoryFound = true;
                        console.log('Kategori bulundu ve seçildi:', option.value);
                        break;
                    }
                }
                
                // Eğer kategori bulunamazsa, value'yu tekrar set et
                if (!categoryFound) {
                    categorySelect.value = app.category;
                    console.log('Kategori bulunamadı, value tekrar set edildi:', categorySelect.value);
                }
            }
        };
        
        // Hemen dene
        setCategoryValue();
        
        // Eğer kategori seçici henüz yüklenmemişse, biraz bekle ve tekrar dene
        setTimeout(setCategoryValue, 100);
        setTimeout(setCategoryValue, 500);
        
        document.getElementById('edit-version').value = app.version || '';
        document.getElementById('edit-size').value = app.fileSize || '';
        document.getElementById('edit-image').value = app.image || '';
        document.getElementById('edit-download').value = app.downloadUrl || '';
        document.getElementById('edit-website').value = app.website || '';
        
        // Rozet seçimini ayarla
        const badgeType = app.badgeType || 'none';
        const badgeRadio = document.querySelector(`input[name="edit-badge"][value="${badgeType}"]`);
        if (badgeRadio) {
            badgeRadio.checked = true;
        } else {
            // Varsayılan olarak 'none' seç
            document.querySelector('input[name="edit-badge"][value="none"]').checked = true;
        }

        // SEO alanlarını doldur
        document.getElementById('edit-seo-title').value = app.seoTitle || '';
        document.getElementById('edit-seo-description').value = app.seoDescription || '';
        document.getElementById('edit-seo-keywords').value = app.seoKeywords || '';
        document.getElementById('edit-seo-slug').value = app.seoSlug || '';
        document.getElementById('edit-seo-image-alt').value = app.seoImageAlt || '';
        document.getElementById('edit-seo-featured').checked = app.featured || false;

        // SEO preview'ı güncelle
        updateSEOPreview('edit-seo-title');
        document.getElementById('edit-description').value = app.description || '';
        
        // Uygulama içi görselleri doldur
        const internalImages = app.internalImages || [];
        document.getElementById('edit-internal-images').value = internalImages.join('\n');
        
        // Sistem gereksinimlerini doldur
        const systemRequirements = app.systemRequirements || [];
        document.getElementById('edit-system-requirements').value = systemRequirements.join('\n');
        
        // Güncelleme notlarını doldur
        const updateNotes = app.features || [];
        document.getElementById('edit-update-notes').value = updateNotes.join('\n');

        // Show image preview if available
        if (app.image) {
            const previewImg = document.getElementById('edit-preview-img');
            const previewContainer = document.getElementById('edit-image-preview');
            previewImg.src = app.image;
            previewContainer.style.display = 'block';
        } else {
            document.getElementById('edit-image-preview').style.display = 'none';
        }

        // Kategori seçeneklerini güncelle
        updateCategorySuggestions();

        editModal.style.display = 'block';
    }

    // Düzenleme formu submit handler
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const appName = document.getElementById('edit-name').value;
        const originalAppName = editModalTitle.textContent.includes('Düzenle:') ? 
            editModalTitle.textContent.replace('Düzenle: ', '') : null;
        
        // Mevcut uygulamanın bilgilerini al
        const currentApp = allApps.find(a => a.name === originalAppName);
        
        // Rozet seçimini al
        const badgeType = document.querySelector('input[name="edit-badge"]:checked')?.value || 'none';

        // SEO fields
        const seoData = {
            seoTitle: document.getElementById('edit-seo-title').value.trim(),
            seoDescription: document.getElementById('edit-seo-description').value.trim(),
            seoKeywords: document.getElementById('edit-seo-keywords').value.trim(),
            seoSlug: document.getElementById('edit-seo-slug').value.trim(),
            seoImageAlt: document.getElementById('edit-seo-image-alt').value.trim(),
            featured: document.getElementById('edit-seo-featured').checked
        };

        // Validate SEO fields
        const seoErrors = validateSEOFields(seoData);
        if (seoErrors.length > 0) {
            alert('SEO Hataları:\n' + seoErrors.join('\n'));
            return;
        }

        const updatedApp = {
            name: appName,
            category: document.getElementById('edit-category').value,
            version: document.getElementById('edit-version').value,
            fileSize: document.getElementById('edit-size').value,
            image: document.getElementById('edit-image').value,
            downloadUrl: document.getElementById('edit-download').value,
            website: document.getElementById('edit-website').value,
            description: document.getElementById('edit-description').value,
            internalImages: document.getElementById('edit-internal-images').value.split('\n').filter(line => line.trim()),
            systemRequirements: document.getElementById('edit-system-requirements').value.split('\n').filter(line => line.trim()),
            features: document.getElementById('edit-update-notes').value.split('\n').filter(line => line.trim()),
            // Mevcut tarihleri koru
            creationDate: currentApp ? currentApp.creationDate : new Date().toISOString(),
            lastModified: new Date().toISOString(), // Güncelleme tarihini şimdi yap
            reviews: currentApp ? currentApp.reviews : [],
            badgeType: badgeType,
            ...seoData
        };

        try {
            let response;
            if (originalAppName) {
                // Güncelleme
                response = await fetch(`${API_URL}/${encodeURIComponent(originalAppName)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedApp)
                });
            } else {
                // Yeni ekleme
                response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedApp)
                });
            }

            if (response.status === 409) {
                alert('Bu isimde bir uygulama zaten mevcut.');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Sunucu hatası: ${response.statusText}`);
            }
            
            const savedApp = await response.json();
            
            if (originalAppName) {
                // Güncelleme
                const appIndex = allApps.findIndex(a => a.name === originalAppName);
                if (appIndex !== -1) {
                    allApps[appIndex] = savedApp;
                }
            } else {
                // Yeni ekleme
                allApps.unshift(savedApp);
            }

            sortAndRender();
            editModal.style.display = 'none';

        } catch (error) {
            alert(`Uygulama kaydedilemedi: ${error.message}`);
        }
    });

    // Modal kapatma event listener'ları
    closeModalBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    document.getElementById('edit-cancel-btn').addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    // Modal dışına tıklandığında kapat
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
        }
    });

    // Görsel önizleme için event listener
    document.getElementById('edit-image').addEventListener('input', (e) => {
        const previewImg = document.getElementById('edit-preview-img');
        const previewContainer = document.getElementById('edit-image-preview');
        
        if (e.target.value) {
            previewImg.src = e.target.value;
            previewContainer.style.display = 'block';
        } else {
            previewContainer.style.display = 'none';
        }
    });

    function createCategoryInputWithDatalist(key, value) {
        const container = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `edit-${key}`;
        input.value = value;
        input.setAttribute('list', 'category-datalist');
        input.placeholder = 'örn: Medya > Video Oynatıcı';

        let datalist = document.getElementById('category-datalist');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'category-datalist';
            document.body.appendChild(datalist);
        }
        
        datalist.innerHTML = '';
        const uniqueCategories = [...new Set(allApps.map(app => app.category).filter(Boolean))];
        uniqueCategories.sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist.appendChild(option);
        });

        container.appendChild(input);
        return container;
    }

    function createFormGroup(key, config, value) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        if (config.fullWidth) formGroup.classList.add('full-width');
        
        const label = document.createElement('label');
        label.textContent = config.label;
        formGroup.appendChild(label);

        let inputElement;
        switch (config.type) {
            case 'textarea':
                inputElement = document.createElement('textarea');
                inputElement.id = `edit-${key}`;
                inputElement.value = value;
                break;
            case 'list':
                inputElement = createDynamicList(key, Array.isArray(value) ? value : []);
                inputElement.id = `edit-${key}`;
                break;
            case 'image-preview':
                inputElement = createImagePreviewInput(key, value);
                break;
            case 'category':
                inputElement = createCategoryInputWithDatalist(key, value);
                break;
            case 'readonly':
                inputElement = document.createElement('input');
                inputElement.type = 'text';
                inputElement.value = value ? new Date(value).toLocaleString('tr-TR') : '-';
                inputElement.readOnly = true;
                break;
            default:
                inputElement = document.createElement('input');
                inputElement.type = config.type;
                inputElement.value = value;
        }
        if (inputElement.id !== `edit-${key}` && config.type !== 'list' && config.type !== 'image-preview' && config.type !== 'category') {
            inputElement.id = `edit-${key}`;
        }
        formGroup.appendChild(inputElement);
        return formGroup;
    }

    function createDynamicList(key, values) {
        const container = document.createElement('div');
        const currentValues = [...values];

        const renderList = () => {
            container.innerHTML = '';
            currentValues.forEach((val, i) => {
                const item = document.createElement('div');
                item.className = 'dynamic-list-item';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = val;
                input.onchange = (e) => { currentValues[i] = e.target.value; };
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.textContent = 'Sil';
                removeBtn.className = 'btn btn-danger btn-sm';
                removeBtn.onclick = () => { currentValues.splice(i, 1); renderList(); };
                item.appendChild(input);
                item.appendChild(removeBtn);
                container.appendChild(item);
            });
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.textContent = 'Yeni Ekle';
            addBtn.className = 'btn btn-secondary btn-sm';
            addBtn.style.marginTop = '5px';
            addBtn.onclick = () => { currentValues.push(''); renderList(); };
            container.appendChild(addBtn);
        };
        renderList();
        return container;
    }

    function createImagePreviewInput(key, value) {
        const container = document.createElement('div');
        const input = document.createElement('input');
        input.id = `edit-${key}`;
        input.type = 'text';
        input.value = value;
        const img = document.createElement('img');
        img.className = 'image-preview';
        img.src = value || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        input.oninput = () => { img.src = input.value || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; };
        container.appendChild(input);
        container.appendChild(img);
        return container;
    }

    function createCategoryDropdown(key, value) {
        const select = document.createElement('select');
        const categories = [...allCategories];
        if (value && !categories.includes(value)) {
            categories.push(value);
        }
        const newOption = document.createElement('option');
        newOption.value = "__new__";
        newOption.textContent = "(Yeni Kategori Oluştur)";
        select.appendChild(newOption);

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            if (cat === value) option.selected = true;
            select.appendChild(option);
        });

        select.onchange = () => {
            if (select.value === '__new__') {
                const newCategory = prompt('Yeni kategori adını girin:');
                if (newCategory) {
                    // Kategori otomatik olarak API'den yüklenecek
                    const option = document.createElement('option');
                    option.value = newCategory;
                    option.textContent = newCategory;
                    select.appendChild(option);
                    option.selected = true;
                } else {
                    select.value = value;
                }
            }
        };
        return select;
    }


    // Kategori yönetimi fonksiyonları kaldırıldı - sabit kategoriler kullanılıyor

    closeModalBtn.addEventListener('click', () => editModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === editModal) editModal.style.display = 'none';
    });

    // Kategori ekleme formu kaldırıldı - sabit kategoriler kullanılıyor

    // Method tab switching
    const methodTabs = document.querySelectorAll('.method-tab');
    const formContents = document.querySelectorAll('.add-form-content');
    
    methodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const method = tab.dataset.method;
            
            // Update active tab
            methodTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding form
            formContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${method}-add-form`).classList.add('active');
        });
    });

    // Manual form handling
    const manualForm = document.getElementById('manual-add-app-form');
    const clearManualFormBtn = document.getElementById('clear-manual-form');
    const manualImageInput = document.getElementById('manual-image');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');

    // Scraped form handling
    const scrapedForm = document.getElementById('scraped-app-form');
    const backToUrlFormBtn = document.getElementById('back-to-url-form');
    const clearScrapedFormBtn = document.getElementById('clear-scraped-form');
    const scrapedImageInput = document.getElementById('scraped-image');
    const scrapedImagePreview = document.getElementById('scraped-image-preview');
    const scrapedPreviewImg = document.getElementById('scraped-preview-img');

    // Image preview functionality
    if (manualImageInput) {
        manualImageInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url) {
                previewImg.src = url;
                imagePreview.style.display = 'block';
                previewImg.onerror = () => {
                    imagePreview.style.display = 'none';
                };
            } else {
                imagePreview.style.display = 'none';
            }
        });
    }

    // Clear manual form
    if (clearManualFormBtn) {
        clearManualFormBtn.addEventListener('click', () => {
            manualForm.reset();
            imagePreview.style.display = 'none';
        });
    }

    // Scraped form image preview
    if (scrapedImageInput) {
        scrapedImageInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url) {
                scrapedPreviewImg.src = url;
                scrapedImagePreview.style.display = 'block';
                scrapedPreviewImg.onerror = () => {
                    scrapedImagePreview.style.display = 'none';
                };
            } else {
                scrapedImagePreview.style.display = 'none';
            }
        });
    }

    // Back to URL form
    if (backToUrlFormBtn) {
        backToUrlFormBtn.addEventListener('click', backToUrlForm);
    }

    // Clear scraped form
    if (clearScrapedFormBtn) {
        clearScrapedFormBtn.addEventListener('click', clearScrapedForm);
    }

    // Manual form submission
    if (manualForm) {
        manualForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(manualForm);
            // Sürüm formatını düzelt - sadece versiyon numarası
            let version = document.getElementById('manual-version').value.trim();
            if (version) {
                // "Sürüm" kelimesini kaldır ve sadece versiyon numarasını al
                version = version.replace(/^sürüm\s*/i, '').trim();
                const versionMatch = version.match(/(\d+(?:\.\d+)*)/);
                if (versionMatch) {
                    version = versionMatch[1]; // Sadece versiyon numarası
                }
            }

            // Uygulama içi görselleri işle
            const internalImagesText = document.getElementById('manual-internal-images').value.trim();
            const internalImages = internalImagesText ? 
                internalImagesText.split('\n').map(url => url.trim()).filter(url => url) : [];

            // Sistem gereksinimlerini işle
            const systemRequirementsText = document.getElementById('manual-system-requirements').value.trim();
            const systemRequirements = systemRequirementsText ? 
                systemRequirementsText.split('\n').map(req => req.trim()).filter(req => req) : [];

            // Güncelleme notlarını işle
            const updateNotesText = document.getElementById('manual-update-notes').value.trim();
            const updateNotes = updateNotesText ? 
                updateNotesText.split('\n').map(note => note.trim()).filter(note => note) : [];

            // Rozet seçimini al
            const badgeType = document.querySelector('input[name="manual-badge"]:checked')?.value || 'none';

            // SEO fields
            const seoData = {
                seoTitle: document.getElementById('manual-seo-title').value.trim(),
                seoDescription: document.getElementById('manual-seo-description').value.trim(),
                seoKeywords: document.getElementById('manual-seo-keywords').value.trim(),
                seoSlug: document.getElementById('manual-seo-slug').value.trim(),
                seoImageAlt: document.getElementById('manual-seo-image-alt').value.trim(),
                featured: document.getElementById('manual-seo-featured').checked
            };

            // Validate SEO fields
            const seoErrors = validateSEOFields(seoData);
            if (seoErrors.length > 0) {
                alert('SEO Hataları:\n' + seoErrors.join('\n'));
                return;
            }

            const appData = {
                name: document.getElementById('manual-name').value.trim(),
                category: document.getElementById('manual-category').value.trim() || 'Kategorisiz',
                version: version,
                fileSize: document.getElementById('manual-size').value.trim(),
                image: document.getElementById('manual-image').value.trim(),
                downloadLink: document.getElementById('manual-download').value.trim(),
                website: document.getElementById('manual-website').value.trim(),
                description: document.getElementById('manual-description').value.trim(),
                features: updateNotes,
                installation: [],
                internalImages: internalImages,
                systemRequirements: systemRequirements,
                badgeType: badgeType,
                ...seoData
            };

            // Validation
            if (!appData.name) {
                alert('Uygulama adı zorunludur.');
                return;
            }

            const submitButton = manualForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Oluşturuluyor...';
            submitButton.disabled = true;

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(appData)
                });

                if (response.status === 409) {
                    alert('Bu isimde bir uygulama zaten mevcut.');
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Sunucu hatası: ${response.statusText}`);
                }

                const savedApp = await response.json();
                allApps.unshift(savedApp);
                sortAndRender();
                manualForm.reset();
                imagePreview.style.display = 'none';
                
                // Show success message
                alert(`"${savedApp.name}" uygulaması başarıyla oluşturuldu!`);

            } catch (error) {
                alert(`Hata: ${error.message}`);
            } finally {
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }

    // Scraped form submission
    if (scrapedForm) {
        scrapedForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Sürüm formatını düzelt - sadece versiyon numarası
            let version = document.getElementById('scraped-version').value.trim();
            if (version) {
                // "Sürüm" kelimesini kaldır ve sadece versiyon numarasını al
                version = version.replace(/^sürüm\s*/i, '').trim();
                const versionMatch = version.match(/(\d+(?:\.\d+)*)/);
                if (versionMatch) {
                    version = versionMatch[1]; // Sadece versiyon numarası
                }
            }

            // Uygulama içi görselleri işle
            const internalImagesText = document.getElementById('scraped-internal-images').value.trim();
            const internalImages = internalImagesText ? 
                internalImagesText.split('\n').map(url => url.trim()).filter(url => url) : [];

            // Sistem gereksinimlerini işle
            const systemRequirementsText = document.getElementById('scraped-system-requirements').value.trim();
            const systemRequirements = systemRequirementsText ? 
                systemRequirementsText.split('\n').map(req => req.trim()).filter(req => req) : [];

            // Güncelleme notlarını işle
            const updateNotesText = document.getElementById('scraped-update-notes').value.trim();
            const updateNotes = updateNotesText ? 
                updateNotesText.split('\n').map(note => note.trim()).filter(note => note) : [];

            // SEO fields
            const seoData = {
                seoTitle: document.getElementById('scraped-seo-title').value.trim(),
                seoDescription: document.getElementById('scraped-seo-description').value.trim(),
                seoKeywords: document.getElementById('scraped-seo-keywords').value.trim(),
                seoSlug: document.getElementById('scraped-seo-slug').value.trim(),
                seoImageAlt: document.getElementById('scraped-seo-image-alt').value.trim(),
                featured: document.getElementById('scraped-seo-featured').checked
            };

            // Validate SEO fields
            const seoErrors = validateSEOFields(seoData);
            if (seoErrors.length > 0) {
                alert('SEO Hataları:\n' + seoErrors.join('\n'));
                return;
            }

            const appData = {
                name: document.getElementById('scraped-name').value.trim(),
                category: document.getElementById('scraped-category').value.trim() || 'Kategorisiz',
                version: version,
                fileSize: document.getElementById('scraped-size').value.trim(),
                image: document.getElementById('scraped-image').value.trim(),
                downloadLink: document.getElementById('scraped-download').value.trim(),
                website: document.getElementById('scraped-website').value.trim(),
                description: document.getElementById('scraped-description').value.trim(),
                features: updateNotes,
                installation: [],
                internalImages: internalImages,
                systemRequirements: systemRequirements,
                ...seoData
            };

            // Validation
            if (!appData.name) {
                alert('Uygulama adı zorunludur.');
                return;
            }

            const submitButton = scrapedForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Kaydediliyor...';
            submitButton.disabled = true;

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(appData)
                });

                if (response.status === 409) {
                    alert('Bu isimde bir uygulama zaten mevcut.');
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Sunucu hatası: ${response.statusText}`);
                }

                const savedApp = await response.json();
                allApps.unshift(savedApp);
                sortAndRender();
                clearScrapedForm();
                
                // Show success message
                alert(`"${savedApp.name}" uygulaması başarıyla oluşturuldu!`);

        } catch (error) {
            alert(`Hata: ${error.message}`);
            } finally {
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }

    // Populate category suggestions
    async function updateCategorySuggestions() {
        try {
            console.log('Kategoriler yükleniyor...');
            const response = await fetch(CATEGORIES_API_URL);
            const categoryData = await response.json();
            console.log('Kategori verisi:', categoryData);
            
            // Hiyerarşik kategorileri yükle
            const hierarchy = categoryData.hierarchy || {};
            const existing = categoryData.existing || [];
            console.log('Hiyerarşi:', hierarchy);
            console.log('Mevcut kategoriler:', existing);
            
            // Manuel form için - retry mekanizması ile
            let attempts = 0;
            const maxAttempts = 10;
            
            const tryLoadCategories = () => {
                const manualCategorySelect = document.getElementById('manual-category');
                const scrapedCategorySelect = document.getElementById('scraped-category');
                const editCategorySelect = document.getElementById('edit-category');
                
                console.log(`Deneme ${attempts + 1}: Manuel seçici:`, manualCategorySelect, 'Scraped seçici:', scrapedCategorySelect, 'Edit seçici:', editCategorySelect);
                
                if (manualCategorySelect && scrapedCategorySelect && editCategorySelect) {
                    console.log('Tüm seçiciler bulundu, dolduruluyor...');
                    populateCategorySelect(manualCategorySelect, hierarchy, existing);
                    populateCategorySelect(scrapedCategorySelect, hierarchy, existing);
                    populateCategorySelect(editCategorySelect, hierarchy, existing);
                } else if (attempts < maxAttempts) {
                    attempts++;
                    console.log(`Seçiciler bulunamadı, ${100 * attempts}ms sonra tekrar denenecek...`);
                    setTimeout(tryLoadCategories, 100 * attempts);
                } else {
                    console.error('Maksimum deneme sayısına ulaşıldı, seçiciler bulunamadı!');
                }
            };
            
            tryLoadCategories();

        } catch (error) {
            console.error('Kategori önerileri yüklenemedi:', error);
        }
    }
    
    // Kategori seçiciyi doldur
    function populateCategorySelect(selectElement, hierarchy, existing) {
        console.log('Kategori seçici dolduruluyor:', selectElement, hierarchy, existing);
        selectElement.innerHTML = '<option value="">Kategori Seçin</option>';
        
        // Ana kategorileri ekle
        Object.keys(hierarchy).forEach(mainCategory => {
            console.log('Ana kategori ekleniyor:', mainCategory);
            const optgroup = document.createElement('optgroup');
            optgroup.label = mainCategory;
            
            // Alt kategorileri ekle
            hierarchy[mainCategory].subcategories.forEach(subCategory => {
                const option = document.createElement('option');
                option.value = subCategory;
                option.textContent = subCategory;
                // Mevcut kategorileri vurgula
                if (existing.includes(subCategory)) {
                    option.style.fontWeight = 'bold';
                }
                optgroup.appendChild(option);
            });
            
            selectElement.appendChild(optgroup);
        });
        
        // Mevcut kategorileri de ekle (hiyerarşide olmayanlar)
        const existingNotInHierarchy = existing.filter(cat => 
            !Object.values(hierarchy).some(data => data.subcategories.includes(cat))
        );
        
        console.log('Hiyerarşide olmayan kategoriler:', existingNotInHierarchy);
        
        if (existingNotInHierarchy.length > 0) {
            const customOptgroup = document.createElement('optgroup');
            customOptgroup.label = 'Mevcut Kategoriler';
            
            existingNotInHierarchy.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                option.style.fontWeight = 'bold';
                customOptgroup.appendChild(option);
            });
            
            selectElement.appendChild(customOptgroup);
        }
        
        console.log('Kategori seçici dolduruldu, toplam option sayısı:', selectElement.options.length);
    }

    // Fill scraped data form
    function fillScrapedDataForm(data) {
        document.getElementById('scraped-name').value = data.name || '';
        document.getElementById('scraped-category').value = data.category || '';
        
        // Sürüm formatını düzelt - sadece versiyon numarası
        let version = data.version || '';
        if (version) {
            // "Sürüm" kelimesini kaldır ve sadece versiyon numarasını al
            version = version.replace(/^sürüm\s*/i, '').trim();
            const versionMatch = version.match(/(\d+(?:\.\d+)*)/);
            if (versionMatch) {
                version = versionMatch[1]; // Sadece versiyon numarası
            }
        }
        document.getElementById('scraped-version').value = version;
        
        document.getElementById('scraped-size').value = data.fileSize || '';
        document.getElementById('scraped-image').value = data.image || '';
        document.getElementById('scraped-download').value = data.downloadLink || '';
        document.getElementById('scraped-website').value = data.website || '';
        document.getElementById('scraped-description').value = data.description || '';
        
        // Uygulama içi görselleri doldur
        const internalImages = data.internalImages || [];
        document.getElementById('scraped-internal-images').value = internalImages.join('\n');
        
        // Sistem gereksinimlerini doldur
        const systemRequirements = data.systemRequirements || [];
        document.getElementById('scraped-system-requirements').value = systemRequirements.join('\n');
        
        // Güncelleme notlarını doldur
        const updateNotes = data.features || [];
        document.getElementById('scraped-update-notes').value = updateNotes.join('\n');

        // Show image preview if available
        if (data.image) {
            const previewImg = document.getElementById('scraped-preview-img');
            const previewContainer = document.getElementById('scraped-image-preview');
            previewImg.src = data.image;
            previewContainer.style.display = 'block';
            previewImg.onerror = () => {
                previewContainer.style.display = 'none';
            };
        }
        
        // SEO alanlarını otomatik doldur
        autoFillSEOFields('scraped', data);
    }

    // Show scraped data form
    function showScrapedDataForm() {
        // Hide all form contents
        document.querySelectorAll('.add-form-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show scraped data form
        document.getElementById('scraped-data-form').classList.add('active');
        
        // Update method tab to show we're in URL mode
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector('[data-method="url"]').classList.add('active');
    }

    // Back to URL form
    function backToUrlForm() {
        document.querySelectorAll('.add-form-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('url-add-form').classList.add('active');
        
        // Clear URL input
        document.getElementById('app-url').value = '';
    }

    // Clear scraped form
    function clearScrapedForm() {
        document.getElementById('scraped-app-form').reset();
        document.getElementById('scraped-image-preview').style.display = 'none';
        backToUrlForm();
    }

    // Initialize filters and stats
    function initializeFilters() {
        const searchInput = document.getElementById('search-admin');
        const categoryFilter = document.getElementById('category-filter');
        const badgeFilter = document.getElementById('badge-filter');
        const clearFiltersBtn = document.getElementById('clear-filters');
        
        if (searchInput) {
            searchInput.addEventListener('input', applyFilters);
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', applyFilters);
        }
        
        if (badgeFilter) {
            badgeFilter.addEventListener('change', applyFilters);
        }
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearAllFilters);
        }
        
        // Pagination event listeners
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', prevPage);
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', nextPage);
        }
        
        // Badge selector event delegation
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('badge-selector')) {
                updateAppBadge(e.target);
            }
        });
        
        // Version input event delegation
        document.addEventListener('blur', (e) => {
            if (e.target.classList.contains('version-input')) {
                updateAppVersion(e.target);
            }
        });
        
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('version-input')) {
                updateAppVersion(e.target);
            }
        });
        
        // Download link input event delegation
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('download-link-input')) {
                const confirmBtn = e.target.parentElement.querySelector('.confirm-download-btn');
                if (confirmBtn) {
                    confirmBtn.style.display = e.target.value.trim() ? 'inline-flex' : 'none';
                }
            }
        });
        
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('download-link-input')) {
                updateAppDownloadLink(e.target);
                const confirmBtn = e.target.parentElement.querySelector('.confirm-download-btn');
                if (confirmBtn) {
                    confirmBtn.style.display = 'none';
                }
            }
        });
        
        // Confirm download button event delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('confirm-download-btn') || e.target.closest('.confirm-download-btn')) {
                const btn = e.target.classList.contains('confirm-download-btn') ? e.target : e.target.closest('.confirm-download-btn');
                const input = btn.parentElement.querySelector('.download-link-input');
                if (input) {
                    updateAppDownloadLink(input);
                    btn.style.display = 'none';
                }
            }
        });
    }
    
    function applyFilters() {
        const searchTerm = document.getElementById('search-admin')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('category-filter')?.value || '';
        const badgeFilter = document.getElementById('badge-filter')?.value || '';
        
        filteredApps = allApps.filter(app => {
            const matchesSearch = !searchTerm || 
                app.name.toLowerCase().includes(searchTerm) ||
                app.category.toLowerCase().includes(searchTerm) ||
                (app.description && app.description.toLowerCase().includes(searchTerm));
            
            const matchesCategory = !categoryFilter || app.category === categoryFilter;
            const matchesBadge = !badgeFilter || app.badgeType === badgeFilter;
            
            return matchesSearch && matchesCategory && matchesBadge;
        });
        
        currentPage = 1; // Reset to first page when filtering
        renderAppsTable();
        updateStats(filteredApps);
        updatePagination();
    }
    
    function clearAllFilters() {
        document.getElementById('search-admin').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('badge-filter').value = '';
        filteredApps = [...allApps]; // Reset to all apps
        currentPage = 1; // Reset to first page
        renderAppsTable();
        updateStats(filteredApps);
        updatePagination();
    }
    
    function updateStats(apps = allApps) {
        const totalApps = document.getElementById('total-apps');
        const totalCategories = document.getElementById('total-categories');
        
        if (totalApps) {
            totalApps.textContent = apps.length;
        }
        
        if (totalCategories) {
            const uniqueCategories = new Set(apps.map(app => app.category));
            totalCategories.textContent = uniqueCategories.size;
        }
    }
    
    function renderAppsTable() {
        const tbody = document.getElementById('app-list-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Calculate pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedApps = filteredApps.slice(startIndex, endIndex);
        
        paginatedApps.forEach(app => {
            const row = document.createElement('tr');
            row.dataset.appName = app.name;
            
            const creationDate = app.creationDate ? 
                new Date(app.creationDate).toLocaleDateString('tr-TR') : 'Bilinmiyor';
            
            const badgeType = app.badgeType || 'none';
            const badgeText = badgeType === 'new' ? 'YENİ' : 
                            badgeType === 'updated' ? 'GÜNCELLENDİ' : 'Rozetsiz';
            
            row.innerHTML = `
                <td class="logo-col">
                    <img src="${app.image || 'https://via.placeholder.com/40'}" 
                         alt="${app.name}" class="app-logo">
                </td>
                <td>
                    <div class="app-name">${app.name}</div>
                </td>
                <td>
                    <input type="text" class="version-input" value="${app.version || ''}" 
                           data-app-name="${app.name}" placeholder="Sürüm girin">
                </td>
                <td>
                    <div class="download-link-container">
                        <input type="url" class="download-link-input" value="${app.downloadUrl || ''}" 
                               data-app-name="${app.name}" placeholder="İndirme linki girin">
                        <button type="button" class="confirm-download-btn" data-app-name="${app.name}" 
                                title="İndirme linkini kaydet" style="display: none;">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </td>
                <td>${app.category}</td>
                <td>
                    <select class="badge-selector" data-app-name="${app.name}" data-current-badge="${badgeType}">
                        <option value="none" ${badgeType === 'none' ? 'selected' : ''}>Rozetsiz</option>
                        <option value="new" ${badgeType === 'new' ? 'selected' : ''}>YENİ</option>
                        <option value="updated" ${badgeType === 'updated' ? 'selected' : ''}>GÜNCELLENDİ</option>
                    </select>
                </td>
                <td>
                    <label class="featured-toggle">
                        <input type="checkbox" class="featured-checkbox" 
                               data-app-name="${app.name}" 
                               ${app.featured ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </td>
                <td>${creationDate}</td>
                <td class="actions-col">
                    <button class="btn btn-primary btn-sm edit-btn">Düzenle</button>
                    <button class="btn btn-danger btn-sm delete-btn">Sil</button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Show table and hide spinner
        const table = document.querySelector('.app-table');
        if (table) table.style.display = 'table';
        if (spinner) spinner.style.display = 'none';
        
        // Add event listeners for featured toggles
        addFeaturedToggleListeners();
    }
    
    function populateCategoryFilter() {
        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;
        
        const categories = [...new Set(allApps.map(app => app.category))].sort();
        categoryFilter.innerHTML = '<option value="">Tüm Kategoriler</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }
    
    function updatePagination() {
        const totalPages = Math.ceil(filteredApps.length / itemsPerPage);
        const paginationInfo = document.getElementById('pagination-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageNumbers = document.getElementById('pagination-container');
        
        if (!paginationInfo || !prevBtn || !nextBtn || !pageNumbers) return;
        
        // Update pagination info
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, filteredApps.length);
        paginationInfo.textContent = `${startItem}-${endItem} / ${filteredApps.length} uygulama`;
        
        // Update buttons
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        
        // Show/hide pagination
        if (totalPages <= 1) {
            pageNumbers.style.display = 'none';
        } else {
            pageNumbers.style.display = 'flex';
        }
        
        // Update page numbers
        const pageNumbersContainer = document.getElementById('page-numbers');
        if (pageNumbersContainer) {
            pageNumbersContainer.innerHTML = '';
            
            // Show max 5 page numbers
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => goToPage(i));
                pageNumbersContainer.appendChild(pageBtn);
            }
        }
    }
    
    function goToPage(page) {
        const totalPages = Math.ceil(filteredApps.length / itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            renderAppsTable();
            updatePagination();
        }
    }
    
    function nextPage() {
        const totalPages = Math.ceil(filteredApps.length / itemsPerPage);
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    }
    
    function prevPage() {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    }
    
    async function updateAppBadge(selectElement) {
        const appName = selectElement.dataset.appName;
        const newBadgeType = selectElement.value;
        
        if (!appName || !newBadgeType) return;
        
        try {
            // Find the app in allApps
            const appIndex = allApps.findIndex(app => app.name === appName);
            if (appIndex === -1) return;
            
            // Update the app's badgeType
            allApps[appIndex].badgeType = newBadgeType;
            
            // Update the app in filteredApps as well
            const filteredAppIndex = filteredApps.findIndex(app => app.name === appName);
            if (filteredAppIndex !== -1) {
                filteredApps[filteredAppIndex].badgeType = newBadgeType;
            }
            
            // Update the app on the server
            const response = await fetch(`${API_URL}/${encodeURIComponent(appName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allApps[appIndex])
            });
            
            if (!response.ok) {
                throw new Error(`Sunucu hatası: ${response.statusText}`);
            }
            
            // Update the display
            renderAppsTable();
            updateStats(filteredApps);
            
            console.log(`Uygulama rozeti güncellendi: ${appName} -> ${newBadgeType}`);
            
        } catch (error) {
            console.error('Rozet güncellenirken hata:', error);
            alert(`Rozet güncellenemedi: ${error.message}`);
            
            // Revert the select element to original value
            selectElement.value = selectElement.dataset.currentBadge;
        }
    }
    
    async function updateAppVersion(inputElement) {
        const appName = inputElement.dataset.appName;
        const newVersion = inputElement.value.trim();
        
        if (!appName) return;
        
        try {
            // Find the app in allApps
            const appIndex = allApps.findIndex(app => app.name === appName);
            if (appIndex === -1) return;
            
            // Update the app's version
            allApps[appIndex].version = newVersion;
            
            // Update the app in filteredApps as well
            const filteredAppIndex = filteredApps.findIndex(app => app.name === appName);
            if (filteredAppIndex !== -1) {
                filteredApps[filteredAppIndex].version = newVersion;
            }
            
            // Update the app on the server
            const response = await fetch(`${API_URL}/${encodeURIComponent(appName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allApps[appIndex])
            });
            
            if (!response.ok) {
                throw new Error(`Sunucu hatası: ${response.statusText}`);
            }
            
            console.log(`Uygulama sürümü güncellendi: ${appName} -> ${newVersion}`);
            
        } catch (error) {
            console.error('Sürüm güncellenirken hata:', error);
            alert(`Sürüm güncellenemedi: ${error.message}`);
            
            // Revert the input to original value
            inputElement.value = allApps.find(app => app.name === appName)?.version || '';
        }
    }
    
    async function updateAppDownloadLink(inputElement) {
        const appName = inputElement.dataset.appName;
        const newDownloadUrl = inputElement.value.trim();
        
        if (!appName) return;
        
        try {
            // Find the app in allApps
            const appIndex = allApps.findIndex(app => app.name === appName);
            if (appIndex === -1) return;
            
            // Update the app's downloadUrl
            allApps[appIndex].downloadUrl = newDownloadUrl;
            
            // Update the app in filteredApps as well
            const filteredAppIndex = filteredApps.findIndex(app => app.name === appName);
            if (filteredAppIndex !== -1) {
                filteredApps[filteredAppIndex].downloadUrl = newDownloadUrl;
            }
            
            // Update the app on the server
            const response = await fetch(`${API_URL}/${encodeURIComponent(appName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(allApps[appIndex])
            });
            
            if (!response.ok) {
                throw new Error(`Sunucu hatası: ${response.statusText}`);
            }
            
            // Update the edit modal if it's open for this app
            updateEditModalDownloadLink(appName, newDownloadUrl);
            
            // Update the main page if it's open
            updateMainPageDownloadLink(appName, newDownloadUrl);
            
            // Dispatch event for main page synchronization
            window.dispatchEvent(new CustomEvent('downloadLinkUpdated', {
                detail: { appName, newDownloadUrl }
            }));
            
            console.log(`Uygulama indirme linki güncellendi: ${appName} -> ${newDownloadUrl}`);
            
        } catch (error) {
            console.error('İndirme linki güncellenirken hata:', error);
            alert(`İndirme linki güncellenemedi: ${error.message}`);
            
            // Revert the input to original value
            inputElement.value = allApps.find(app => app.name === appName)?.downloadUrl || '';
        }
    }
    
    function updateEditModalDownloadLink(appName, newDownloadUrl) {
        // Check if edit modal is open and showing the same app
        const editModal = document.getElementById('edit-modal');
        if (!editModal || editModal.style.display === 'none') return;
        
        const editDownloadInput = document.getElementById('edit-download');
        if (editDownloadInput) {
            editDownloadInput.value = newDownloadUrl;
        }
    }
    
    function updateMainPageDownloadLink(appName, newDownloadUrl) {
        // Check if we're on the main page (not admin page)
        if (window.location.pathname.includes('/admin')) return;
        
        // Update app cards on the main page
        const appCards = document.querySelectorAll('.app-card');
        appCards.forEach(card => {
            const cardAppName = card.querySelector('h3')?.textContent;
            if (cardAppName === appName) {
                const downloadBtn = card.querySelector('.download-btn');
                if (downloadBtn) {
                    downloadBtn.href = newDownloadUrl || '#';
                }
            }
        });
        
        // Update app details modal if it's open for this app
        const appDetailsModal = document.getElementById('app-details-modal');
        if (appDetailsModal && appDetailsModal.style.display !== 'none') {
            const modalAppName = document.getElementById('app-details-name')?.textContent;
            if (modalAppName === appName) {
                const modalDownloadBtn = document.getElementById('app-details-download-btn');
                if (modalDownloadBtn) {
                    modalDownloadBtn.href = newDownloadUrl || '#';
                }
            }
        }
    }

    // DOM yüklendikten sonra çalıştır
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            fetchApps();
            updateCategorySuggestions();
            initializeFilters();
            updateStats();
            initializeSEOFields();
            initializeAISEO();
            loadMLModel();
            initializeNavigation();
            initializeContentManagement();
        });
    } else {
        fetchApps();
        updateCategorySuggestions();
        initializeFilters();
        updateStats();
        initializeSEOFields();
        initializeAISEO();
        loadMLModel();
        initializeNavigation();
        initializeContentManagement();
    }
});

// Content Management Functions
function initializeContentManagement() {
    // AI Category Suggestions
    document.getElementById('suggestCategoryManual')?.addEventListener('click', () => {
        suggestCategory('manual');
    });
    
    document.getElementById('suggestCategoryEdit')?.addEventListener('click', () => {
        suggestCategory('edit');
    });

    // Similar Apps Suggestions
    document.getElementById('manual-name')?.addEventListener('input', debounce(() => {
        findSimilarApps('manual');
    }, 500));

    document.getElementById('edit-name')?.addEventListener('input', debounce(() => {
        findSimilarApps('edit');
    }, 500));

    // Moderation Panel
    document.getElementById('scanContent')?.addEventListener('click', scanAllContent);
    document.getElementById('checkSpam')?.addEventListener('click', checkForSpam);
    document.getElementById('validateContent')?.addEventListener('click', validateAllContent);
    document.getElementById('generateReport')?.addEventListener('click', generateModerationReport);

    // Bulk Actions
    document.getElementById('toggleBulkMode')?.addEventListener('click', toggleBulkMode);
    document.getElementById('selectAll')?.addEventListener('change', selectAllApps);
    document.getElementById('bulkEdit')?.addEventListener('click', openBulkEditModal);
    document.getElementById('bulkDelete')?.addEventListener('click', bulkDeleteApps);
    document.getElementById('bulkCategory')?.addEventListener('click', bulkChangeCategory);
    document.getElementById('bulkFeatured')?.addEventListener('click', bulkToggleFeatured);
    document.getElementById('bulkExport')?.addEventListener('click', bulkExportApps);

    // Analytics Panel
    document.getElementById('generateAnalytics')?.addEventListener('click', generateAnalytics);
    document.getElementById('contentInsights')?.addEventListener('click', generateContentInsights);
    document.getElementById('categoryAnalysis')?.addEventListener('click', generateCategoryAnalysis);
    document.getElementById('qualityReport')?.addEventListener('click', generateQualityReport);
    document.getElementById('exportAnalytics')?.addEventListener('click', exportAnalytics);
}

function suggestCategory(formType) {
    const nameField = formType === 'manual' ? 'manual-name' : 'edit-name';
    const appName = document.getElementById(nameField)?.value;
    
    if (!appName) {
        showNotification('Lütfen önce uygulama adını girin', 'warning');
        return;
    }

    const suggestions = generateCategorySuggestions(appName);
    displayCategorySuggestions(suggestions, formType);
}

function generateCategorySuggestions(appName) {
    const name = appName.toLowerCase();
    const suggestions = [];
    
    // AI-powered category detection based on keywords
    const categoryKeywords = {
        'Oyunlar': ['game', 'oyun', 'play', 'gaming', 'arcade', 'puzzle', 'strategy', 'action', 'adventure', 'racing', 'sports'],
        'Programlar': ['program', 'software', 'app', 'application', 'tool', 'utility', 'desktop', 'client'],
        'İş': ['business', 'iş', 'office', 'work', 'productivity', 'management', 'finance', 'accounting', 'crm', 'erp'],
        'Eğitim': ['education', 'eğitim', 'learn', 'study', 'course', 'tutorial', 'academic', 'school', 'university'],
        'Grafik ve Tasarım': ['design', 'tasarım', 'graphic', 'photo', 'image', 'draw', 'paint', 'illustration', 'vector', '3d'],
        'Fotoğraf ve Video': ['photo', 'video', 'camera', 'edit', 'film', 'movie', 'media', 'gallery', 'album'],
        'Verimlilik': ['productivity', 'verimlilik', 'task', 'todo', 'note', 'calendar', 'schedule', 'time', 'organize'],
        'Yardımcı Programlar': ['utility', 'yardımcı', 'helper', 'assistant', 'cleaner', 'optimizer', 'backup', 'security']
    };

    // Calculate scores for each category
    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
        let score = 0;
        keywords.forEach(keyword => {
            if (name.includes(keyword)) {
                score += 1;
            }
        });
        
        if (score > 0) {
            suggestions.push({
                category: category,
                score: score,
                confidence: Math.min(score / keywords.length * 100, 100)
            });
        }
    });

    // Sort by score and return top 3
    return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

function displayCategorySuggestions(suggestions, formType) {
    const containerId = formType === 'manual' ? 'categorySuggestionsManual' : 'categorySuggestionsEdit';
    const listId = formType === 'manual' ? 'suggestionsListManual' : 'suggestionsListEdit';
    const selectId = formType === 'manual' ? 'manual-category' : 'edit-category';
    
    const container = document.getElementById(containerId);
    const list = document.getElementById(listId);
    const select = document.getElementById(selectId);
    
    if (!container || !list || !select) return;

    if (suggestions.length === 0) {
        container.style.display = 'none';
        return;
    }

    list.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const button = document.createElement('button');
        button.className = 'suggestion-item';
        button.textContent = `${suggestion.category} (${suggestion.confidence.toFixed(0)}%)`;
        button.onclick = () => {
            select.value = suggestion.category;
            button.classList.add('selected');
            setTimeout(() => {
                container.style.display = 'none';
            }, 1000);
        };
        list.appendChild(button);
    });

    container.style.display = 'block';
}

function findSimilarApps(formType) {
    const nameField = formType === 'manual' ? 'manual-name' : 'edit-name';
    const appName = document.getElementById(nameField)?.value;
    
    if (!appName || appName.length < 3) return;

    const similarApps = generateSimilarApps(appName);
    displaySimilarApps(similarApps, formType);
}

function generateSimilarApps(appName) {
    const allApps = JSON.parse(localStorage.getItem('apps') || '[]');
    const name = appName.toLowerCase();
    const similar = [];

    allApps.forEach(app => {
        const appNameLower = app.name.toLowerCase();
        let similarity = 0;

        // Check for exact word matches
        const nameWords = name.split(' ');
        const appWords = appNameLower.split(' ');
        
        nameWords.forEach(word => {
            if (word.length > 2 && appWords.some(appWord => 
                appWord.includes(word) || word.includes(appWord)
            )) {
                similarity += 1;
            }
        });

        // Check for character similarity
        const charSimilarity = calculateStringSimilarity(name, appNameLower);
        similarity += charSimilarity * 2;

        if (similarity > 0.5) {
            similar.push({
                ...app,
                similarity: Math.min(similarity * 20, 100)
            });
        }
    });

    return similar
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
}

function calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

function displaySimilarApps(similarApps, formType) {
    const containerId = formType === 'manual' ? 'similarAppsManual' : 'similarAppsEdit';
    const listId = formType === 'manual' ? 'similarAppsListManual' : 'similarAppsListEdit';
    
    const container = document.getElementById(containerId);
    const list = document.getElementById(listId);
    
    if (!container || !list) return;

    if (similarApps.length === 0) {
        container.style.display = 'none';
        return;
    }

    list.innerHTML = '';
    
    similarApps.forEach(app => {
        const appItem = document.createElement('div');
        appItem.className = 'similar-app-item';
        appItem.onclick = () => {
            // Fill form with similar app data
            fillFormWithAppData(app, formType);
        };
        
        appItem.innerHTML = `
            <img src="${app.image || 'logo.png'}" alt="${app.name}" class="similar-app-icon" onerror="this.src='logo.png'">
            <div class="similar-app-info">
                <h5>${app.name}</h5>
                <p>${app.category} • ${app.version || 'Sürüm bilgisi yok'}</p>
            </div>
            <div class="similarity-score">${app.similarity.toFixed(0)}%</div>
        `;
        
        list.appendChild(appItem);
    });

    container.style.display = 'block';
}

function fillFormWithAppData(app, formType) {
    const nameField = formType === 'manual' ? 'manual-name' : 'edit-name';
    const categoryField = formType === 'manual' ? 'manual-category' : 'edit-category';
    const versionField = formType === 'manual' ? 'manual-version' : 'edit-version';
    const descriptionField = formType === 'manual' ? 'manual-description' : 'edit-description';
    const websiteField = formType === 'manual' ? 'manual-website' : 'edit-website';
    
    // Fill form fields
    document.getElementById(nameField).value = app.name;
    document.getElementById(categoryField).value = app.category;
    if (app.version) document.getElementById(versionField).value = app.version;
    if (app.description) document.getElementById(descriptionField).value = app.description;
    if (app.website) document.getElementById(websiteField).value = app.website;
    
    // Hide similar apps container
    const containerId = formType === 'manual' ? 'similarAppsManual' : 'similarAppsEdit';
    document.getElementById(containerId).style.display = 'none';
    
    showNotification('Benzer uygulama verileri forma dolduruldu!', 'success');
}

// Moderation Functions
function scanAllContent() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const issues = [];
    
    apps.forEach(app => {
        const appIssues = analyzeAppContent(app);
        if (appIssues.length > 0) {
            issues.push({
                app: app,
                issues: appIssues
            });
        }
    });
    
    displayModerationResults(issues, 'İçerik Tarama Sonuçları');
}

function checkForSpam() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const spamApps = [];
    
    apps.forEach(app => {
        if (isSpamApp(app)) {
            spamApps.push({
                app: app,
                issues: ['Spam içerik tespit edildi']
            });
        }
    });
    
    displayModerationResults(spamApps, 'Spam Kontrolü Sonuçları');
}

function validateAllContent() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const validationIssues = [];
    
    apps.forEach(app => {
        const validationErrors = validateAppData(app);
        if (validationErrors.length > 0) {
            validationIssues.push({
                app: app,
                issues: validationErrors
            });
        }
    });
    
    displayModerationResults(validationIssues, 'İçerik Doğrulama Sonuçları');
}

function generateModerationReport() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const report = generateContentReport(apps);
    
    const reportWindow = window.open('', '_blank', 'width=800,height=600');
    reportWindow.document.write(`
        <html>
        <head>
            <title>İçerik Moderasyon Raporu</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                .stat { display: inline-block; margin: 10px; padding: 15px; background: #e9ecef; border-radius: 5px; }
                .issue { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>İçerik Moderasyon Raporu</h1>
                <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
            </div>
            <div class="stats">
                <div class="stat">Toplam Uygulama: ${report.totalApps}</div>
                <div class="stat">Sorunlu İçerik: ${report.issuesFound}</div>
                <div class="stat">Spam İçerik: ${report.spamCount}</div>
                <div class="stat">Eksik Veri: ${report.missingData}</div>
            </div>
            <h2>Detaylı Rapor:</h2>
            ${report.details}
        </body>
        </html>
    `);
}

function analyzeAppContent(app) {
    const issues = [];
    
    // Check for suspicious patterns
    if (app.name && app.name.length > 50) {
        issues.push('Uygulama adı çok uzun');
    }
    
    if (app.description && app.description.length < 10) {
        issues.push('Açıklama çok kısa');
    }
    
    if (app.description && app.description.length > 1000) {
        issues.push('Açıklama çok uzun');
    }
    
    // Check for suspicious keywords
    const suspiciousKeywords = ['free download', 'crack', 'hack', 'cheat', 'mod', 'unlimited'];
    const text = (app.name + ' ' + app.description).toLowerCase();
    
    suspiciousKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
            issues.push(`Şüpheli kelime tespit edildi: ${keyword}`);
        }
    });
    
    return issues;
}

function isSpamApp(app) {
    const spamIndicators = [
        'free download',
        'crack',
        'hack',
        'cheat',
        'mod apk',
        'unlimited',
        'premium free',
        'no ads',
        'unlocked'
    ];
    
    const text = (app.name + ' ' + app.description).toLowerCase();
    const spamCount = spamIndicators.filter(keyword => text.includes(keyword)).length;
    
    return spamCount >= 2; // 2 veya daha fazla spam kelimesi varsa spam olarak işaretle
}

function validateAppData(app) {
    const errors = [];
    
    if (!app.name || app.name.trim() === '') {
        errors.push('Uygulama adı eksik');
    }
    
    if (!app.category || app.category.trim() === '') {
        errors.push('Kategori eksik');
    }
    
    if (!app.description || app.description.trim() === '') {
        errors.push('Açıklama eksik');
    }
    
    if (!app.website || !isValidUrl(app.website)) {
        errors.push('Geçersiz website URL');
    }
    
    if (app.image && !isValidUrl(app.image)) {
        errors.push('Geçersiz resim URL');
    }
    
    return errors;
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function displayModerationResults(results, title) {
    const container = document.getElementById('moderationResults');
    const list = document.getElementById('moderationList');
    
    if (!container || !list) return;
    
    if (results.length === 0) {
        list.innerHTML = '<p style="color: #27ae60; text-align: center; padding: 20px;">✅ Hiç sorun bulunamadı!</p>';
    } else {
        list.innerHTML = '';
        
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'moderation-item';
            
            const severity = result.issues.some(issue => issue.includes('Spam')) ? 'error' : 
                           result.issues.some(issue => issue.includes('Şüpheli')) ? 'warning' : 'success';
            
            item.classList.add(severity);
            
            item.innerHTML = `
                <div class="moderation-item-info">
                    <h5>${result.app.name}</h5>
                    <p>${result.issues.join(', ')}</p>
                </div>
                <div class="moderation-actions">
                    <button class="btn-moderation-action approve" onclick="approveApp('${result.app.id}')">
                        Onayla
                    </button>
                    <button class="btn-moderation-action reject" onclick="rejectApp('${result.app.id}')">
                        Reddet
                    </button>
                    <button class="btn-moderation-action ignore" onclick="ignoreIssue('${result.app.id}')">
                        Yoksay
                    </button>
                </div>
            `;
            
            list.appendChild(item);
        });
    }
    
    container.style.display = 'block';
}

function generateContentReport(apps) {
    let issuesFound = 0;
    let spamCount = 0;
    let missingData = 0;
    
    const details = apps.map(app => {
        const appIssues = analyzeAppContent(app);
        const validationErrors = validateAppData(app);
        const isSpam = isSpamApp(app);
        
        if (appIssues.length > 0) issuesFound++;
        if (isSpam) spamCount++;
        if (validationErrors.length > 0) missingData++;
        
        if (appIssues.length > 0 || validationErrors.length > 0 || isSpam) {
            return `
                <div class="issue">
                    <h4>${app.name}</h4>
                    <p><strong>Kategori:</strong> ${app.category}</p>
                    ${appIssues.length > 0 ? `<p><strong>İçerik Sorunları:</strong> ${appIssues.join(', ')}</p>` : ''}
                    ${validationErrors.length > 0 ? `<p><strong>Doğrulama Hataları:</strong> ${validationErrors.join(', ')}</p>` : ''}
                    ${isSpam ? '<p><strong>Durum:</strong> Spam içerik</p>' : ''}
                </div>
            `;
        }
        return '';
    }).filter(detail => detail !== '').join('');
    
    return {
        totalApps: apps.length,
        issuesFound: issuesFound,
        spamCount: spamCount,
        missingData: missingData,
        details: details || '<p>Hiç sorun bulunamadı.</p>'
    };
}

function approveApp(appId) {
    showNotification('Uygulama onaylandı', 'success');
    // Here you would implement the approval logic
}

function rejectApp(appId) {
    showNotification('Uygulama reddedildi', 'error');
    // Here you would implement the rejection logic
}

function ignoreIssue(appId) {
    showNotification('Sorun yoksayıldı', 'info');
    // Here you would implement the ignore logic
}

// Bulk Actions Functions
let bulkMode = false;
let selectedApps = new Set();

function toggleBulkMode() {
    bulkMode = !bulkMode;
    const panel = document.querySelector('.bulk-actions-panel');
    const button = document.getElementById('toggleBulkMode');
    
    if (bulkMode) {
        panel.style.display = 'block';
        button.innerHTML = '<i class="fas fa-times"></i> Toplu Seçimi Kapat';
        button.classList.add('btn-danger');
        button.classList.remove('btn-primary');
        renderAppsWithBulkMode();
    } else {
        panel.style.display = 'none';
        button.innerHTML = '<i class="fas fa-check-square"></i> Toplu Seçim';
        button.classList.remove('btn-danger');
        button.classList.add('btn-primary');
        selectedApps.clear();
        updateBulkButtons();
        renderApps(); // Normal mode'a dön
    }
}

function renderAppsWithBulkMode() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const container = document.getElementById('app-list-container');
    
    if (apps.length === 0) {
        container.innerHTML = '<p class="no-apps">Henüz uygulama eklenmemiş.</p>';
        return;
    }
    
    container.innerHTML = apps.map(app => `
        <div class="app-item app-item-bulk" data-app-id="${app.id}">
            <input type="checkbox" class="bulk-checkbox" data-app-id="${app.id}" onchange="toggleAppSelection('${app.id}')">
            <div class="app-content">
                <div class="app-image">
                    <img src="${app.image || 'logo.png'}" alt="${app.name}" onerror="this.src='logo.png'">
                </div>
                <div class="app-info">
                    <h3>${app.name}</h3>
                    <p class="app-category">${app.category}</p>
                    <p class="app-description">${app.description}</p>
                    <div class="app-meta">
                        <span class="app-version">${app.version || 'Sürüm bilgisi yok'}</span>
                        <span class="app-size">${app.fileSize || 'Boyut bilgisi yok'}</span>
                    </div>
                </div>
            </div>
            <div class="app-actions">
                <button class="btn btn-sm btn-primary" onclick="editApp('${app.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteApp('${app.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function toggleAppSelection(appId) {
    const checkbox = document.querySelector(`input[data-app-id="${appId}"]`);
    
    if (checkbox.checked) {
        selectedApps.add(appId);
    } else {
        selectedApps.delete(appId);
    }
    
    updateBulkButtons();
    updateSelectAllState();
}

function selectAllApps() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.bulk-checkbox');
    
    if (selectAllCheckbox.checked) {
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedApps.add(checkbox.dataset.appId);
        });
    } else {
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        selectedApps.clear();
    }
    
    updateBulkButtons();
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.bulk-checkbox');
    const checkedCount = document.querySelectorAll('.bulk-checkbox:checked').length;
    
    selectAllCheckbox.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function updateBulkButtons() {
    const selectedCount = selectedApps.size;
    const buttons = document.querySelectorAll('.btn-bulk-action');
    const countElement = document.getElementById('selectedCount');
    
    countElement.textContent = selectedCount;
    
    buttons.forEach(button => {
        button.disabled = selectedCount === 0;
    });
}

function openBulkEditModal() {
    if (selectedApps.size === 0) return;
    
    const modal = document.createElement('div');
    modal.className = 'bulk-edit-modal';
    modal.innerHTML = `
        <div class="bulk-edit-content">
            <h3>Toplu Düzenleme (${selectedApps.size} uygulama)</h3>
            <form class="bulk-edit-form" id="bulkEditForm">
                <div class="form-group">
                    <label for="bulkCategory">Kategori Değiştir:</label>
                    <select id="bulkCategory" name="category">
                        <option value="">Kategori değiştirme</option>
                        <option value="Oyunlar">Oyunlar</option>
                        <option value="Programlar">Programlar</option>
                        <option value="İş">İş</option>
                        <option value="Eğitim">Eğitim</option>
                        <option value="Grafik ve Tasarım">Grafik ve Tasarım</option>
                        <option value="Fotoğraf ve Video">Fotoğraf ve Video</option>
                        <option value="Verimlilik">Verimlilik</option>
                        <option value="Yardımcı Programlar">Yardımcı Programlar</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bulkFeatured">Öne Çıkar:</label>
                    <select id="bulkFeatured" name="featured">
                        <option value="">Değiştirme</option>
                        <option value="true">Öne Çıkar</option>
                        <option value="false">Öne Çıkarma</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bulkBadge">Rozet:</label>
                    <select id="bulkBadge" name="badge">
                        <option value="">Değiştirme</option>
                        <option value="new">YENİ</option>
                        <option value="updated">GÜNCELLENDİ</option>
                        <option value="none">Rozetsiz</option>
                    </select>
                </div>
                <div class="bulk-edit-actions">
                    <button type="button" class="btn-bulk-confirm" onclick="confirmBulkEdit()">
                        <i class="fas fa-check"></i> Uygula
                    </button>
                    <button type="button" class="btn-bulk-cancel" onclick="closeBulkEditModal()">
                        <i class="fas fa-times"></i> İptal
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeBulkEditModal() {
    const modal = document.querySelector('.bulk-edit-modal');
    if (modal) {
        modal.remove();
    }
}

function confirmBulkEdit() {
    const form = document.getElementById('bulkEditForm');
    const formData = new FormData(form);
    
    const updates = {};
    if (formData.get('category')) updates.category = formData.get('category');
    if (formData.get('featured')) updates.featured = formData.get('featured') === 'true';
    if (formData.get('badge')) updates.badge = formData.get('badge');
    
    if (Object.keys(updates).length === 0) {
        showNotification('Hiçbir değişiklik seçilmedi', 'warning');
        return;
    }
    
    // Apply updates to selected apps
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    let updatedCount = 0;
    
    apps.forEach(app => {
        if (selectedApps.has(app.id)) {
            Object.assign(app, updates);
            updatedCount++;
        }
    });
    
    localStorage.setItem('apps', JSON.stringify(apps));
    showNotification(`${updatedCount} uygulama güncellendi`, 'success');
    closeBulkEditModal();
    renderAppsWithBulkMode();
}

function bulkDeleteApps() {
    if (selectedApps.size === 0) return;
    
    if (confirm(`${selectedApps.size} uygulamayı silmek istediğinizden emin misiniz?`)) {
        const apps = JSON.parse(localStorage.getItem('apps') || '[]');
        const filteredApps = apps.filter(app => !selectedApps.has(app.id));
        
        localStorage.setItem('apps', JSON.stringify(filteredApps));
        showNotification(`${selectedApps.size} uygulama silindi`, 'success');
        selectedApps.clear();
        updateBulkButtons();
        renderAppsWithBulkMode();
    }
}

function bulkChangeCategory() {
    const newCategory = prompt('Yeni kategori girin:');
    if (!newCategory) return;
    
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    let updatedCount = 0;
    
    apps.forEach(app => {
        if (selectedApps.has(app.id)) {
            app.category = newCategory;
            updatedCount++;
        }
    });
    
    localStorage.setItem('apps', JSON.stringify(apps));
    showNotification(`${updatedCount} uygulamanın kategorisi değiştirildi`, 'success');
    renderAppsWithBulkMode();
}

function bulkToggleFeatured() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    let updatedCount = 0;
    
    apps.forEach(app => {
        if (selectedApps.has(app.id)) {
            app.featured = !app.featured;
            updatedCount++;
        }
    });
    
    localStorage.setItem('apps', JSON.stringify(apps));
    showNotification(`${updatedCount} uygulamanın öne çıkarma durumu değiştirildi`, 'success');
    renderAppsWithBulkMode();
}

function bulkExportApps() {
    if (selectedApps.size === 0) return;
    
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const selectedAppsData = apps.filter(app => selectedApps.has(app.id));
    
    const dataStr = JSON.stringify(selectedAppsData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `uygulamalar_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification(`${selectedApps.size} uygulama dışa aktarıldı`, 'success');
}

// Analytics Functions
function generateAnalytics() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const analytics = analyzeContentData(apps);
    displayAnalytics(analytics, 'Genel Analiz');
}

function generateContentInsights() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const insights = generateContentInsightsData(apps);
    displayAnalytics(insights, 'İçerik İçgörüleri');
}

function generateCategoryAnalysis() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const analysis = generateCategoryAnalysisData(apps);
    displayAnalytics(analysis, 'Kategori Analizi');
}

function generateQualityReport() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const quality = generateQualityReportData(apps);
    displayAnalytics(quality, 'Kalite Raporu');
}

function exportAnalytics() {
    const apps = JSON.parse(localStorage.getItem('apps') || '[]');
    const analytics = analyzeContentData(apps);
    
    const reportData = {
        timestamp: new Date().toISOString(),
        totalApps: apps.length,
        analytics: analytics,
        insights: generateContentInsightsData(apps),
        categoryAnalysis: generateCategoryAnalysisData(apps),
        qualityReport: generateQualityReportData(apps)
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `analiz_raporu_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('Analiz raporu dışa aktarıldı', 'success');
}

function analyzeContentData(apps) {
    const totalApps = apps.length;
    const categories = {};
    const featuredCount = apps.filter(app => app.featured).length;
    const withImages = apps.filter(app => app.image && app.image !== 'logo.png').length;
    const withDescriptions = apps.filter(app => app.description && app.description.length > 10).length;
    const withVersions = apps.filter(app => app.version && app.version.trim() !== '').length;
    
    // Kategori analizi
    apps.forEach(app => {
        categories[app.category] = (categories[app.category] || 0) + 1;
    });
    
    // Ortalama açıklama uzunluğu
    const avgDescriptionLength = apps.reduce((sum, app) => 
        sum + (app.description ? app.description.length : 0), 0) / totalApps;
    
    // En popüler kategoriler
    const sortedCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    return {
        totalApps,
        featuredCount,
        withImages,
        withDescriptions,
        withVersions,
        avgDescriptionLength: Math.round(avgDescriptionLength),
        topCategories: sortedCategories,
        categoryDistribution: categories,
        completeness: {
            images: Math.round((withImages / totalApps) * 100),
            descriptions: Math.round((withDescriptions / totalApps) * 100),
            versions: Math.round((withVersions / totalApps) * 100)
        }
    };
}

function generateContentInsightsData(apps) {
    const insights = [];
    
    // Açıklama uzunluğu analizi
    const shortDescriptions = apps.filter(app => 
        app.description && app.description.length < 50
    ).length;
    
    const longDescriptions = apps.filter(app => 
        app.description && app.description.length > 200
    ).length;
    
    if (shortDescriptions > apps.length * 0.3) {
        insights.push(`%${Math.round((shortDescriptions / apps.length) * 100)} uygulamanın açıklaması çok kısa. Daha detaylı açıklamalar ekleyin.`);
    }
    
    if (longDescriptions > apps.length * 0.2) {
        insights.push(`%${Math.round((longDescriptions / apps.length) * 100)} uygulamanın açıklaması çok uzun. Daha kısa ve öz açıklamalar yazın.`);
    }
    
    // Resim analizi
    const withoutImages = apps.filter(app => !app.image || app.image === 'logo.png').length;
    if (withoutImages > 0) {
        insights.push(`${withoutImages} uygulamanın resmi eksik. Görsel içerik ekleyin.`);
    }
    
    // Kategori çeşitliliği
    const uniqueCategories = new Set(apps.map(app => app.category)).size;
    if (uniqueCategories < 3) {
        insights.push('Kategori çeşitliliği düşük. Daha fazla kategori ekleyin.');
    }
    
    // Öne çıkan uygulama oranı
    const featuredRatio = apps.filter(app => app.featured).length / apps.length;
    if (featuredRatio < 0.1) {
        insights.push('Çok az uygulama öne çıkarılmış. Daha fazla uygulamayı öne çıkarın.');
    } else if (featuredRatio > 0.5) {
        insights.push('Çok fazla uygulama öne çıkarılmış. Seçici olun.');
    }
    
    return {
        insights,
        recommendations: generateRecommendations(apps)
    };
}

function generateCategoryAnalysisData(apps) {
    const categories = {};
    const categoryStats = {};
    
    apps.forEach(app => {
        if (!categories[app.category]) {
            categories[app.category] = [];
        }
        categories[app.category].push(app);
    });
    
    Object.entries(categories).forEach(([category, categoryApps]) => {
        const avgDescriptionLength = categoryApps.reduce((sum, app) => 
            sum + (app.description ? app.description.length : 0), 0) / categoryApps.length;
        
        const withImages = categoryApps.filter(app => app.image && app.image !== 'logo.png').length;
        const featuredCount = categoryApps.filter(app => app.featured).length;
        
        categoryStats[category] = {
            count: categoryApps.length,
            percentage: Math.round((categoryApps.length / apps.length) * 100),
            avgDescriptionLength: Math.round(avgDescriptionLength),
            imageCoverage: Math.round((withImages / categoryApps.length) * 100),
            featuredCount,
            featuredPercentage: Math.round((featuredCount / categoryApps.length) * 100)
        };
    });
    
    return {
        categoryStats,
        totalCategories: Object.keys(categories).length,
        mostPopularCategory: Object.entries(categoryStats)
            .sort(([,a], [,b]) => b.count - a.count)[0]
    };
}

function generateQualityReportData(apps) {
    const qualityScores = apps.map(app => {
        let score = 0;
        const maxScore = 100;
        
        // Temel bilgiler (40 puan)
        if (app.name && app.name.length > 0) score += 10;
        if (app.description && app.description.length > 20) score += 15;
        if (app.category && app.category.length > 0) score += 10;
        if (app.website && isValidUrl(app.website)) score += 5;
        
        // Görsel içerik (20 puan)
        if (app.image && app.image !== 'logo.png' && isValidUrl(app.image)) score += 20;
        
        // Ek bilgiler (20 puan)
        if (app.version && app.version.trim() !== '') score += 10;
        if (app.fileSize && app.fileSize.trim() !== '') score += 10;
        
        // SEO ve özellikler (20 puan)
        if (app.featured) score += 10;
        if (app.seoTitle && app.seoTitle.length > 0) score += 5;
        if (app.seoDescription && app.seoDescription.length > 0) score += 5;
        
        return {
            ...app,
            qualityScore: Math.min(score, maxScore),
            qualityLevel: getQualityLevel(score)
        };
    });
    
    const avgQuality = qualityScores.reduce((sum, app) => sum + app.qualityScore, 0) / apps.length;
    
    const qualityDistribution = {
        excellent: qualityScores.filter(app => app.qualityScore >= 90).length,
        good: qualityScores.filter(app => app.qualityScore >= 70 && app.qualityScore < 90).length,
        average: qualityScores.filter(app => app.qualityScore >= 50 && app.qualityScore < 70).length,
        poor: qualityScores.filter(app => app.qualityScore < 50).length
    };
    
    return {
        averageQuality: Math.round(avgQuality),
        qualityDistribution,
        qualityScores: qualityScores.sort((a, b) => b.qualityScore - a.qualityScore),
        recommendations: generateQualityRecommendations(qualityScores)
    };
}

function getQualityLevel(score) {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'average';
    return 'poor';
}

function generateRecommendations(apps) {
    const recommendations = [];
    
    const withoutImages = apps.filter(app => !app.image || app.image === 'logo.png').length;
    if (withoutImages > 0) {
        recommendations.push(`${withoutImages} uygulamaya resim ekleyin`);
    }
    
    const shortDescriptions = apps.filter(app => 
        app.description && app.description.length < 50
    ).length;
    if (shortDescriptions > 0) {
        recommendations.push(`${shortDescriptions} uygulamanın açıklamasını genişletin`);
    }
    
    const withoutVersions = apps.filter(app => !app.version || app.version.trim() === '').length;
    if (withoutVersions > 0) {
        recommendations.push(`${withoutVersions} uygulamaya sürüm bilgisi ekleyin`);
    }
    
    return recommendations;
}

function generateQualityRecommendations(qualityScores) {
    const poorQuality = qualityScores.filter(app => app.qualityScore < 50);
    const recommendations = [];
    
    if (poorQuality.length > 0) {
        recommendations.push(`${poorQuality.length} uygulamanın kalitesi düşük - iyileştirme gerekli`);
    }
    
    const withoutSEO = qualityScores.filter(app => !app.seoTitle || !app.seoDescription);
    if (withoutSEO.length > 0) {
        recommendations.push(`${withoutSEO.length} uygulamaya SEO bilgileri ekleyin`);
    }
    
    return recommendations;
}

function displayAnalytics(data, title) {
    const container = document.getElementById('analyticsResults');
    const content = document.getElementById('analyticsContent');
    
    if (!container || !content) return;
    
    let html = `<h3>${title}</h3>`;
    
    if (title === 'Genel Analiz') {
        html += `
            <div class="analytics-stats">
                <div class="analytics-stat">
                    <h5>Toplam Uygulama</h5>
                    <div class="value">${data.totalApps}</div>
                </div>
                <div class="analytics-stat">
                    <h5>Öne Çıkan</h5>
                    <div class="value">${data.featuredCount}</div>
                    <div class="change">%${Math.round((data.featuredCount / data.totalApps) * 100)}</div>
                </div>
                <div class="analytics-stat">
                    <h5>Resimli Uygulama</h5>
                    <div class="value">${data.withImages}</div>
                    <div class="change">%${data.completeness.images}</div>
                </div>
                <div class="analytics-stat">
                    <h5>Ort. Açıklama Uzunluğu</h5>
                    <div class="value">${data.avgDescriptionLength}</div>
                    <div class="change">karakter</div>
                </div>
            </div>
            
            <div class="analytics-card">
                <h4>En Popüler Kategoriler</h4>
                ${data.topCategories.map(([category, count]) => `
                    <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <span>${category}</span>
                        <span><strong>${count}</strong> uygulama</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (title === 'İçerik İçgörüleri') {
        html += `
            <div class="analytics-insights">
                <h5>İçgörüler</h5>
                <ul>
                    ${data.insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>
            
            <div class="analytics-insights">
                <h5>Öneriler</h5>
                <ul>
                    ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        `;
    } else if (title === 'Kategori Analizi') {
        html += `
            <div class="analytics-card">
                <h4>Kategori Detayları</h4>
                ${Object.entries(data.categoryStats).map(([category, stats]) => `
                    <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <h5>${category}</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                            <div><strong>Uygulama Sayısı:</strong> ${stats.count}</div>
                            <div><strong>Yüzde:</strong> %${stats.percentage}</div>
                            <div><strong>Ort. Açıklama:</strong> ${stats.avgDescriptionLength} karakter</div>
                            <div><strong>Resim Oranı:</strong> %${stats.imageCoverage}</div>
                            <div><strong>Öne Çıkan:</strong> ${stats.featuredCount} (%${stats.featuredPercentage})</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (title === 'Kalite Raporu') {
        html += `
            <div class="analytics-stats">
                <div class="analytics-stat">
                    <h5>Ortalama Kalite</h5>
                    <div class="value">${data.averageQuality}/100</div>
                </div>
                <div class="analytics-stat">
                    <h5>Mükemmel</h5>
                    <div class="value">${data.qualityDistribution.excellent}</div>
                    <div class="change">
                        <span class="quality-indicator excellent">Mükemmel</span>
                    </div>
                </div>
                <div class="analytics-stat">
                    <h5>İyi</h5>
                    <div class="value">${data.qualityDistribution.good}</div>
                    <div class="change">
                        <span class="quality-indicator good">İyi</span>
                    </div>
                </div>
                <div class="analytics-stat">
                    <h5>Orta</h5>
                    <div class="value">${data.qualityDistribution.average}</div>
                    <div class="change">
                        <span class="quality-indicator average">Orta</span>
                    </div>
                </div>
                <div class="analytics-stat">
                    <h5>Zayıf</h5>
                    <div class="value">${data.qualityDistribution.poor}</div>
                    <div class="change">
                        <span class="quality-indicator poor">Zayıf</span>
                    </div>
                </div>
            </div>
            
            <div class="analytics-insights">
                <h5>Kalite Önerileri</h5>
                <ul>
                    ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    content.innerHTML = html;
    container.style.display = 'block';
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Featured toggle functions
function addFeaturedToggleListeners() {
    console.log('Adding featured toggle listeners...');
    const checkboxes = document.querySelectorAll('.featured-checkbox');
    console.log('Found checkboxes:', checkboxes.length);
    
    checkboxes.forEach((checkbox, index) => {
        console.log(`Adding listener to checkbox ${index}:`, checkbox.dataset.appName);
        checkbox.addEventListener('change', function() {
            console.log('Checkbox changed:', this.dataset.appName, this.checked);
            updateAppFeatured(this);
        });
    });
}

async function updateAppFeatured(checkboxElement) {
    const appName = checkboxElement.dataset.appName;
    const isFeatured = checkboxElement.checked;
    
    if (!appName) return;
    
    try {
        const url = `/api/apps/${encodeURIComponent(appName)}/featured`;
        console.log('Making request to:', url);
        console.log('App name:', appName);
        console.log('Featured status:', isFeatured);
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ featured: isFeatured })
        });
        
        if (!response.ok) {
            throw new Error(`Sunucu hatası: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('API response:', result);
        
        // Update the app in allApps array
        const appIndex = allApps.findIndex(app => app.name === appName);
        console.log('App index in allApps:', appIndex);
        if (appIndex !== -1) {
            allApps[appIndex].featured = isFeatured;
            allApps[appIndex].lastModified = new Date().toISOString();
            console.log('Updated allApps:', allApps[appIndex]);
        }
        
        // Update filteredApps if it contains this app
        const filteredAppIndex = filteredApps.findIndex(app => app.name === appName);
        console.log('App index in filteredApps:', filteredAppIndex);
        if (filteredAppIndex !== -1) {
            filteredApps[filteredAppIndex].featured = isFeatured;
            filteredApps[filteredAppIndex].lastModified = new Date().toISOString();
            console.log('Updated filteredApps:', filteredApps[filteredAppIndex]);
        }
        
        // Update the display
        renderAppsTable();
        updateStats(filteredApps);
        
        console.log(`Uygulama öne çıkarılan durumu güncellendi: ${appName} -> ${isFeatured ? 'Öne çıkarıldı' : 'Öne çıkarılanlardan çıkarıldı'}`);
        
    } catch (error) {
        console.error('Öne çıkarılan durumu güncellenirken hata:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('App name:', appName);
        console.error('Featured status:', isFeatured);
        console.error('URL:', url);
        
        let errorMessage = 'Öne çıkarılan durumu güncellenemedi: ';
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Sunucuya bağlanılamıyor. Lütfen:\n1. Sunucunun çalıştığından emin olun\n2. Tarayıcı konsolunu kontrol edin\n3. Ağ bağlantınızı kontrol edin';
        } else if (error.message.includes('NetworkError')) {
            errorMessage += 'Ağ hatası. İnternet bağlantınızı kontrol edin.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
        
        // Revert the checkbox to original state
        checkboxElement.checked = !isFeatured;
    }
}

// Test function - call this from browser console
window.testFeaturedToggle = function() {
    console.log('Testing featured toggle...');
    const checkboxes = document.querySelectorAll('.featured-checkbox');
    console.log('Found checkboxes:', checkboxes.length);
    
    if (checkboxes.length > 0) {
        const firstCheckbox = checkboxes[0];
        console.log('First checkbox:', firstCheckbox);
        console.log('App name:', firstCheckbox.dataset.appName);
        console.log('Current state:', firstCheckbox.checked);
        
        // Toggle the first checkbox
        firstCheckbox.checked = !firstCheckbox.checked;
        firstCheckbox.dispatchEvent(new Event('change'));
    } else {
        console.log('No checkboxes found!');
    }
};