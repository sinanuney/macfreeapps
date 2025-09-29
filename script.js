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
            '/style.css',
            '/script.js',
            '/logo.png'
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            
            if (resource.endsWith('.css')) {
                link.as = 'style';
            } else if (resource.endsWith('.js')) {
                link.as = 'script';
            } else if (resource.endsWith('.png') || resource.endsWith('.jpg')) {
                link.as = 'image';
            }
            
            document.head.appendChild(link);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize performance optimizations
    performanceOptimizer.preloadResources();
    performanceOptimizer.initLazyLoading();
    
    const appList = document.querySelector('.app-list');
    const categoryList = document.querySelector('.categories ul');
    const searchInput = document.querySelector('.search-bar input');
    const searchButton = document.querySelector('.search-bar button');
    const sortSelect = document.getElementById('sort-select');
    const paginationContainer = document.querySelector('.pagination-container');

    let favorites = JSON.parse(localStorage.getItem('appFavorites')) || [];
    let currentPage = 1;
    let totalPages = 1;
    let currentSearch = '';
    let currentCategory = 'Tümü';
    let currentSort = 'default';
    let isLoading = false;
    let currentApps = [];

    // Rozet mantığı için yardımcı fonksiyonlar
    function isNewApp(app) {
        if (!app.creationDate) return false;
        const creationDate = new Date(app.creationDate);
        const now = new Date();
        const daysDiff = (now - creationDate) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Son 7 gün içinde eklenen uygulamalar
    }

    function isUpdatedApp(app) {
        if (!app.lastModified) return false;
        const lastModified = new Date(app.lastModified);
        const now = new Date();
        const daysSinceUpdate = (now - lastModified) / (1000 * 60 * 60 * 24);
        
        // Eğer creationDate varsa, yeni uygulama olmadığından emin ol
        if (app.creationDate) {
            const creationDate = new Date(app.creationDate);
            const daysSinceCreation = (now - creationDate) / (1000 * 60 * 60 * 24);
            // Son 3 gün içinde güncellenmiş ve en az 1 saat önce oluşturulmuş
            return daysSinceUpdate <= 3 && daysSinceCreation > (1/24); // 1 saat = 1/24 gün
        } else {
            // creationDate yoksa, sadece son 3 gün içinde güncellenmiş mi kontrol et
            return daysSinceUpdate <= 3;
        }
    }

    function getAppBadge(app) {
        // Manuel rozet seçimini kontrol et
        const badgeType = app.badgeType || 'none';
        
        if (badgeType === 'updated') {
            return '<div class="app-badge updated">GÜNCELLENDİ</div>';
        } else if (badgeType === 'new') {
            return '<div class="app-badge new">YENİ</div>';
        }
        return '';
    }

    const hamburgerMenu = document.querySelector('.hamburger-menu');

    hamburgerMenu.addEventListener('click', () => {
        const categories = document.querySelector('.categories');
        categories.classList.toggle('open');
    });

    async function fetchAndRenderCategories() {
        console.log('Loading categories...');
        
        try {
            const response = await fetch('/.netlify/functions/categories');
            if (!response.ok) {
                console.log('API not available (status:', response.status, '), using fallback data');
                throw new Error('Kategoriler yüklenemedi');
            }
            
            // Response'un JSON olup olmadığını kontrol et
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Expected JSON but got:', text.substring(0, 200));
                throw new Error('Server returned non-JSON response');
            }
            
            const categoryData = await response.json();
            console.log('API working, using server data');
            
            // Yeni API formatından kategorileri al
            const hierarchy = categoryData.hierarchy || {};
            const existing = categoryData.existing || [];

            categoryList.innerHTML = '';

            // Tümü ve Favoriler seçeneklerini ekle
            ['Tümü', 'Favoriler'].forEach(cat => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" data-category="${cat}">${cat}</a>`;
                if (cat === currentCategory) {
                    li.querySelector('a').classList.add('active');
                }
                categoryList.appendChild(li);
            });

            // Ana kategorileri ekle
            Object.keys(hierarchy).forEach(mainCategory => {
                const li = document.createElement('li');
                li.classList.add('parent-category');
                li.innerHTML = `<a href="#" data-category="${mainCategory}"><span class="toggle-icon">▶</span>${mainCategory}</a>`;
                
                // Alt kategorileri ekle
                const subList = document.createElement('ul');
                hierarchy[mainCategory].subcategories.forEach(subCategory => {
                    const subLi = document.createElement('li');
                    subLi.innerHTML = `<a href="#" data-category="${subCategory}">${subCategory}</a>`;
                    subList.appendChild(subLi);
                });
                
                li.appendChild(subList);
                categoryList.appendChild(li);
            });

            // Mevcut kategorileri de ekle (hiyerarşide olmayanlar)
            const existingNotInHierarchy = existing.filter(cat => 
                !Object.values(hierarchy).some(data => data.subcategories.includes(cat))
            );
            
            if (existingNotInHierarchy.length > 0) {
                const customLi = document.createElement('li');
                customLi.classList.add('parent-category');
                customLi.innerHTML = `<a href="#" data-category="Mevcut Kategoriler"><span class="toggle-icon">▶</span>Mevcut Kategoriler</a>`;
                
                const customSubList = document.createElement('ul');
                existingNotInHierarchy.forEach(category => {
                    const subLi = document.createElement('li');
                    subLi.innerHTML = `<a href="#" data-category="${category}">${category}</a>`;
                    customSubList.appendChild(subLi);
                });
                
                customLi.appendChild(customSubList);
                categoryList.appendChild(customLi);
            }

        } catch (error) {
            console.error('Kategoriler yüklenirken hata:', error);
            console.log('Using fallback categories data');
            // Fallback kategoriler - orijinal tasarımı koru
            const fallbackCategories = {
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
            
            const hierarchy = fallbackCategories.hierarchy || {};
            const existing = fallbackCategories.existing || [];
            
            categoryList.innerHTML = '';

            // Tümü ve Favoriler seçeneklerini ekle
            ['Tümü', 'Favoriler'].forEach(cat => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" data-category="${cat}">${cat}</a>`;
                if (cat === currentCategory) {
                    li.querySelector('a').classList.add('active');
                }
                categoryList.appendChild(li);
            });

            // Ana kategorileri ekle
            Object.keys(hierarchy).forEach(mainCategory => {
                const li = document.createElement('li');
                li.classList.add('parent-category');
                li.innerHTML = `<a href="#" data-category="${mainCategory}"><span class="toggle-icon">▶</span>${mainCategory}</a>`;
                
                // Alt kategorileri ekle
                const subList = document.createElement('ul');
                hierarchy[mainCategory].subcategories.forEach(subCategory => {
                    const subLi = document.createElement('li');
                    subLi.innerHTML = `<a href="#" data-category="${subCategory}">${subCategory}</a>`;
                    subList.appendChild(subLi);
                });
                
                li.appendChild(subList);
                categoryList.appendChild(li);
            });

            // Mevcut kategorileri de ekle (hiyerarşide olmayanlar)
            const existingNotInHierarchy = existing.filter(cat => 
                !Object.values(hierarchy).some(data => data.subcategories.includes(cat))
            );
            
            if (existingNotInHierarchy.length > 0) {
                const customLi = document.createElement('li');
                customLi.classList.add('parent-category');
                customLi.innerHTML = `<a href="#" data-category="Mevcut Kategoriler"><span class="toggle-icon">▶</span>Mevcut Kategoriler</a>`;
                
                const customSubList = document.createElement('ul');
                existingNotInHierarchy.forEach(category => {
                    const subLi = document.createElement('li');
                    subLi.innerHTML = `<a href="#" data-category="${category}">${category}</a>`;
                    customSubList.appendChild(subLi);
                });
                
                customLi.appendChild(customSubList);
                categoryList.appendChild(customLi);
            }
        }
    }



    async function fetchApps(page = 1, search = '', category = 'Tümü', sort = 'default') {
        if (isLoading) return;
        isLoading = true;

        // Show loading state
        showLoadingState();

        const url = new URL('/.netlify/functions/apps', window.location.origin);
        url.searchParams.append('page', page);
        url.searchParams.append('limit', 20); // 20 uygulama per sayfa
        if (search) url.searchParams.append('search', search);
        
        if (category !== 'Tümü') {
            url.searchParams.append('category', category);
        }
        
        url.searchParams.append('sort', sort);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.log('API not available (status:', response.status, '), using fallback data');
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Response'un JSON olup olmadığını kontrol et
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Expected JSON but got:', text.substring(0, 200));
                throw new Error('Server returned non-JSON response');
            }
            
            const data = await response.json();
            console.log('API working, using server data');

            appList.innerHTML = '';
            
            // Featured apps are now handled separately by fetchFeaturedApps()
            // Check if we should show featured section based on current page and filters
            const isMainPage = page === 1 && !search && category === 'Tümü';
            if (!isMainPage) {
                document.querySelector('.featured-apps').style.display = 'none';
            }
            
            let appsToDisplay = data.apps;
            if (currentCategory === 'Favoriler') {
                appsToDisplay = appsToDisplay.filter(app => favorites.includes(app.name));
            }

            displayApps(appsToDisplay);

            currentPage = data.currentPage;
            totalPages = data.totalPages;

            renderPagination(totalPages, currentPage);

        } catch (error) {
            console.error('Failed to fetch apps:', error);
            console.log('Using fallback apps data');
            // Fallback to local data if API fails
            const fallbackApps = [
                {
                    name: "DaVinci Resolve Studio",
                    category: "Fotoğraf ve Video",
                    version: "18.5",
                    fileSize: "5.1 GB",
                    image: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a0/e6/09/a0e60971-0d09-de64-ebe7-4c8b113e5bcc/Resolve.png/1200x630bb.png",
                    description: "Profesyonel video düzenleme yazılımı. Hollywood kalitesinde post-production araçları sunar.",
                    downloadUrl: "https://www.blackmagicdesign.com/products/davinciresolve",
                    badgeType: "new"
                },
                {
                    name: "Visual Studio Code",
                    category: "Geliştirici Araçları",
                    version: "1.85",
                    fileSize: "200 MB",
                    image: "https://code.visualstudio.com/assets/images/code-stable.png",
                    description: "Microsoft tarafından geliştirilen ücretsiz kod editörü.",
                    downloadUrl: "https://code.visualstudio.com/",
                    badgeType: "updated"
                }
            ];
            
            appList.innerHTML = '';
            let appsToDisplay = fallbackApps;
            if (currentCategory === 'Favoriler') {
                appsToDisplay = appsToDisplay.filter(app => favorites.includes(app.name));
            }
            
            appsToDisplay.forEach(app => {
                const appCard = createAppCard(app);
                appList.appendChild(appCard);
            });
            
            // Hide pagination for fallback
            const paginationContainer = document.querySelector('.pagination-container');
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        } finally {
            isLoading = false;
            hideLoadingState();
        }
    }

    function showLoadingState() {
        const appList = document.querySelector('.app-list');
        appList.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p class="loading-text">Uygulamalar yükleniyor...</p>
            </div>
        `;
    }

    function hideLoadingState() {
        // Loading state will be replaced by actual content
    }

    function renderFeaturedApps(featuredApps) {
        console.log('renderFeaturedApps called with:', featuredApps);
        const featuredContainer = document.querySelector('.featured-container');
        console.log('Featured container found:', !!featuredContainer);
        if (!featuredContainer) return;
        
        // Clear existing content
        featuredContainer.innerHTML = '';

        // Sadece öne çıkarılan uygulamaları göster (maksimum 10 tane)
        const appsToShow = featuredApps.slice(0, 10);
        console.log('Apps to show:', appsToShow);

        // Featured section'ı kontrol et - sadece ana sayfada ve filtre yokken göster
        const isMainPage = currentPage === 1 && !currentSearch && currentCategory === 'Tümü';
        
        if (appsToShow.length === 0) {
            console.log('No featured apps to show, hiding section');
            document.querySelector('.featured-apps').style.display = 'none';
            return;
        }

        if (!isMainPage) {
            console.log('Not main page, hiding section');
            document.querySelector('.featured-apps').style.display = 'none';
            return;
        }

        console.log('Showing featured apps section');
        document.querySelector('.featured-apps').style.display = 'block';

        appsToShow.forEach(app => {
            const appCard = document.createElement('div');
            appCard.classList.add('app-card', 'featured-app-card');
            const isFavorite = favorites.includes(app.name);

            // Create slider HTML if internal images exist
            let previewHTML = '';
            if (app.internalImages && app.internalImages.length > 0) {
                previewHTML = `
                    <div class="app-preview-container">
                        <div class="app-preview-slider">
                            ${app.internalImages.map(img => 
                                `<img src="${img}" alt="${app.name}" class="app-preview-slide">`
                            ).join('')}
                        </div>
                        <div class="app-logo-overlay">
                            <img src="${app.image || ''}" alt="${app.name} Logo" class="app-logo-small">
                        </div>
                    </div>
                `;
            } else {
                previewHTML = `
                    <div class="app-preview-container">
                        <img src="${app.image || ''}" alt="${app.name}" class="app-preview">
                        <div class="app-logo-overlay">
                            <img src="${app.image || ''}" alt="${app.name} Logo" class="app-logo-small">
                        </div>
                    </div>
                `;
            }

            appCard.innerHTML = `
                ${getAppBadge(app)}
                ${app.fileSize ? `<div class="file-size-tooltip">${app.fileSize}</div>` : ''}
                ${previewHTML}
                <h3>${app.name}</h3>
                <p>${app.category}</p>
            `;

            appCard.addEventListener('click', (e) => {
                e.preventDefault();
                openAppDetailsModal(app);
            });

            featuredContainer.appendChild(appCard);
        });
    }

    function displayApps(apps) {
        currentApps = apps; // Store current apps for resize handling
        
        // Clear existing content first
        appList.innerHTML = '';
        
        if (apps.length === 0) {
            appList.innerHTML = '<p class="no-results-message">Bu kriterlere uygun uygulama bulunamadı.</p>';
            return;
        }

        apps.forEach(app => {
            const appCard = document.createElement('div');
            const isFavorite = favorites.includes(app.name);
            const creationDate = app.creationDate ? new Date(app.creationDate).toLocaleDateString('tr-TR') : '-';

            // Check if mobile layout (screen width <= 768px)
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // Mobile list layout
                appCard.classList.add('app-card');
                appCard.innerHTML = `
                    <img src="${app.image || ''}" alt="${app.name}" class="app-preview">
                    <div class="app-card-content">
                        <h3>${app.name}</h3>
                        <p>${app.category}</p>
                    </div>
                    <div class="app-version">${app.version || 'N/A'}</div>
                `;
            } else {
                // Desktop grid layout
                appCard.classList.add('app-card');
                // Desktop grid layout
                appCard.innerHTML = `
                    <div class="app-header">
                        <button class="favorite-btn ${isFavorite ? 'favorited' : ''}" data-app-name="${app.name}" aria-label="${isFavorite ? 'Favorilerden kaldır' : 'Favorilere ekle'}">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                    ${getAppBadge(app)}
                    ${app.fileSize ? `<div class="file-size-tooltip">${app.fileSize}</div>` : ''}
                    <img src="${app.image || ''}" alt="${app.name}" class="app-preview">
                    <h3>${app.name}</h3>
                    <p>${app.category}</p>
                    <div class="app-details">
                        <span>Tarih: ${creationDate}</span>
                    </div>
                    <a href="${app.downloadUrl || '#'}" class="download-btn" target="_blank" rel="noopener noreferrer">İndir</a>
                `;
            }

            appCard.addEventListener('click', (e) => {
                if (isMobile) {
                    // Mobile: only prevent modal if clicking on version
                    if (!e.target.closest('.app-version')) {
                        e.preventDefault();
                        openAppDetailsModal(app);
                    }
                } else {
                    // Desktop: prevent modal for buttons
                    if (e.target.matches('.download-btn, .favorite-btn, .favorite-btn *')) {
                        e.stopPropagation(); 
                    } else {
                        e.preventDefault();
                        openAppDetailsModal(app);
                    }
                }
            });

            const favoriteBtn = appCard.querySelector('.favorite-btn');
            if (favoriteBtn) {
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(app.name, favoriteBtn);
                });
            }

            appList.appendChild(appCard);
        });
    }

    function toggleFavorite(appName, btnElement) {
        const index = favorites.indexOf(appName);
        if (index > -1) {
            favorites.splice(index, 1);
            btnElement.classList.remove('favorited');
        } else {
            favorites.push(appName);
            btnElement.classList.add('favorited');
        }
        localStorage.setItem('appFavorites', JSON.stringify(favorites));
        
        // If we are in the "Favorites" category, refresh the list
        if (currentCategory === 'Favoriler') {
            handleNewSearch();
        }
    }

    function handleNewSearch() {
        currentPage = 1;
        fetchApps(currentPage, currentSearch, currentCategory, currentSort);
    }


    searchButton.addEventListener('click', () => {
        currentSearch = searchInput.value.trim();
        handleNewSearch();
    });

    // Debounced search to improve performance
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.trim();
            handleNewSearch();
        }, 300); // 300ms delay
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            currentSearch = searchInput.value.trim();
            handleNewSearch();
        }
    });

    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        handleNewSearch();
    });

    categoryList.addEventListener('click', (e) => {
        e.preventDefault();
        const link = e.target.closest('a');
        if (!link) return;

        const category = link.dataset.category;
        
        const parentLi = link.parentElement;
        if (parentLi.classList.contains('parent-category')) {
            parentLi.classList.toggle('open');
        }

        categoryList.querySelectorAll('a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentCategory = category;
        handleNewSearch();
        
        // Sayfanın en üstüne çık
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function renderPagination(totalPages, currentPage) {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        // Previous page button
        const prevBtn = document.createElement('a');
        prevBtn.href = '#';
        prevBtn.textContent = '‹';
        prevBtn.classList.add('pagination-btn', 'pagination-nav');
        if (currentPage === 1) {
            prevBtn.classList.add('disabled');
        } else {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                fetchApps(currentPage - 1, currentSearch, currentCategory, currentSort);
            });
        }
        paginationContainer.appendChild(prevBtn);

        // Show only 3 pages around current page
        let startPage = Math.max(1, currentPage - 1);
        let endPage = Math.min(totalPages, currentPage + 1);
        
        // Adjust if we're near the beginning or end
        if (currentPage === 1) {
            endPage = Math.min(3, totalPages);
        } else if (currentPage === totalPages) {
            startPage = Math.max(1, totalPages - 2);
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            const pageLink = createPageLink(i, currentPage);
            paginationContainer.appendChild(pageLink);
        }

        // Next page button
        const nextBtn = document.createElement('a');
        nextBtn.href = '#';
        nextBtn.textContent = '›';
        nextBtn.classList.add('pagination-btn', 'pagination-nav');
        if (currentPage === totalPages) {
            nextBtn.classList.add('disabled');
        } else {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                fetchApps(currentPage + 1, currentSearch, currentCategory, currentSort);
            });
        }
        paginationContainer.appendChild(nextBtn);
    }

    function createPageLink(pageNumber, currentPage) {
        const pageLink = document.createElement('a');
        pageLink.href = '#';
        pageLink.textContent = pageNumber;
        pageLink.classList.add('pagination-btn');
        
        if (pageNumber === currentPage) {
            pageLink.classList.add('active');
        } else {
            pageLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Scroll to top when changing pages
                window.scrollTo({ top: 0, behavior: 'smooth' });
                fetchApps(pageNumber, currentSearch, currentCategory, currentSort);
            });
        }
        
        return pageLink;
    }

    document.getElementById('featured-next').addEventListener('click', () => {
        const container = document.querySelector('.featured-container');
        container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
    });

    document.getElementById('featured-prev').addEventListener('click', () => {
        const container = document.querySelector('.featured-container');
        container.scrollBy({ left: -container.clientWidth, behavior: 'smooth' });
    });

    // Fetch featured apps from server
    async function fetchFeaturedApps() {
        try {
            console.log('Fetching featured apps...');
            const response = await fetch('/.netlify/functions/featured-apps');
            if (!response.ok) {
                console.log('Featured apps API not available (status:', response.status, '), using fallback data');
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Response'un JSON olup olmadığını kontrol et
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Expected JSON but got:', text.substring(0, 200));
                throw new Error('Server returned non-JSON response');
            }
            
            const featuredApps = await response.json();
            console.log('Featured apps received:', featuredApps);
            renderFeaturedApps(featuredApps);
        } catch (error) {
            console.error('Error fetching featured apps:', error);
            console.log('Using fallback featured apps data');
            // Fallback to local data if API fails
            const fallbackFeaturedApps = [
                {
                    name: "DaVinci Resolve Studio",
                    category: "Fotoğraf ve Video",
                    version: "18.5",
                    fileSize: "5.1 GB",
                    image: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a0/e6/09/a0e60971-0d09-de64-ebe7-4c8b113e5bcc/Resolve.png/1200x630bb.png",
                    description: "Profesyonel video düzenleme yazılımı",
                    downloadUrl: "https://www.blackmagicdesign.com/products/davinciresolve",
                    badgeType: "new"
                }
            ];
            renderFeaturedApps(fallbackFeaturedApps);
            const featuredSection = document.querySelector('.featured-section');
            if (featuredSection) {
                featuredSection.style.display = 'none';
            }
        }
    }

    async function initializePage() {
        console.log('Initializing page...');
        await fetchAndRenderCategories();
        fetchApps();
        fetchFeaturedApps();
        console.log('Page initialization complete');
    }


    // Note: Resize handling removed to prevent duplicate cards

    initializePage();

    // Test function - call this from browser console
    window.testFeaturedApps = async function() {
        console.log('Testing featured apps...');
        try {
            const response = await fetch('/.netlify/functions/featured-apps');
            const featuredApps = await response.json();
            console.log('Featured apps from API:', featuredApps);
            
            const featuredContainer = document.querySelector('.featured-container');
            console.log('Featured container:', featuredContainer);
            
            const featuredSection = document.querySelector('.featured-apps');
            console.log('Featured section:', featuredSection);
            console.log('Featured section display:', featuredSection ? featuredSection.style.display : 'not found');
            
            if (featuredApps.length > 0) {
                renderFeaturedApps(featuredApps);
            }
        } catch (error) {
            console.error('Test error:', error);
        }
    };

    // --- MODAL LOGIC ---
    const appDetailsModal = document.getElementById('app-details-modal');
    const imageModal = document.getElementById('image-modal');
    const modals = [appDetailsModal, imageModal];

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('review-image')) {
            const enlargedImage = document.getElementById('enlarged-image');
            enlargedImage.src = e.target.src;
            imageModal.style.display = 'block';
        }
        if (e.target.classList.contains('close')) {
            const modalId = e.target.dataset.modal;
            if (modalId) document.getElementById(modalId).style.display = 'none';
        }
    });

    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });

    // --- MODAL SYSTEM INTEGRATION ---
    // Add modal system functionality to existing features
    
    // Example: Show loading modal when fetching apps
    const originalFetchApps = fetchApps;
    fetchApps = async function(page = 1, search = '', category = 'Tümü', sort = 'default') {
        if (isLoading) return;
        isLoading = true;

        // Show loading modal for better UX
        if (window.modalSystem) {
            window.modalSystem.showLoading('Uygulamalar yükleniyor...');
        }

        // Show loading state
        showLoadingState();

        const url = new URL('/.netlify/functions/apps', window.location.origin);
        url.searchParams.append('page', page);
        url.searchParams.append('limit', 20);
        if (search) url.searchParams.append('search', search);
        
        if (category !== 'Tümü') {
            url.searchParams.append('category', category);
        }
        
        url.searchParams.append('sort', sort);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            appList.innerHTML = '';
            
            const isMainPage = page === 1 && !search && category === 'Tümü';
            if (!isMainPage) {
                document.querySelector('.featured-apps').style.display = 'none';
            }
            
            let appsToDisplay = data.apps;
            if (currentCategory === 'Favoriler') {
                appsToDisplay = appsToDisplay.filter(app => favorites.includes(app.name));
            }

            displayApps(appsToDisplay);

            currentPage = data.currentPage;
            totalPages = data.totalPages;

            renderPagination(totalPages, currentPage);

        } catch (error) {
            console.error('Failed to fetch apps:', error);
            const errorMessage = error.message.includes('Failed to fetch') 
                ? 'Sunucuya bağlanılamıyor. Sunucunun çalıştığından emin olun.' 
                : `Hata: ${error.message}`;
            appList.innerHTML = `<p class="error-message">${errorMessage}</p>`;
            
            // Show error toast
            if (window.modalSystem) {
                window.modalSystem.showToast({
                    title: 'Hata',
                    message: errorMessage,
                    type: 'error',
                    duration: 5000
                });
            }
        } finally {
            isLoading = false;
            hideLoadingState();
            
            // Close loading modal
            if (window.modalSystem) {
                window.modalSystem.closeLoading();
            }
        }
    };

    // Example: Show confirmation when adding to favorites
    const originalToggleFavorite = toggleFavorite;
    toggleFavorite = function(appName, btnElement) {
        const index = favorites.indexOf(appName);
        if (index > -1) {
            // Show confirmation before removing from favorites
            if (window.modalSystem) {
                window.modalSystem.showConfirm({
                    title: 'Favorilerden Kaldır',
                    message: `${appName} uygulamasını favorilerden kaldırmak istediğinizden emin misiniz?`,
                    confirmText: 'Kaldır',
                    cancelText: 'İptal',
                    onConfirm: () => {
                        favorites.splice(index, 1);
                        btnElement.classList.remove('favorited');
                        localStorage.setItem('appFavorites', JSON.stringify(favorites));
                        
                        // Show success toast
                        window.modalSystem.showToast({
                            title: 'Kaldırıldı',
                            message: `${appName} favorilerden kaldırıldı`,
                            type: 'success',
                            duration: 3000
                        });
                        
                        // If we are in the "Favorites" category, refresh the list
                        if (currentCategory === 'Favoriler') {
                            handleNewSearch();
                        }
                    }
                });
            } else {
                // Fallback to original behavior
                originalToggleFavorite(appName, btnElement);
            }
        } else {
            // Add to favorites
            favorites.push(appName);
            btnElement.classList.add('favorited');
            localStorage.setItem('appFavorites', JSON.stringify(favorites));
            
            // Show success toast
            if (window.modalSystem) {
                window.modalSystem.showToast({
                    title: 'Eklendi',
                    message: `${appName} favorilere eklendi`,
                    type: 'success',
                    duration: 3000
                });
            }
        }
    };

    // Example: Show success message when review is added
    const originalAddReviewForm = document.getElementById('add-review-form');
    if (originalAddReviewForm) {
        originalAddReviewForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reviewName = document.getElementById('review-name').value.trim();
            const reviewText = document.getElementById('review-text').value.trim();
            
            if (!reviewText) {
                if (window.modalSystem) {
                    window.modalSystem.showToast({
                        title: 'Hata',
                        message: 'Lütfen yorumunuzu yazın.',
                        type: 'error',
                        duration: 3000
                    });
                } else {
                    alert('Lütfen yorumunuzu yazın.');
                }
                return;
            }
            
            // Create review object
            const review = {
                author: reviewName || 'Anonim',
                text: reviewText,
                date: new Date().toLocaleDateString('tr-TR')
            };
            
            // Add review to current app (this would normally be saved to server)
            console.log('Yeni yorum:', review);
            
            if (window.modalSystem) {
                window.modalSystem.showToast({
                    title: 'Başarılı',
                    message: 'Yorumunuz eklendi! (Demo modunda sadece konsola kaydedildi)',
                    type: 'success',
                    duration: 3000
                });
            } else {
                alert('Yorumunuz eklendi! (Demo modunda sadece konsola kaydedildi)');
            }
            
            // Clear form
            originalAddReviewForm.reset();
        });
    }

    let currentImageIndex = 0;
    let currentAppImages = [];
    let fullDescription = '';
    let isDescriptionExpanded = false;

    function setupDescriptionSection(description) {
        console.log('setupDescriptionSection çağrıldı:', description);
        
        fullDescription = description;
        isDescriptionExpanded = false;
        
        const descriptionElement = document.getElementById('app-details-description');
        const showMoreBtn = document.getElementById('show-more-description');
        const showLessBtn = document.getElementById('show-less-description');
        
        console.log('Elementler bulundu:', {
            descriptionElement: !!descriptionElement,
            showMoreBtn: !!showMoreBtn,
            showLessBtn: !!showLessBtn
        });
        
        // Basit test - 200 karakterden uzunsa böl
        if (description.length > 200) {
            // İlk 200 karakteri göster
            const shortDescription = description.substring(0, 200) + '...';
            descriptionElement.textContent = shortDescription;
            showMoreBtn.style.display = 'inline-flex';
            showLessBtn.style.display = 'none';
            console.log('Uzun açıklama - buton gösterildi');
        } else {
            // Kısa açıklama
            descriptionElement.textContent = description;
            showMoreBtn.style.display = 'none';
            showLessBtn.style.display = 'none';
            console.log('Kısa açıklama - buton gizlendi');
        }
    }

    function openAppDetailsModal(app) {
        // Önceki görselleri temizle
        currentAppImages = [];
        currentImageIndex = 0;
        
        document.getElementById('app-details-image').src = app.previewImage || app.image || '';
        document.getElementById('app-details-name').textContent = app.name;
        document.getElementById('app-details-category').textContent = app.category;
        document.getElementById('app-details-download-btn').href = app.downloadUrl || '#';
        
        document.getElementById('app-details-version').textContent = `Sürüm: ${app.version}`;
        document.getElementById('app-details-size').textContent = `Boyut: ${app.fileSize}`;

        // Açıklama bölümünü ayarla
        setupDescriptionSection(app.description || 'Açıklama bulunmuyor.');

        const websiteBtn = document.getElementById('app-details-website-btn');
        if (app.website) {
            websiteBtn.href = app.website;
            websiteBtn.style.display = 'block';
        } else {
            websiteBtn.style.display = 'none';
        }

        const featuresList = document.getElementById('app-details-features');
        featuresList.innerHTML = '';
        if (app.features && app.features.length > 0) {
            app.features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                featuresList.appendChild(li);
            });
        } else {
            featuresList.innerHTML = '<li>Güncelleme notları bulunmuyor.</li>';
        }

        const installationList = document.getElementById('app-details-installation');
        installationList.innerHTML = '';
        if (app.installation && app.installation.length > 0) {
            app.installation.forEach(step => {
                const li = document.createElement('li');
                li.textContent = step;
                installationList.appendChild(li);
            });
        } else {
            installationList.innerHTML = '<li>Kurulum bilgisi bulunmuyor.</li>';
        }

        const systemRequirementsList = document.getElementById('app-details-system-requirements');
        systemRequirementsList.innerHTML = '';
        if (app.systemRequirements && app.systemRequirements.length > 0) {
            app.systemRequirements.forEach(requirement => {
                const li = document.createElement('li');
                li.textContent = requirement;
                systemRequirementsList.appendChild(li);
            });
        } else {
            systemRequirementsList.innerHTML = '<li>Sistem gereksinimleri bulunmuyor.</li>';
        }

        const imageViewer = document.getElementById('image-viewer');
        if (app.internalImages && app.internalImages.length > 0) {
            currentAppImages = app.internalImages;
            currentImageIndex = 0;
            initializeImageViewer();
            imageViewer.style.display = 'block';
        } else {
            imageViewer.style.display = 'none';
        }

        const reviewsSection = document.getElementById('app-details-reviews');
        reviewsSection.innerHTML = '';
        if (app.reviews && app.reviews.length > 0) {
            app.reviews.forEach(review => {
                const reviewDiv = document.createElement('div');
                reviewDiv.className = 'review';
                reviewDiv.innerHTML = `
                    <div class="review-header">
                        <span class="review-author">${review.author}</span>
                    </div>
                    <p class="review-text">${review.text}</p>
                `;
                reviewsSection.appendChild(reviewDiv);
            });
        } else {
            reviewsSection.innerHTML = '<p class="no-reviews">Henüz yorum yapılmamış.</p>';
        }

        appDetailsModal.style.display = 'block';
    }

    function initializeImageViewer() {
        const viewerImage = document.getElementById('viewer-image');
        const indicatorsContainer = document.getElementById('viewer-indicators');
        
        // Duplikat görselleri kaldır
        const uniqueImages = [...new Set(currentAppImages)];
        currentAppImages = uniqueImages;
        
        viewerImage.src = currentAppImages[currentImageIndex];
        indicatorsContainer.innerHTML = '';
        currentAppImages.forEach((_, index) => {
            const indicator = document.createElement('div');
            indicator.className = `indicator ${index === currentImageIndex ? 'active' : ''}`;
            indicator.addEventListener('click', () => goToImage(index));
            indicatorsContainer.appendChild(indicator);
        });
    }

    function goToImage(index) {
        currentImageIndex = index;
        document.getElementById('viewer-image').src = currentAppImages[currentImageIndex];
        document.querySelectorAll('.indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === currentImageIndex);
        });
    }

    document.getElementById('prev-image').addEventListener('click', () => {
        currentImageIndex = (currentImageIndex - 1 + currentAppImages.length) % currentAppImages.length;
        goToImage(currentImageIndex);
    });

    document.getElementById('next-image').addEventListener('click', () => {
        currentImageIndex = (currentImageIndex + 1) % currentAppImages.length;
        goToImage(currentImageIndex);
    });

    // Review form functionality
    const addReviewForm = document.getElementById('add-review-form');
    if (addReviewForm) {
        addReviewForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reviewName = document.getElementById('review-name').value.trim();
            const reviewText = document.getElementById('review-text').value.trim();
            
            if (!reviewText) {
                alert('Lütfen yorumunuzu yazın.');
                return;
            }
            
            // Create review object
            const review = {
                author: reviewName || 'Anonim',
                text: reviewText,
                date: new Date().toLocaleDateString('tr-TR')
            };
            
            // Add review to current app (this would normally be saved to server)
            console.log('Yeni yorum:', review);
            alert('Yorumunuz eklendi! (Demo modunda sadece konsola kaydedildi)');
            
            // Clear form
            addReviewForm.reset();
        });
    }


    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.body.classList.add(currentTheme);
    
        if (currentTheme === 'dark-mode') {
            toggleSwitch.checked = true;
        }
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

    toggleSwitch.addEventListener('change', switchTheme, false);

    // Açıklama genişletme butonları
    const showMoreBtn = document.getElementById('show-more-description');
    const showLessBtn = document.getElementById('show-less-description');
    
    console.log('Butonlar bulundu:', {
        showMoreBtn: !!showMoreBtn,
        showLessBtn: !!showLessBtn
    });
    
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            console.log('Daha Fazla butonuna tıklandı');
            const descriptionElement = document.getElementById('app-details-description');
            
            descriptionElement.textContent = fullDescription;
            showMoreBtn.style.display = 'none';
            showLessBtn.style.display = 'inline-flex';
            isDescriptionExpanded = true;
            console.log('Tam açıklama gösterildi');
        });
    }
    
    if (showLessBtn) {
        showLessBtn.addEventListener('click', () => {
            console.log('Daha Az butonuna tıklandı');
            const descriptionElement = document.getElementById('app-details-description');
            
            // Basit - ilk 200 karakteri göster
            const shortDescription = fullDescription.substring(0, 200) + '...';
            
            descriptionElement.textContent = shortDescription;
            showMoreBtn.style.display = 'inline-flex';
            showLessBtn.style.display = 'none';
            isDescriptionExpanded = false;
            console.log('Kısa açıklama gösterildi');
        });
    }

    // Kategori tıklama fonksiyonu
    const categoryElement = document.getElementById('app-details-category');
    if (categoryElement) {
        categoryElement.addEventListener('click', () => {
            const category = categoryElement.textContent;
            console.log('Kategori tıklandı:', category);
            
            // Önce modal'ı kapat
            const appDetailsModal = document.getElementById('app-details-modal');
            if (appDetailsModal) {
                appDetailsModal.style.display = 'none';
            }
            
            // Kategori seçimini güncelle (categoryList üzerinden)
            const categoryLinks = categoryList.querySelectorAll('a');
            let foundLink = null;
            
            // Kategori linkini bul
            for (const link of categoryLinks) {
                if (link.dataset.category === category || link.textContent.trim() === category) {
                    foundLink = link;
                    break;
                }
            }
            
            if (foundLink) {
                // Aktif kategoriyi güncelle
                categoryList.querySelectorAll('a').forEach(l => l.classList.remove('active'));
                foundLink.classList.add('active');
                
                // Kategori değişkenini güncelle
                currentCategory = foundLink.dataset.category || category;
                
                // Arama fonksiyonunu çağır
                handleNewSearch();
                
                // Sayfanın üstüne scroll et
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                console.log('Kategoriye yönlendirildi:', currentCategory);
            } else {
                console.log('Kategori linki bulunamadı:', category);
            }
        });
    }
    
    // Listen for download link updates from admin panel
    window.addEventListener('downloadLinkUpdated', (event) => {
        const { appName, newDownloadUrl } = event.detail;
        updateMainPageDownloadLink(appName, newDownloadUrl);
    });
    
    function updateMainPageDownloadLink(appName, newDownloadUrl) {
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
});

// Logo click functionality
const logoLink = document.getElementById('logo-link');
if (logoLink) {
    logoLink.addEventListener('click', function(e) {
        e.preventDefault();
        // Ana sayfaya scroll et
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        // Eğer uygulama detay modalı açıksa kapat
        const appDetailsModal = document.getElementById('app-details-modal');
        if (appDetailsModal && appDetailsModal.style.display !== 'none') {
            appDetailsModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        // Arama çubuğunu temizle
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
        
        // Kategorileri sıfırla
        const categorySelect = document.getElementById('category-filter');
        if (categorySelect) {
            categorySelect.value = 'all';
            categorySelect.dispatchEvent(new Event('change'));
        }
    });
}