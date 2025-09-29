// Netlify Function for categories API
exports.handler = async (event, context) => {
    // Mock categories data
    const mockCategories = {
        hierarchy: {
            "Oyunlar": {
                subcategories: [
                    "Aksiyon", "Macera", "Masa Oyunları", "Kart Oyunları", 
                    "Kumarhane Oyunları", "Basit Eğlence", "Aile", "Müzik Oyunları",
                    "Bulmaca", "Yarış", "Rol Yapma", "Simülasyon", "Spor Oyunları",
                    "Strateji", "Bilgi Yarışması", "Kelime Oyunları"
                ]
            },
            "Programlar": {
                subcategories: [
                    "İş", "Geliştirici Araçları", "Eğitim", "Eğlence", "Finans",
                    "Grafik ve Tasarım", "Sağlık ve Fitness", "Yaşam Tarzı", "Tıp",
                    "Müzik", "Haberler", "Fotoğraf ve Video", "Verimlilik", "Referans",
                    "Alışveriş", "Sosyal Ağ", "Spor", "Seyahat", "Yardımcı Programlar",
                    "Hava Durumu"
                ]
            }
        },
        existing: [
            "Fotoğraf ve Video", 
            "Grafik ve Tasarım", 
            "Müzik",
            "Geliştirici Araçları",
            "İş",
            "Eğitim",
            "Sağlık ve Fitness",
            "Yaşam Tarzı",
            "Verimlilik",
            "Haberler"
        ]
    };
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify(mockCategories)
    };
};
