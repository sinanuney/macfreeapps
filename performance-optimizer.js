// MacFreeApps Performance Optimizer
class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.imageCache = new Map();
        this.apiCache = new Map();
        this.rateLimiter = new Map();
        this.maxRequestsPerMinute = 60;
        this.cacheExpiry = 5 * 60 * 1000; // 5 dakika
    }

    // 1. CSS ve JS Minification
    minifyCSS(css) {
        return css
            .replace(/\/\*[\s\S]*?\*\//g, '') // Yorumları kaldır
            .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa çevir
            .replace(/;\s*}/g, '}') // Son noktalı virgülleri kaldır
            .replace(/\s*{\s*/g, '{') // Süslü parantezlerdeki boşlukları kaldır
            .replace(/;\s*/g, ';') // Noktalı virgül sonrası boşlukları kaldır
            .replace(/,\s*/g, ',') // Virgül sonrası boşlukları kaldır
            .replace(/:\s*/g, ':') // İki nokta sonrası boşlukları kaldır
            .trim();
    }

    minifyJS(js) {
        return js
            .replace(/\/\*[\s\S]*?\*\//g, '') // Blok yorumları kaldır
            .replace(/\/\/.*$/gm, '') // Satır yorumlarını kaldır
            .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa çevir
            .replace(/;\s*}/g, '}') // Son noktalı virgülleri kaldır
            .replace(/\s*{\s*/g, '{') // Süslü parantezlerdeki boşlukları kaldır
            .replace(/;\s*/g, ';') // Noktalı virgül sonrası boşlukları kaldır
            .replace(/,\s*/g, ',') // Virgül sonrası boşlukları kaldır
            .replace(/:\s*/g, ':') // İki nokta sonrası boşlukları kaldır
            .trim();
    }

    // 2. Image Optimization
    optimizeImage(imageUrl, options = {}) {
        const cacheKey = `${imageUrl}_${JSON.stringify(options)}`;
        
        if (this.imageCache.has(cacheKey)) {
            return this.imageCache.get(cacheKey);
        }

        const optimizedUrl = this.createOptimizedImageUrl(imageUrl, options);
        this.imageCache.set(cacheKey, optimizedUrl);
        
        return optimizedUrl;
    }

    createOptimizedImageUrl(imageUrl, options) {
        const { width, height, quality = 80, format = 'webp' } = options;
        
        // Eğer Cloudflare Images kullanıyorsak
        if (imageUrl.includes('cloudflare.com')) {
            const params = new URLSearchParams();
            if (width) params.append('width', width);
            if (height) params.append('height', height);
            if (quality) params.append('quality', quality);
            if (format) params.append('format', format);
            
            return `${imageUrl}?${params.toString()}`;
        }

        // Eğer normal URL ise, boyut parametreleri ekle
        const url = new URL(imageUrl);
        if (width) url.searchParams.set('w', width);
        if (height) url.searchParams.set('h', height);
        if (quality) url.searchParams.set('q', quality);
        
        return url.toString();
    }

    // 3. Lazy Loading
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
    }

    // 4. API Caching
    async cachedFetch(url, options = {}) {
        const cacheKey = `${url}_${JSON.stringify(options)}`;
        const now = Date.now();
        
        // Cache'den kontrol et
        if (this.apiCache.has(cacheKey)) {
            const cached = this.apiCache.get(cacheKey);
            if (now - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        // Rate limiting kontrolü
        if (!this.checkRateLimit(url)) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            // Cache'e kaydet
            this.apiCache.set(cacheKey, {
                data: data,
                timestamp: now
            });
            
            return data;
        } catch (error) {
            console.error('API fetch error:', error);
            throw error;
        }
    }

    // 5. Rate Limiting
    checkRateLimit(identifier) {
        const now = Date.now();
        const minute = Math.floor(now / 60000);
        const key = `${identifier}_${minute}`;
        
        if (!this.rateLimiter.has(key)) {
            this.rateLimiter.set(key, 0);
        }
        
        const currentCount = this.rateLimiter.get(key);
        
        if (currentCount >= this.maxRequestsPerMinute) {
            return false;
        }
        
        this.rateLimiter.set(key, currentCount + 1);
        return true;
    }

    // 6. Resource Preloading
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

    // 7. Service Worker Registration
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    // 8. Performance Monitoring
    initPerformanceMonitoring() {
        // Core Web Vitals
        if ('web-vital' in window) {
            import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
                getCLS(console.log);
                getFID(console.log);
                getFCP(console.log);
                getLCP(console.log);
                getTTFB(console.log);
            });
        }

        // Custom performance metrics
        window.addEventListener('load', () => {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('Page Load Time:', perfData.loadEventEnd - perfData.loadEventStart);
            console.log('DOM Content Loaded:', perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart);
        });
    }

    // 9. Bundle Splitting
    async loadScript(src, defer = false) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = defer;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 10. Critical CSS Inlining
    inlineCriticalCSS() {
        const criticalCSS = `
            /* Critical CSS - Above the fold content */
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .header { background: #007bff; color: white; padding: 1rem; }
            .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
            .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
            .app-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
        `;

        const style = document.createElement('style');
        style.textContent = criticalCSS;
        document.head.insertBefore(style, document.head.firstChild);
    }

    // 11. Database Query Optimization
    optimizeQueries() {
        // Index önerileri
        const indexSuggestions = [
            'CREATE INDEX idx_apps_category ON apps(category)',
            'CREATE INDEX idx_apps_featured ON apps(featured)',
            'CREATE INDEX idx_apps_created_at ON apps(created_at)',
            'CREATE INDEX idx_apps_name ON apps(name)'
        ];

        console.log('Database optimization suggestions:', indexSuggestions);
        return indexSuggestions;
    }

    // 12. Memory Management
    cleanupMemory() {
        // Eski cache'leri temizle
        const now = Date.now();
        for (const [key, value] of this.apiCache.entries()) {
            if (now - value.timestamp > this.cacheExpiry) {
                this.apiCache.delete(key);
            }
        }

        // Rate limiter'ı temizle
        const currentMinute = Math.floor(now / 60000);
        for (const [key] of this.rateLimiter.entries()) {
            const keyMinute = parseInt(key.split('_').pop());
            if (currentMinute - keyMinute > 1) {
                this.rateLimiter.delete(key);
            }
        }
    }

    // 13. CDN Configuration
    getCDNConfig() {
        return {
            cloudflare: {
                enabled: true,
                zones: ['macfreeapps.com'],
                settings: {
                    cache_level: 'aggressive',
                    browser_cache_ttl: 31536000, // 1 yıl
                    edge_cache_ttl: 86400, // 1 gün
                    minify: {
                        css: true,
                        js: true,
                        html: true
                    },
                    compression: 'brotli'
                }
            },
            aws: {
                enabled: false,
                bucket: 'macfreeapps-assets',
                region: 'us-east-1',
                cloudfront: {
                    distribution_id: 'E1234567890ABC',
                    price_class: 'PriceClass_100'
                }
            }
        };
    }

    // 14. Compression
    async compressResponse(data) {
        if (typeof data === 'string') {
            // Gzip compression simulation
            return btoa(data);
        }
        return data;
    }

    // 15. Initialize All Optimizations
    async init() {
        console.log('🚀 Initializing Performance Optimizer...');
        
        // Critical CSS'i inline et
        this.inlineCriticalCSS();
        
        // Resource preloading
        this.preloadResources();
        
        // Lazy loading
        this.initLazyLoading();
        
        // Service Worker
        await this.registerServiceWorker();
        
        // Performance monitoring
        this.initPerformanceMonitoring();
        
        // Memory cleanup interval
        setInterval(() => this.cleanupMemory(), 60000); // Her dakika
        
        console.log('✅ Performance Optimizer initialized');
    }
}

// Global instance
window.performanceOptimizer = new PerformanceOptimizer();

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.performanceOptimizer.init();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
