// Performance optimizations
const performanceOptimizer = {
    // Debounce function for search
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function for scroll events
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Lazy load images
    initLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    },

    // Preload critical resources
    preloadResources() {
        const criticalResources = [
            'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = 'style';
            document.head.appendChild(link);
        });
    }
};

// Initialize performance optimizations
document.addEventListener('DOMContentLoaded', () => {
    performanceOptimizer.initLazyLoading();
    performanceOptimizer.preloadResources();
});

// Global variables
let currentPage = 1;
let totalPages = 1;
let currentSearch = '';
let currentCategory = 'Tümü';
let currentSort = 'default';
let isLoading = false;
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

// DOM elements
const appList = document.querySelector('.app-list');
const categoryList = document.querySelector('.categories ul');
const searchInput = document.querySelector('.search-bar input');
const sortSelect = document.getElementById('sort-select');
const hamburgerMenu = document.querySelector('.hamburger-menu');

// Event listeners
if (hamburgerMenu) {
    hamburgerMenu.addEventListener('click', () => {
        const categories = document.querySelector('.categories');
        categories.classList.toggle('open');
    });
}

// Categories with static data fallback
async function fetchAndRenderCategories() {
    console.log('Loading categories...');
    
    // Static categories data
    const staticCategories = {
        hierarchy: {
            "Oyunlar": {
                subcategories: ["Aksiyon", "Macera", "Masa Oyunları", "Kart Oyunları", "Kumarhane Oyunları", "Basit Eğlence", "Aile", "Müzik Oyunları", "Bulmaca", "Yarış", "Rol Yapma", "Simülasyon", "Spor Oyunları", "Strateji", "Bilgi Yarışması", "Kelime Oyunları"]
            },
            "Programlar": {
                subcategories: ["İş", "Geliştirici Araçları", "Eğitim", "Eğlence", "Finans", "Grafik ve Tasarım", "Sağlık ve Fitness", "Yaşam Tarzı", "Tıp", "Müzik", "Haberler", "Fotoğraf ve Video", "Verimlilik", "Referans", "Alışveriş", "Sosyal Ağ", "Spor", "Seyahat", "Yardımcı Programlar", "Hava Durumu"]
            }
        },
        existing: ["Fotoğraf ve Video", "Grafik ve Tasarım", "Müzik", "Geliştirici Araçları", "İş", "Eğitim", "Sağlık ve Fitness", "Yaşam Tarzı", "Verimlilik", "Haberler"]
    };

    try {
        // Try API first
        const response = await fetch('/.netlify/functions/categories');
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const apiData = await response.json();
                console.log('API working, using server data');
                renderCategories(apiData);
                return;
            }
        }
        console.log('API not available, using static data');
    } catch (error) {
        console.log('API error, using static data:', error.message);
    }

    // Use static data
    renderCategories(staticCategories);
}

function renderCategories(categoryData) {
    const hierarchy = categoryData.hierarchy || {};
    const existing = categoryData.existing || [];

    categoryList.innerHTML = '';

    // Add Tümü and Favoriler
    ['Tümü', 'Favoriler'].forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="#" data-category="${cat}">${cat}</a>`;
        if (cat === currentCategory) {
            li.querySelector('a').classList.add('active');
        }
        categoryList.appendChild(li);
    });

    // Add existing categories
    existing.forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="#" data-category="${cat}">${cat}</a>`;
        if (cat === currentCategory) {
            li.querySelector('a').classList.add('active');
        }
        categoryList.appendChild(li);
    });

    // Add hierarchical categories
    Object.keys(hierarchy).forEach(mainCategory => {
        const mainLi = document.createElement('li');
        mainLi.innerHTML = `<a href="#" data-category="${mainCategory}">${mainCategory}</a>`;
        if (mainCategory === currentCategory) {
            mainLi.querySelector('a').classList.add('active');
        }
        categoryList.appendChild(mainLi);
        
        if (hierarchy[mainCategory].subcategories) {
            const subList = document.createElement('ul');
            subList.className = 'subcategories';
            hierarchy[mainCategory].subcategories.forEach(subCat => {
                const subLi = document.createElement('li');
                subLi.innerHTML = `<a href="#" data-category="${subCat}">${subCat}</a>`;
                if (subCat === currentCategory) {
                    subLi.querySelector('a').classList.add('active');
                }
                subList.appendChild(subLi);
            });
            mainLi.appendChild(subList);
        }
    });
}

