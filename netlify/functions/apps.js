// Netlify Function for apps API
exports.handler = async (event, context) => {
    // Mock apps data
    const mockApps = [
        {
            name: "DaVinci Resolve Studio",
            category: "Fotoğraf ve Video",
            version: "18.5",
            fileSize: "5.1 GB",
            image: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a0/e6/09/a0e60971-0d09-de64-ebe7-4c8b113e5bcc/Resolve.png/1200x630bb.png",
            description: "Profesyonel video düzenleme yazılımı. Hollywood kalitesinde post-production araçları sunar.",
            downloadUrl: "https://www.blackmagicdesign.com/products/davinciresolve",
            badgeType: "new",
            features: [
                "8K video desteği",
                "Gelişmiş renk düzeltme",
                "Ses düzenleme araçları",
                "VFX ve motion graphics"
            ],
            installation: [
                "Dosyayı indirin",
                "DMG dosyasını açın",
                "Uygulamayı Applications klasörüne sürükleyin",
                "Launchpad'den çalıştırın"
            ],
            systemRequirements: [
                "macOS 11.0 veya üzeri",
                "8GB RAM (16GB önerilen)",
                "4GB boş disk alanı",
                "Metal uyumlu grafik kartı"
            ]
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
            features: [
                "IntelliSense kod tamamlama",
                "Hata ayıklama desteği",
                "Git entegrasyonu",
                "Genişletilebilir eklenti sistemi"
            ],
            installation: [
                "VS Code'u indirin",
                "DMG dosyasını açın",
                "Uygulamayı Applications klasörüne sürükleyin",
                "İlk açılışta eklentileri yapılandırın"
            ],
            systemRequirements: [
                "macOS 10.15 veya üzeri",
                "2GB RAM",
                "200MB boş disk alanı",
                "İnternet bağlantısı (eklentiler için)"
            ]
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
            features: [
                "Vektör tabanlı çizim araçları",
                "Prototipleme desteği",
                "Eklenti ekosistemi",
                "Takım çalışması araçları"
            ],
            installation: [
                "Sketch'i indirin",
                "DMG dosyasını açın",
                "Uygulamayı kurun",
                "Lisans anahtarınızı girin"
            ],
            systemRequirements: [
                "macOS 11.0 veya üzeri",
                "4GB RAM",
                "500MB boş disk alanı",
                "Retina ekran önerilen"
            ]
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
            features: [
                "Profesyonel kayıt araçları",
                "3000+ ses ve loop",
                "MIDI düzenleme",
                "Gelişmiş miksaj konsolu"
            ],
            installation: [
                "Mac App Store'dan indirin",
                "Apple ID ile giriş yapın",
                "İndirme tamamlandıktan sonra açın",
                "İlk kurulum sihirbazını takip edin"
            ],
            systemRequirements: [
                "macOS 12.3 veya üzeri",
                "8GB RAM (16GB önerilen)",
                "6GB boş disk alanı",
                "Audio interface önerilen"
            ]
        }
    ];
    
    const page = parseInt(event.queryStringParameters?.page) || 1;
    const limit = parseInt(event.queryStringParameters?.limit) || 20;
    const search = event.queryStringParameters?.search || '';
    const category = event.queryStringParameters?.category || '';
    const sort = event.queryStringParameters?.sort || 'default';
    
    let filteredApps = [...mockApps];
    
    // Search filter
    if (search) {
        filteredApps = filteredApps.filter(app => 
            app.name.toLowerCase().includes(search.toLowerCase()) ||
            app.description.toLowerCase().includes(search.toLowerCase()) ||
            app.category.toLowerCase().includes(search.toLowerCase())
        );
    }
    
    // Category filter
    if (category && category !== 'Tümü') {
        filteredApps = filteredApps.filter(app => app.category === category);
    }
    
    // Sort
    if (sort === 'name-asc') {
        filteredApps.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'name-desc') {
        filteredApps.sort((a, b) => b.name.localeCompare(a.name));
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedApps = filteredApps.slice(startIndex, endIndex);
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
            apps: paginatedApps,
            currentPage: page,
            totalPages: Math.ceil(filteredApps.length / limit),
            totalApps: filteredApps.length
        })
    };
};
