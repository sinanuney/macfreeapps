# MacFreeApps - Ücretsiz Mac Uygulamaları

Modern ve kullanıcı dostu Mac uygulama keşif platformu.

## 🚀 Özellikler

- 📱 Responsive tasarım
- 🔍 Gelişmiş arama sistemi
- 🌙 Dark/Light mode
- ⭐ Favori sistemi
- 📊 Admin paneli
- 🤖 AI destekli özellikler
- 📈 Performans dashboard
- 🔔 Modal/Popup sistemi

## 🛠️ Teknolojiler

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Python Flask
- **Database**: JSON dosya tabanlı
- **Styling**: CSS Grid, Flexbox, Custom Properties
- **Icons**: Font Awesome
- **Fonts**: Poppins, SF Pro Display

## 📁 Proje Yapısı

```
├── index.html              # Ana sayfa
├── admin.html              # Admin paneli
├── ml-seo-trainer.html     # AI eğitici
├── performance-dashboard.html # Performans dashboard
├── modal-examples.html     # Modal örnekleri
├── style.css              # Ana stil dosyası
├── script.js              # Ana JavaScript
├── admin.js               # Admin panel JavaScript
├── modal-system.js        # Modal sistemi
├── performance-optimizer.js # Performans optimizasyonu
├── server.py              # Flask backend
├── apps.json              # Uygulama veritabanı
└── requirements.txt       # Python bağımlılıkları
```

## 🚀 Kurulum

### Gereksinimler
- Python 3.7+
- Modern web tarayıcısı

### Adımlar

1. **Repository'yi klonlayın**
```bash
git clone https://github.com/kullaniciadi/macfreeapps.git
cd macfreeapps
```

2. **Python bağımlılıklarını yükleyin**
```bash
pip install -r requirements.txt
```

3. **Sunucuyu başlatın**
```bash
python server.py
```

4. **Tarayıcıda açın**
```
http://localhost:5001
```

## 📱 Kullanım

### Ana Sayfa
- Uygulamaları arayın ve keşfedin
- Kategorilere göre filtreleyin
- Favorilere ekleyin
- Dark/Light mode kullanın

### Admin Paneli
- Yeni uygulama ekleyin
- Mevcut uygulamaları düzenleyin
- İçerik moderasyonu yapın
- Analitik raporları görüntüleyin

## 🔧 Geliştirme

### Yeni Özellik Ekleme
1. Feature branch oluşturun
2. Değişikliklerinizi yapın
3. Test edin
4. Pull request oluşturun

### Stil Değişiklikleri
- `style.css` dosyasını düzenleyin
- CSS custom properties kullanın
- Responsive tasarımı koruyun

## 📊 API Endpoints

```
GET  /api/apps              # Tüm uygulamalar
GET  /api/categories        # Kategoriler
GET  /api/featured-apps     # Öne çıkan uygulamalar
POST /api/add-app           # Yeni uygulama ekle
PUT  /api/update-app        # Uygulama güncelle
DELETE /api/delete-app      # Uygulama sil
```

## 🌐 Deployment

### GitHub Pages
1. Repository'yi public yapın
2. Settings > Pages bölümüne gidin
3. Source: Deploy from a branch seçin
4. Branch: main seçin
5. Save'e tıklayın

### Netlify
1. [Netlify](https://netlify.com)'e gidin
2. "New site from Git" seçin
3. Repository'nizi bağlayın
4. Build settings: `python server.py`
5. Deploy edin

### Vercel
1. [Vercel](https://vercel.com)'e gidin
2. "Import Project" seçin
3. Repository'nizi bağlayın
4. Framework: Other seçin
5. Deploy edin

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 İletişim

- Website: [macfreeapps.com](https://macfreeapps.com)
- Email: info@macfreeapps.com
- Twitter: [@macfreeapps](https://twitter.com/macfreeapps)

## 🙏 Teşekkürler

- [Font Awesome](https://fontawesome.com) - İkonlar
- [Google Fonts](https://fonts.google.com) - Fontlar
- [Flask](https://flask.palletsprojects.com) - Backend framework