// Apps with static data fallback
async function fetchApps(page = 1, search = '', category = 'Tümü', sort = 'default') {
    if (isLoading) return;
    isLoading = true;

    showLoadingState();

    // Static apps data
    const staticApps = [
        {
            name: "DaVinci Resolve Studio",
            category: "Fotoğraf ve Video",
            version: "18.5",
            fileSize: "5.1 GB",
            image: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a0/e6/09/a0e60971-0d09-de64-ebe7-4c8b113e5bcc/Resolve.png/1200x630bb.png",
            description: "Profesyonel video düzenleme yazılımı. Hollywood kalitesinde post-production araçları sunar.",
            downloadUrl: "https://www.blackmagicdesign.com/products/davinciresolve",
            badgeType: "new",
            features: ["8K video desteği", "Gelişmiş renk düzeltme", "Ses düzenleme araçları", "VFX ve motion graphics"],
            installation: ["Dosyayı indirin", "DMG dosyasını açın", "Uygulamayı Applications klasörüne sürükleyin", "Launchpad'den çalıştırın"],
            systemRequirements: ["macOS 11.0 veya üzeri", "8GB RAM (16GB önerilen)", "4GB boş disk alanı", "Metal uyumlu grafik kartı"]
        },
        {
            name: "Visual Studio Code",
            category: "Geliştirici Araçları",
            version: "1.85",
            fileSize: "200 MB",
            image: "https://code.visualstudio.com/assets/images/code-stable.png",
            description: "Microsoft tarafından geliştirilen ücretsiz kod editörü. Modern web ve bulut uygulamaları geliştirmek için tasarlanmıştır.",
            downloadUrl: "https://code.visualstudio.com/",
            badgeType: "updated",
            features: ["IntelliSense kod tamamlama", "Hata ayıklama desteği", "Git entegrasyonu", "Genişletilebilir eklenti sistemi"],
            installation: ["VS Code'u indirin", "DMG dosyasını açın", "Uygulamayı Applications klasörüne sürükleyin", "İlk açılışta eklentileri yapılandırın"],
            systemRequirements: ["macOS 10.15 veya üzeri", "2GB RAM", "200MB boş disk alanı", "İnternet bağlantısı (eklentiler için)"]
        },
        {
            name: "Sketch",
            category: "Grafik ve Tasarım",
            version: "98.2",
            fileSize: "45 MB",
            image: "https://cdn.sketch.com/images/sketch-logo.png",
            description: "Dijital tasarım için profesyonel araç. UI/UX tasarımcıları için özel olarak geliştirilmiştir.",
            downloadUrl: "https://www.sketch.com/",
            badgeType: "new",
            features: ["Vektör tabanlı çizim araçları", "Prototipleme desteği", "Eklenti ekosistemi", "Takım çalışması araçları"],
            installation: ["Sketch'i indirin", "DMG dosyasını açın", "Uygulamayı kurun", "Lisans anahtarınızı girin"],
            systemRequirements: ["macOS 11.0 veya üzeri", "4GB RAM", "500MB boş disk alanı", "Retina ekran önerilen"]
        },
        {
            name: "Logic Pro",
            category: "Müzik",
            version: "10.7.9",
            fileSize: "6.2 GB",
            image: "https://support.apple.com/library/content/dam/edam/applecare/images/en_US/music/logic-pro-icon.png",
            description: "Apple'ın profesyonel müzik üretim yazılımı. Kayıt, düzenleme ve miksaj için kapsamlı araçlar sunar.",
            downloadUrl: "https://www.apple.com/logic-pro/",
            badgeType: "updated",
            features: ["Profesyonel kayıt araçları", "3000+ ses ve loop", "MIDI düzenleme", "Gelişmiş miksaj konsolu"],
            installation: ["Mac App Store'dan indirin", "Apple ID ile giriş yapın", "İndirme tamamlandıktan sonra açın", "İlk kurulum sihirbazını takip edin"],
            systemRequirements: ["macOS 12.3 veya üzeri", "8GB RAM (16GB önerilen)", "6GB boş disk alanı", "Audio interface önerilen"]
        }
    ];

    console.log('Using static apps data');

    try {
        // Try API first
        const url = new URL('/.netlify/functions/apps', window.location.origin);
        url.searchParams.append('page', page);
        url.searchParams.append('limit', 20);
        if (search) url.searchParams.append('search', search);
        if (category !== 'Tümü') url.searchParams.append('category', category);
        url.searchParams.append('sort', sort);

        const response = await fetch(url);
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                console.log('API working, using server data');
                renderApps(data);
                return;
            }
        }
        console.log('API not available, using static data');
    } catch (error) {
        console.log('API error, using static data:', error.message);
    }

    // Use static data
    const data = {
        apps: staticApps,
        currentPage: 1,
        totalPages: 1,
        totalApps: staticApps.length
    };
    renderApps(data);
}

function renderApps(data) {
    appList.innerHTML = '';
    
    const isMainPage = data.currentPage === 1 && !currentSearch && currentCategory === 'Tümü';
    if (!isMainPage) {
        const featuredSection = document.querySelector('.featured-apps');
        if (featuredSection) featuredSection.style.display = 'none';
    }
    
    let appsToDisplay = data.apps;
    if (currentCategory === 'Favoriler') {
        appsToDisplay = appsToDisplay.filter(app => favorites.includes(app.name));
    }
    
    displayApps(appsToDisplay);
    currentPage = data.currentPage;
    totalPages = data.totalPages;
    renderPagination(totalPages, currentPage);
    
    isLoading = false;
    hideLoadingState();
}

// Featured apps with static data fallback
async function fetchFeaturedApps() {
    const staticFeaturedApps = [
        {
            name: "DaVinci Resolve Studio",
            category: "Fotoğraf ve Video",
            version: "18.5",
            fileSize: "5.1 GB",
            image: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a0/e6/09/a0e60971-0d09-de64-ebe7-4c8b113e5bcc/Resolve.png/1200x630bb.png",
            description: "Profesyonel video düzenleme yazılımı",
            downloadUrl: "https://www.blackmagicdesign.com/products/davinciresolve",
            badgeType: "new",
            internalImages: [
                "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/1d/8e/70/1d8e701d-06e3-9ed5-fd5a-926788cb10d9/DaVinciResolve20_AppStore_Cut.png/1286x0w.webp",
                "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/fb/ff/e0/fbffe04c-59f0-9253-3451-85baad667899/DaVinciResolve20_AppStore_Edit.png/1286x0w.webp",
                "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/4c/d9/7a/4cd97a6b-1bea-9bca-1633-c6881b038f5b/DaVinciResolve20_AppStore_Fusion.png/1286x0w.webp"
            ]
        },
        {
            name: "Visual Studio Code",
            category: "Geliştirici Araçları",
            version: "1.85",
            fileSize: "200 MB",
            image: "https://code.visualstudio.com/assets/images/code-stable.png",
            description: "Microsoft'un ücretsiz kod editörü",
            downloadUrl: "https://code.visualstudio.com/",
            badgeType: "updated",
            internalImages: [
                "https://code.visualstudio.com/assets/docs/getstarted/tips-and-tricks/hero.png",
                "https://code.visualstudio.com/assets/docs/languages/python/run-python-code-in-terminal.png"
            ]
        },
        {
            name: "Logic Pro",
            category: "Müzik",
            version: "10.7.9",
            fileSize: "6.2 GB",
            image: "https://support.apple.com/library/content/dam/edam/applecare/images/en_US/music/logic-pro-icon.png",
            description: "Apple'ın profesyonel müzik yazılımı",
            downloadUrl: "https://www.apple.com/logic-pro/",
            badgeType: "new"
        }
    ];

    console.log('Using static featured apps data');

    try {
        const response = await fetch('/.netlify/functions/featured-apps');
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const featuredApps = await response.json();
                console.log('API working, using server data');
                renderFeaturedApps(featuredApps);
                return;
            }
        }
        console.log('API not available, using static data');
    } catch (error) {
        console.log('API error, using static data:', error.message);
    }

    renderFeaturedApps(staticFeaturedApps);
}

function renderFeaturedApps(featuredApps) {
    const container = document.querySelector('.featured-container');
    if (!container) return;

    container.innerHTML = '';
    
    featuredApps.forEach(app => {
        const appCard = document.createElement('div');
        appCard.className = 'app-card featured-app-card';
        
        let badgeHtml = '';
        if (app.badgeType === 'new') {
            badgeHtml = '<div class="app-badge new">YENİ</div>';
        } else if (app.badgeType === 'updated') {
            badgeHtml = '<div class="app-badge updated">GÜNCELLENDİ</div>';
        }
        
        appCard.innerHTML = `
            ${badgeHtml}
            <div class="file-size-tooltip">${app.fileSize}</div>
            <div class="app-preview-container">
                <div class="app-preview-slider">
                    ${app.internalImages ? app.internalImages.map(img => 
                        `<img src="${img}" alt="${app.name}" class="app-preview-slide">`
                    ).join('') : `<img src="${app.image}" alt="${app.name}" class="app-preview-slide">`}
                </div>
                <div class="app-logo-overlay">
                    <img src="${app.image}" alt="${app.name} Logo" class="app-logo-small">
                </div>
            </div>
            <h3>${app.name}</h3>
            <p>${app.category}</p>
        `;
        
        appCard.addEventListener('click', () => showAppDetails(app));
        container.appendChild(appCard);
    });
}

// Rest of the functions remain the same...
// (I'll include the essential functions for the app to work)

function displayApps(apps) {
    apps.forEach(app => {
        const appCard = createAppCard(app);
        appList.appendChild(appCard);
    });
}

function createAppCard(app) {
    const appCard = document.createElement('div');
    appCard.className = 'app-card';
    
    let badgeHtml = '';
    if (app.badgeType === 'new') {
        badgeHtml = '<div class="app-badge new">YENİ</div>';
    } else if (app.badgeType === 'updated') {
        badgeHtml = '<div class="app-badge updated">GÜNCELLENDİ</div>';
    }
    
    appCard.innerHTML = `
        ${badgeHtml}
        <div class="file-size-tooltip">${app.fileSize}</div>
        <img src="${app.image}" alt="${app.name}" class="app-image">
        <h3>${app.name}</h3>
        <p>${app.category}</p>
        <div class="app-actions">
            <button class="btn btn-primary" onclick="window.open('${app.downloadUrl}', '_blank')">
                <i class="fas fa-download"></i> İndir
            </button>
            <button class="btn btn-secondary" onclick="showAppDetails(${JSON.stringify(app).replace(/"/g, '&quot;')})">
                <i class="fas fa-info-circle"></i> Detay
            </button>
        </div>
    `;
    
    return appCard;
}

function showAppDetails(app) {
    // This would show the app details modal
    console.log('Showing details for:', app.name);
}

function showLoadingState() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-state';
    loadingDiv.innerHTML = '<div class="spinner"></div><p>Yükleniyor...</p>';
    appList.appendChild(loadingDiv);
}

function hideLoadingState() {
    const loadingDiv = document.querySelector('.loading-state');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function renderPagination(totalPages, currentPage) {
    const paginationContainer = document.querySelector('.pagination-container');
    if (!paginationContainer) return;
    
    paginationContainer.innerHTML = '';
    
    // Previous button
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn prev';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Önceki';
        prevBtn.addEventListener('click', () => {
            fetchApps(currentPage - 1, currentSearch, currentCategory, currentSort);
        });
        paginationContainer.appendChild(prevBtn);
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            fetchApps(i, currentSearch, currentCategory, currentSort);
        });
        paginationContainer.appendChild(pageBtn);
    }
    
    // Next button
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn next';
        nextBtn.innerHTML = 'Sonraki <i class="fas fa-chevron-right"></i>';
        nextBtn.addEventListener('click', () => {
            fetchApps(currentPage + 1, currentSearch, currentCategory, currentSort);
        });
        paginationContainer.appendChild(nextBtn);
    }
}

// Initialize page
async function initializePage() {
    console.log('Initializing page...');
    await fetchAndRenderCategories();
    fetchApps();
    fetchFeaturedApps();
    console.log('Page initialization complete');
}

// Event listeners
if (searchInput) {
    searchInput.addEventListener('input', performanceOptimizer.debounce((e) => {
        currentSearch = e.target.value;
        fetchApps(1, currentSearch, currentCategory, currentSort);
    }, 300));
}

if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        fetchApps(1, currentSearch, currentCategory, currentSort);
    });
}

// Category click handlers
document.addEventListener('click', (e) => {
    if (e.target.matches('[data-category]')) {
        e.preventDefault();
        currentCategory = e.target.dataset.category;
        
        // Update active category
        document.querySelectorAll('[data-category]').forEach(link => {
            link.classList.remove('active');
        });
        e.target.classList.add('active');
        
        fetchApps(1, currentSearch, currentCategory, currentSort);
    }
});

// Carousel navigation
document.getElementById('featured-next')?.addEventListener('click', () => {
    const container = document.querySelector('.featured-container');
    container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
});

document.getElementById('featured-prev')?.addEventListener('click', () => {
    const container = document.querySelector('.featured-container');
    container.scrollBy({ left: -container.clientWidth, behavior: 'smooth' });
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
