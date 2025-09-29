from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
from math import ceil
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re
import time
import random

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Kategori hiyerarşisi - App Store kategorileri
CATEGORY_HIERARCHY = {
    "Oyunlar": {
        "name": "Oyunlar",
        "subcategories": [
            "Aksiyon", "Macera", "Masa Oyunları", "Kart Oyunları", 
            "Kumarhane Oyunları", "Basit Eğlence", "Aile", "Müzik Oyunları",
            "Bulmaca", "Yarış", "Rol Yapma", "Simülasyon", "Spor Oyunları",
            "Strateji", "Bilgi Yarışması", "Kelime Oyunları"
        ]
    },
    "Programlar": {
        "name": "Programlar",
        "subcategories": [
            "İş", "Geliştirici Araçları", "Eğitim", "Eğlence", "Finans",
            "Grafik ve Tasarım", "Sağlık ve Fitness", "Yaşam Tarzı", "Tıp",
            "Müzik", "Haberler", "Fotoğraf ve Video", "Verimlilik", "Referans",
            "Alışveriş", "Sosyal Ağ", "Spor", "Seyahat", "Yardımcı Programlar",
            "Hava Durumu"
        ]
    }
}

# Tüm kategorileri düz liste halinde al
def get_all_categories():
    all_categories = ["Kategorisiz"]
    for main_cat, data in CATEGORY_HIERARCHY.items():
        all_categories.append(main_cat)
        all_categories.extend(data["subcategories"])
    return all_categories

APPS_FILE = 'apps.json'

def load_apps():
    """apps.json dosyasından uygulamaları yükler."""
    if not os.path.exists(APPS_FILE):
        return []
    try:
        with open(APPS_FILE, 'r', encoding='utf-8') as f:
            # Dosyanın boş olup olmadığını kontrol et
            content = f.read()
            if not content:
                return []
            return json.loads(content)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def save_apps(apps):
    """Uygulama listesini apps.json dosyasına kaydeder."""
    with open(APPS_FILE, 'w', encoding='utf-8') as f:
        json.dump(apps, f, indent=4, ensure_ascii=False)

def find_by_keyword(soup, keywords, tag_name='div'):
    """Belirli anahtar kelimeleri içeren metinleri arar."""
    for keyword in keywords:
        try:
            element = soup.find(lambda tag: tag.name == tag_name and keyword in tag.get_text(strip=True).lower())
            if element:
                parent_text = element.get_text(separator=' ', strip=True)
                match = re.search(fr'{re.escape(keyword)}[\s:]*([\d.v\sA-Z]+[a-zA-Z]?)?', parent_text, re.IGNORECASE)
                if match and match.group(1):
                    return match.group(1).strip()
        except Exception:
            continue
    return None

def get_highest_res_from_srcset(srcset):
    """srcset içindeki en yüksek çözünürlüklü görseli bulur."""
    if not srcset:
        return None
    
    highest_res = 0
    best_url = ''
    
    candidates = srcset.split(',')
    for candidate in candidates:
        parts = candidate.strip().split()
        if len(parts) != 2:
            continue
            
        url = parts[0]
        descriptor = parts[1]
        
        if descriptor.endswith('w'):
            res = int(descriptor[:-1])
            if res > highest_res:
                highest_res = res
                best_url = url
    
    # Eğer hiç 'w' tanımlayıcı bulunamazsa, ilk URL'yi al
    if not best_url and candidates:
        best_url = candidates[0].strip().split()[0]
        
    return best_url

def make_request_with_retry(url, max_retries=3, base_delay=2):
    """Rate limiting ile karşılaştığında retry yapan request fonksiyonu"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    for attempt in range(max_retries):
        try:
            # Random delay ekle (1-3 saniye arası)
            if attempt > 0:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
                print(f"Retry {attempt + 1}/{max_retries} - {delay:.1f} saniye bekleniyor...")
                time.sleep(delay)
            
            response = requests.get(url, headers=headers, timeout=30)
            
            # 429 hatası için özel kontrol
            if response.status_code == 429:
                if attempt < max_retries - 1:
                    print(f"Rate limit (429) - {base_delay * (2 ** (attempt + 1))} saniye bekleniyor...")
                    continue
                else:
                    raise requests.exceptions.HTTPError(f"429 Client Error: Too Many Requests - {max_retries} deneme sonrası başarısız")
            
            # Diğer HTTP hataları
            response.raise_for_status()
            return response
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise e
            print(f"Request hatası (deneme {attempt + 1}/{max_retries}): {e}")
            continue
    
    raise requests.exceptions.RequestException(f"Tüm denemeler başarısız oldu")

@app.route('/api/scrape-url', methods=['POST'])
def scrape_url():
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        print(f"URL scraping başlatılıyor: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        }
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Response status: {response.status_code}")
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # --- Temel Bilgiler ---
        title = soup.find('title').get_text(strip=True) if soup.find('title') else None
        description_meta = soup.find('meta', attrs={'name': 'description'})
        og_description = soup.find('meta', property='og:description')
        og_title = soup.find('meta', property='og:title')
        og_image = soup.find('meta', property='og:image')
        icon_link = soup.find('link', rel='icon') or soup.find('link', rel='shortcut icon')

        app_name = og_title['content'] if og_title and og_title.get('content') else title
        
        # --- Gelişmiş Açıklama Çekme ---
        app_description = None
        
        # App Store için özel açıklama çekme
        if 'itunes.apple.com' in url:
            print("App Store açıklaması aranıyor...")
            
            # 1. Önce section elementini ara (en detaylı açıklama)
            description_section = soup.find('section', attrs={'data-test': 'product-description'})
            if description_section:
                # section içindeki tüm paragrafları al
                paragraphs = description_section.find_all('p')
                if paragraphs:
                    description_texts = []
                    for p in paragraphs:
                        text = p.get_text(strip=True)
                        if text and len(text) > 10:  # Çok kısa metinleri filtrele
                            description_texts.append(text)
                    if description_texts:
                        app_description = '\n\n'.join(description_texts)
                        print(f"Section açıklaması bulundu: {len(app_description)} karakter")
            
            # 1.5. Eğer section bulunamadıysa, div class="l-column" ara (App Store yeni yapısı)
            if not app_description:
                l_columns = soup.find_all('div', class_='l-column')
                for column in l_columns:
                    paragraphs = column.find_all('p')
                    if paragraphs:
                        description_texts = []
                        for p in paragraphs:
                            text = p.get_text(strip=True)
                            if text and len(text) > 20:  # Daha uzun metinleri al
                                description_texts.append(text)
                        if description_texts and len('\n\n'.join(description_texts)) > 100:
                            app_description = '\n\n'.join(description_texts)
                            print(f"L-column açıklaması bulundu: {len(app_description)} karakter")
                            break
            
            # 2. Eğer section bulunamadıysa, div class="we-truncate" ara
            if not app_description:
                truncate_div = soup.find('div', class_='we-truncate')
                if truncate_div:
                    # we-truncate içindeki tüm paragrafları al
                    paragraphs = truncate_div.find_all('p')
                    if paragraphs:
                        description_texts = []
                        for p in paragraphs:
                            text = p.get_text(strip=True)
                            if text and len(text) > 10:
                                description_texts.append(text)
                        if description_texts:
                            app_description = '\n\n'.join(description_texts)
                            print(f"Truncate açıklaması bulundu: {len(app_description)} karakter")
            
            # 3. Eğer hala bulunamadıysa, genel paragraf arama
            if not app_description:
                # Uzun paragrafları ara
                all_paragraphs = soup.find_all('p')
                long_paragraphs = []
                for p in all_paragraphs:
                    text = p.get_text(strip=True)
                    if text and len(text) > 50:  # En az 50 karakter
                        long_paragraphs.append(text)
                
                if long_paragraphs:
                    # En uzun paragrafı seç
                    app_description = max(long_paragraphs, key=len)
                    print(f"Genel paragraf açıklaması bulundu: {len(app_description)} karakter")
            
            # 4. App Store için özel meta description ara
            if not app_description:
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                if meta_desc and meta_desc.get('content'):
                    app_description = meta_desc['content']
                    print(f"Meta description açıklaması bulundu: {len(app_description)} karakter")
        
        # Diğer siteler için gelişmiş açıklama çekme
        if not app_description:
            print("Genel site açıklaması aranıyor...")
            
            # 1. Uzun paragrafları ara
            all_paragraphs = soup.find_all('p')
            long_paragraphs = []
            for p in all_paragraphs:
                text = p.get_text(strip=True)
                if text and len(text) > 100:  # En az 100 karakter
                    long_paragraphs.append(text)
            
            if long_paragraphs:
                # En uzun paragrafı seç
                app_description = max(long_paragraphs, key=len)
                print(f"Uzun paragraf açıklaması bulundu: {len(app_description)} karakter")
            
            # 2. Eğer hala bulunamadıysa, div class'larını ara
            if not app_description:
                description_divs = soup.find_all('div', class_=lambda x: x and any(keyword in x.lower() for keyword in ['description', 'content', 'about', 'summary']))
                for div in description_divs:
                    text = div.get_text(strip=True)
                    if text and len(text) > 50:
                        app_description = text
                        print(f"Div açıklaması bulundu: {len(app_description)} karakter")
                        break
            
            # 3. Son fallback - meta tag'ler
            if not app_description:
                app_description = (og_description['content'] if og_description and og_description.get('content')
                                   else description_meta['content'] if description_meta and description_meta.get('content') else None)
                if app_description:
                    print(f"Meta tag açıklaması bulundu: {len(app_description)} karakter")
        
        # Açıklamayı temizle ve optimize et
        if app_description:
            # Sadece fazla boşlukları temizle, satır sonlarını koru
            import re
            app_description = re.sub(r'\s+', ' ', app_description)  # Çoklu boşlukları tek boşluğa çevir
            app_description = app_description.strip()  # Başta ve sonda boşlukları temizle
            
            # Çok kısa açıklamaları filtrele
            if len(app_description) < 20:
                app_description = None
                print("Açıklama çok kısa, atlandı")
            else:
                # Maksimum uzunluk sınırı (çok uzun açıklamaları kırp)
                if len(app_description) > 10000:  # 2000'den 10000'e çıkarıldı
                    app_description = app_description[:10000] + "..."
                    print("Açıklama 10000 karakter ile sınırlandırıldı")
        
        print(f"App Name: {app_name}")
        print(f"App Description Length: {len(app_description) if app_description else 0} karakter")
        if app_description:
            print(f"Description Preview: {app_description[:200]}...")
        
        image_url = og_image['content'] if og_image and og_image.get('content') else None
        if not image_url and icon_link and icon_link.get('href'):
            image_url = urljoin(url, icon_link['href'])

        # --- Sürüm ve Dosya Boyutu ---
        app_version = None
        
        # App Store için spesifik sürüm tespiti
        # whats-new__latest__version class'ından al
        version_element = soup.find('p', class_='l-column small-6 medium-12 whats-new__latest__version')
        if version_element:
            app_version = version_element.get_text(strip=True)
            print(f"App Store sürüm bulundu: {app_version}")
        else:
            # Fallback - genel sürüm arama
            version_keywords = ['version', 'sürüm', 'current version', 'v.', 'ver.']
            app_version = find_by_keyword(soup, version_keywords, 'div') or find_by_keyword(soup, version_keywords, 'span')
            print(f"Genel sürüm arama sonucu: {app_version}")
        
        # App Store için spesifik boyut tespiti
        app_file_size = None
        size_element = soup.find('dd', class_='information-list__item__definition', attrs={'aria-label': True})
        if size_element:
            aria_label = size_element.get('aria-label', '').lower()
            if 'megabyte' in aria_label or 'gigabyte' in aria_label:
                app_file_size = size_element.get_text(strip=True)
        
        # Eğer App Store formatında bulunamadıysa, genel arama yap
        if not app_file_size:
            # Fallback - genel boyut arama
            size_keywords = ['size', 'boyut', 'file size', 'mb', 'gb', 'kb', 'megabyte', 'gigabyte']
            app_file_size = find_by_keyword(soup, size_keywords, 'div') or find_by_keyword(soup, size_keywords, 'span')
        
        # Sürüm formatını düzelt - sadece versiyon numarası
        if app_version:
            import re
            # "Sürüm" kelimesini kaldır
            app_version = re.sub(r'^sürüm\s*', '', app_version, flags=re.IGNORECASE).strip()
            version_match = re.search(r'(\d+(?:\.\d+)*)', app_version)
            if version_match:
                app_version = version_match.group(1)  # Sadece versiyon numarası
                print(f"Sürüm formatlandı: {app_version}")
            else:
                app_version = app_version  # Orijinal değeri koru
                print(f"Sürüm varsayılan format: {app_version}")
        else:
            app_version = '1.0'  # Varsayılan sürüm (sadece numara)

        # --- Kategori Tespiti ---
        app_category = 'Kategorisiz'
        
        # App Store için spesifik kategori tespiti
        print("Kategori aranıyor...")
        
        # 1. Önce kategori linkini ara
        category_link = soup.find('a', class_='link', href=lambda x: x and 'itunes.apple.com/tr/genre/' in x)
        if category_link:
            app_category = category_link.get_text(strip=True)
            print(f"Kategori linkinden bulundu: {app_category}")
        else:
            # 2. Fallback - dd elementini ara
            category_elements = soup.find_all('dd', class_='information-list__item__definition')
            for category_element in category_elements:
                category_link = category_element.find('a', class_='link')
                if category_link and 'itunes.apple.com/tr/genre/' in category_link.get('href', ''):
                    app_category = category_link.get_text(strip=True)
                    print(f"DD elementinden kategori linki bulundu: {app_category}")
                    break
                else:
                    # Eğer link yoksa, dd elementinin içindeki metni al
                    text = category_element.get_text(strip=True)
                    if text and len(text) > 3 and text != 'Kategorisiz':
                        app_category = text
                        print(f"DD elementinden metin bulundu: {app_category}")
                        break
        
        # 3. Kategori eşleştirmesi yap (App Store kategorilerini bizim kategorilerimize çevir)
        category_mapping = {
            'Üretkenlik': 'Verimlilik',
            'Productivity': 'Verimlilik',
            'Business': 'İş',
            'Developer Tools': 'Geliştirici Araçları',
            'Education': 'Eğitim',
            'Entertainment': 'Eğlence',
            'Finance': 'Finans',
            'Graphics & Design': 'Grafik ve Tasarım',
            'Health & Fitness': 'Sağlık ve Fitness',
            'Lifestyle': 'Yaşam Tarzı',
            'Medical': 'Tıp',
            'Music': 'Müzik',
            'News': 'Haberler',
            'Photo & Video': 'Fotoğraf ve Video',
            'Reference': 'Referans',
            'Shopping': 'Alışveriş',
            'Social Networking': 'Sosyal Ağ',
            'Sports': 'Spor',
            'Travel': 'Seyahat',
            'Utilities': 'Yardımcı Programlar',
            'Weather': 'Hava Durumu'
        }
        
        if app_category in category_mapping:
            app_category = category_mapping[app_category]
            print(f"Kategori eşleştirildi: {app_category}")
        
        # 4. Eğer hala bulunamadıysa, genel arama yap
        if app_category == 'Kategorisiz':
            # Fallback - genel kategori arama
            # "Kategori" kelimesinden sonraki metni bul
            def find_category_after_keyword(soup, keyword):
                # Regex ile daha esnek arama
                import re
                
                # Pattern 1: "Kategori" kelimesi ve sonrasındaki metin
                patterns = [
                    # <div>Kategori</div><div>Yardımcılar</div>
                    r'<div[^>]*>.*?' + re.escape(keyword) + r'.*?</div>\s*<div[^>]*>([^<]+)</div>',
                    # <span>Kategori</span><span>Yardımcılar</span>
                    r'<span[^>]*>.*?' + re.escape(keyword) + r'.*?</span>\s*<span[^>]*>([^<]+)</span>',
                    # <label>Kategori</label><div>Yardımcılar</div>
                    r'<label[^>]*>.*?' + re.escape(keyword) + r'.*?</label>\s*<div[^>]*>([^<]+)</div>',
                    # <strong>Kategori</strong><span>Yardımcılar</span>
                    r'<strong[^>]*>.*?' + re.escape(keyword) + r'.*?</strong>\s*<span[^>]*>([^<]+)</span>',
                    # <b>Kategori</b><div>Yardımcılar</div>
                    r'<b[^>]*>.*?' + re.escape(keyword) + r'.*?</b>\s*<div[^>]*>([^<]+)</div>',
                    # Aynı satırda: Kategori: Yardımcılar
                    r'<[^>]*>.*?' + re.escape(keyword) + r'[:\s]*([^<\n]+)',
                ]
                
                html_content = str(soup)
                for pattern in patterns:
                    try:
                        matches = re.findall(pattern, html_content, re.IGNORECASE | re.DOTALL)
                        for match in matches:
                            if match and match.strip() and match.strip().lower() != keyword.lower():
                                return match.strip()
                    except:
                        continue
                
                # HTML element arama (fallback)
                elements = soup.find_all(['div', 'span', 'label', 'strong', 'b', 'p', 'td', 'th'])
                for element in elements:
                    text = element.get_text(strip=True)
                    if keyword.lower() in text.lower():
                        # Kardeş elementleri kontrol et
                        for sibling in element.find_next_siblings():
                            sibling_text = sibling.get_text(strip=True)
                            if sibling_text and sibling_text.lower() != keyword.lower():
                                return sibling_text
                        
                        # Parent'ın kardeş elementlerini kontrol et
                        if element.parent:
                            for sibling in element.parent.find_next_siblings():
                                sibling_text = sibling.get_text(strip=True)
                                if sibling_text and sibling_text.lower() != keyword.lower():
                                    return sibling_text
                        
                        # Aynı parent içindeki diğer elementleri kontrol et
                        if element.parent:
                            for child in element.parent.find_all(['div', 'span', 'a', 'p', 'td', 'th']):
                                if child != element:
                                    child_text = child.get_text(strip=True)
                                    if child_text and child_text.lower() != keyword.lower():
                                        return child_text
                return None
            
            # Basit kategori tespiti - "Kategori" kelimesinden sonraki metin
            def find_simple_category(soup, keyword):
                # Tüm metni al ve "Kategori" kelimesini ara
                all_text = soup.get_text()
                lines = all_text.split('\n')
                
                for i, line in enumerate(lines):
                    if keyword.lower() in line.lower():
                        # Bu satırda "Kategori" var, sonraki satırlara bak
                        for j in range(i+1, min(i+3, len(lines))):  # Sonraki 2 satıra bak
                            next_line = lines[j].strip()
                            if next_line and next_line.lower() != keyword.lower():
                                return next_line
                return None
            
            # Türkçe "Kategori" kelimesi ile ara
            category_text = find_simple_category(soup, 'Kategori')
            if category_text:
                app_category = category_text
            else:
                # İngilizce "Category" kelimesi ile ara
                category_text = find_simple_category(soup, 'Category')
                if category_text:
                    app_category = category_text
                else:
                    # Gelişmiş arama
                    category_text = find_category_after_keyword(soup, 'Kategori')
                    if category_text:
                        app_category = category_text
                    else:
                        category_text = find_category_after_keyword(soup, 'Category')
                        if category_text:
                            app_category = category_text
                        else:
                            # App Store kategorileri (fallback)
                            category_element = soup.find('a', {'data-testid': 'category-link'}) or soup.find('a', class_='category-link')
                            if category_element:
                                app_category = category_element.get_text(strip=True)
                            
                            # Google Play kategorileri (fallback)
                            if not category_element:
                                category_element = soup.find('a', {'href': lambda x: x and '/store/apps/category/' in x})
                                if category_element:
                                    app_category = category_element.get_text(strip=True)

        # --- Ek Görseller (Screenshots) ---
        internal_images = []
        
        # App Store için spesifik picture elementlerinden görselleri al
        print("App Store picture elementleri aranıyor...")
        picture_elements = soup.find_all('picture', class_=lambda x: x and 'we-artwork' in x)
        print(f"Bulunan picture elementleri: {len(picture_elements)}")
        
        for picture in picture_elements:
            # source elementlerini kontrol et
            sources = picture.find_all('source', attrs={'srcset': True})
            for source in sources:
                srcset = source['srcset']
                if 'mzstatic.com' in srcset:
                    # En yüksek çözünürlüklü linki al
                    best_url = get_highest_res_from_srcset(srcset)
                    if best_url and 'mzstatic.com' in best_url:
                        # Sıkı filtreleme - sadece gerçek uygulama screenshot'larını al
                        def is_valid_screenshot(url):
                            # İkon URL'lerini filtrele
                            icon_keywords = ['AppIcon', 'icon', 'Icon', 'logo', 'Logo']
                            if any(keyword in url for keyword in icon_keywords):
                                return False
                            
                            # Sadece belirli boyutlardaki görselleri al (screenshot boyutları)
                            size_patterns = ['1286x0w', '1280x0w', '1200x0w', '1000x0w', '800x0w', '600x0w']
                            if not any(pattern in url for pattern in size_patterns):
                                return False
                            
                            # Sadece belirli dosya adı pattern'lerini al
                            valid_patterns = [
                                'Hero', 'Screenshot', 'screenshot', 'App_Store_Image', 
                                'PurpleSource', 'Mac_', 'iPhone_', 'iPad_'
                            ]
                            if not any(pattern in url for pattern in valid_patterns):
                                return False
                            
                            return True
                        
                        if is_valid_screenshot(best_url):
                            # Duplikat kontrolü - aynı görselin farklı formatlarını filtrele
                            # URL'den dosya adını çıkar (uzantı olmadan)
                            import re
                            base_url = re.sub(r'\.(webp|png|jpg|jpeg)$', '', best_url)
                            
                            # Bu base URL zaten var mı kontrol et
                            is_duplicate = False
                            for existing_url in internal_images:
                                existing_base = re.sub(r'\.(webp|png|jpg|jpeg)$', '', existing_url)
                                if base_url == existing_base:
                                    is_duplicate = True
                                    break
                            
                            if not is_duplicate:
                                internal_images.append(best_url)
                                print(f"Geçerli screenshot eklendi: {best_url}")
                            else:
                                print(f"Duplikat görsel atlandı: {best_url}")
                        else:
                            print(f"Geçersiz görsel atlandı: {best_url}")
        
        # Eğer picture elementlerinden görsel bulunamadıysa, genel arama yap
        if not internal_images:
            print("Picture elementlerinden görsel bulunamadı, genel arama yapılıyor...")
            internal_images = extract_mzstatic_images(soup)
        
        # App Store için özel seçiciler - mzstatic.com linklerini öncelikle al
        def extract_mzstatic_images(soup):
            images = []
            
            # Ekran görüntüsü olan mzstatic.com linklerini bul
            def is_screenshot_url(url):
                # İkon URL'lerini filtrele
                icon_keywords = ['AppIcon', 'icon', 'Icon']
                screenshot_keywords = ['App_Store_Image', 'screenshot', 'Screenshot', 'PurpleSource']
                
                # İkon URL'lerini hariç tut
                if any(keyword in url for keyword in icon_keywords):
                    return False
                
                # Ekran görüntüsü URL'lerini al
                if any(keyword in url for keyword in screenshot_keywords):
                    return True
                
                # Genel resim URL'leri (ikonsuz)
                if 'mzstatic.com' in url and any(ext in url for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                    return True
                
                return False
            
            # Tüm mzstatic.com linklerini bul
            for link in soup.find_all('a', href=True):
                href = link['href']
                if is_screenshot_url(href):
                    images.append(href)
            
            # srcset içindeki mzstatic linklerini bul
            for source in soup.find_all('source', attrs={'srcset': True}):
                srcset = source['srcset']
                if 'mzstatic.com' in srcset:
                    # En yüksek çözünürlüklü linki al
                    best_url = get_highest_res_from_srcset(srcset)
                    if best_url and is_screenshot_url(best_url):
                        images.append(best_url)
            
            # img src'lerde mzstatic linklerini bul
            for img in soup.find_all('img', src=True):
                src = img['src']
                if is_screenshot_url(src):
                    images.append(src)
            
            return list(set(images))  # Duplikatları kaldır
        
        print(f"Toplam {len(internal_images)} uygulama içi görsel bulundu")

        # Google Play için özel seçiciler
        if not internal_images:
            for img in soup.select('.screenshot img, .screenshot-image img'):
                src = img.get('src') or img.get('data-src')
                if src and src not in internal_images:
                    internal_images.append(urljoin(url, src))

        # Genel fallback - daha kapsamlı resim arama
        if not internal_images:
            # Farklı seçiciler dene
            selectors = [
                '.screenshots img', 
                '.screenshot img', 
                '.app-screenshot img',
                '.gallery img',
                '.carousel img',
                '.slider img',
                '[data-screenshot] img',
                '.preview img'
            ]
            
            for selector in selectors:
                for img in soup.select(selector):
                    src = img.get('src') or img.get('data-src') or img.get('data-lazy')
                    if src and src not in internal_images and not src.startswith('data:'):
                        # Sadece gerçek URL'leri al
                        if src.startswith('http') or src.startswith('//'):
                            internal_images.append(urljoin(url, src))
                        elif src.startswith('/'):
                            internal_images.append(urljoin(url, src))
                
                if internal_images:  # Eğer resim bulunduysa dur
                    break

        # Ana ikon için daha iyi arama
        if not image_url:
            # Farklı ikon seçicileri dene
            icon_selectors = [
                'link[rel="apple-touch-icon"]',
                'link[rel="icon"]',
                'link[rel="shortcut icon"]',
                'meta[property="og:image"]',
                'meta[name="twitter:image"]',
                '.app-icon img',
                '.logo img',
                '.icon img'
            ]
            
            for selector in icon_selectors:
                element = soup.select_one(selector)
                if element:
                    if element.name == 'link':
                        icon_url = element.get('href')
                    elif element.name == 'meta':
                        icon_url = element.get('content')
                    elif element.name == 'img':
                        icon_url = element.get('src') or element.get('data-src')
                    
                    if icon_url and not icon_url.startswith('data:'):
                        image_url = urljoin(url, icon_url)
                        break

        # Güncelleme notları tespiti
        update_notes = []
        
        # App Store güncelleme notları için spesifik tespit
        # Önce whats-new ile başlayan div'leri ara
        whats_new_divs = soup.find_all('div', class_=lambda x: x and 'whats-new' in x)
        
        for whats_new_div in whats_new_divs:
            # Tarih ve sürüm bilgisini al
            time_element = whats_new_div.find('time', attrs={'data-test-we-datetime': True})
            version_element = whats_new_div.find('p', class_=lambda x: x and 'version' in x)
            
            date_text = time_element.get_text(strip=True) if time_element else ''
            version_text = version_element.get_text(strip=True) if version_element else ''
            
            # Güncelleme notlarını al - we-truncate ile başlayan div'leri ara
            content_divs = whats_new_div.find_all('div', class_=lambda x: x and 'we-truncate' in x)
            
            for content_div in content_divs:
                # Tüm p elementlerini al
                paragraphs = content_div.find_all('p')
                
                for p in paragraphs:
                    text = p.get_text(strip=True)
                    if text and text not in ['', 'PATCH HIGHTLIGHTS']:
                        # Başlık olmayan metinleri al
                        if not text.isupper() or len(text) < 20:
                            update_notes.append(text)
                
                # Eğer güncelleme notları bulunduysa dur
                if update_notes:
                    # Eğer tarih ve sürüm varsa başa ekle
                    if date_text and version_text:
                        update_notes.insert(0, f"📅 {date_text} - {version_text}")
                    elif version_text:
                        update_notes.insert(0, f"📱 {version_text}")
                    break
            
            # Eğer güncelleme notları bulunduysa döngüden çık
            if update_notes:
                break

        
        # Eğer App Store formatında bulunamadıysa, genel arama yap
        if not update_notes:
            # Daha geniş arama - tüm p elementlerinde bullet point'leri ara
            all_paragraphs = soup.find_all('p')
            for p in all_paragraphs:
                text = p.get_text(strip=True)
                # Bullet point ile başlayan metinleri al
                if text and (text.startswith('•') or text.startswith('-') or text.startswith('*')):
                    if len(text) > 10:  # Çok kısa metinleri filtrele
                        update_notes.append(text)
            
            # Eğer hala bulunamadıysa, "what's new" benzeri anahtar kelimeleri ara
            if not update_notes:
                update_keywords = [
                    'what\'s new', 'güncelleme', 'yenilikler', 'changelog', 'release notes',
                    'update notes', 'version notes', 'patch notes', 'yeni özellikler'
                ]
                
                for keyword in update_keywords:
                    # Div içinde ara
                    update_element = soup.find('div', string=lambda text: text and keyword.lower() in text.lower())
                    if update_element:
                        # Kardeş elementleri kontrol et
                        for sibling in update_element.find_next_siblings():
                            sibling_text = sibling.get_text(strip=True)
                            if sibling_text and len(sibling_text) > 10:
                                update_notes.append(sibling_text)
                                break
                        break
                    
                    # H2, H3 başlıklarında ara
                    update_element = soup.find(['h2', 'h3'], string=lambda text: text and keyword.lower() in text.lower())
                    if update_element:
                        # Sonraki elementleri kontrol et
                        for sibling in update_element.find_next_siblings():
                            sibling_text = sibling.get_text(strip=True)
                            if sibling_text and len(sibling_text) > 10:
                                update_notes.append(sibling_text)
                                break
                        break

        # Sistem gereksinimleri tespiti
        system_requirements = []
        
        # App Store için spesifik sistem gereksinimleri tespiti
        # <dd class="information-list__item__definition"> içindeki <dl> yapısını ara
        info_definitions = soup.find_all('dd', class_='information-list__item__definition')
        
        for info_def in info_definitions:
            # İçindeki <dl> elementlerini kontrol et
            dl_elements = info_def.find_all('dl', class_='information-list__item__definition__item')
            
            for dl in dl_elements:
                # <dt> ve <dd> elementlerini al
                dt = dl.find('dt', class_='information-list__item__definition__item__term')
                dd = dl.find('dd', class_='information-list__item__definition__item__definition')
                
                if dt and dd:
                    term_text = dt.get_text(strip=True)
                    definition_text = dd.get_text(strip=True)
                    
                    # Platform terimlerini kontrol et
                    platform_terms = ['Mac', 'iPhone', 'iPad', 'iPod touch', 'Apple TV', 'Apple Watch']
                    
                    if any(platform in term_text for platform in platform_terms):
                        # Sistem gereksinimlerini temizle ve ekle
                        clean_requirement = definition_text.replace('&nbsp;', ' ').strip()
                        if clean_requirement and len(clean_requirement) > 5:
                            system_requirements.append(f"{term_text}: {clean_requirement}")
        
        # Eğer App Store formatında bulunamadıysa, genel arama yap
        if not system_requirements:
            # Sistem gereksinimleri için anahtar kelimeler
            requirements_keywords = [
                'system requirements', 'sistem gereksinimleri', 'minimum requirements',
                'gerekli sistem', 'platform', 'işletim sistemi', 'operating system',
                'compatibility', 'uyumluluk', 'requirements', 'gereksinimler'
            ]
            
            # Sistem gereksinimleri metnini bul
            for keyword in requirements_keywords:
                # Div içinde ara
                req_element = soup.find('div', string=lambda text: text and keyword.lower() in text.lower())
                if req_element:
                    # Kardeş elementleri kontrol et
                    for sibling in req_element.find_next_siblings():
                        sibling_text = sibling.get_text(strip=True)
                        if sibling_text and len(sibling_text) > 10:
                            system_requirements.append(sibling_text)
                            break
                    break
                
                # Span içinde ara
                req_element = soup.find('span', string=lambda text: text and keyword.lower() in text.lower())
                if req_element:
                    for sibling in req_element.find_next_siblings():
                        sibling_text = sibling.get_text(strip=True)
                        if sibling_text and len(sibling_text) > 10:
                            system_requirements.append(sibling_text)
                            break
                    break
                
                # P içinde ara
                req_element = soup.find('p', string=lambda text: text and keyword.lower() in text.lower())
                if req_element:
                    req_text = req_element.get_text(strip=True)
                    if req_text and len(req_text) > 10:
                        system_requirements.append(req_text)
                        break
            
            # Eğer hala bulunamadıysa, genel bilgilerden çıkarım yap
            if not system_requirements:
                # iOS/Android/Windows/macOS gibi platform bilgilerini ara
                platform_keywords = ['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Chrome OS']
                for keyword in platform_keywords:
                    platform_elements = soup.find_all(string=lambda text: text and keyword in text)
                    for element in platform_elements:
                        parent_text = element.parent.get_text(strip=True) if element.parent else ''
                        if len(parent_text) > 5 and len(parent_text) < 200:
                            system_requirements.append(parent_text)
                            break
                    if system_requirements:
                        break

        return jsonify({
            'name': app_name,
            'description': app_description,
            'website': url,
            'image': image_url,
            'version': app_version,
            'fileSize': app_file_size,
            'category': app_category,
            'internalImages': internal_images[:10],
            'systemRequirements': system_requirements[:5],  # En fazla 5 sistem gereksinimi
            'features': update_notes[:10]  # En fazla 10 güncelleme notu
        })

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'URL getirilemedi: {e}'}), 500
    except Exception as e:
        return jsonify({'error': f'Veri çekme sırasında bir hata oluştu: {e}'}), 500

@app.route('/api/apps', methods=['GET'])
def get_apps():
    all_apps = load_apps()

    # Arama ve Filtreleme
    search_term = request.args.get('search', '').lower()
    category = request.args.get('category', 'Tümü')
    sort_by = request.args.get('sort', 'default')

    filtered_apps = all_apps

    # Kategoriye göre filtrele
    if category != 'Tümü' and category != 'Favoriler':
        # Ana kategori kontrolü - alt kategorilerdeki tüm uygulamaları dahil et
        if category in CATEGORY_HIERARCHY:
            # Ana kategori ise, alt kategorilerdeki tüm uygulamaları al
            subcategories = CATEGORY_HIERARCHY[category]['subcategories']
            filtered_apps = [
                app for app in filtered_apps
                if app.get('category') and (
                    app.get('category') == category or  # Ana kategori
                    app.get('category') in subcategories or  # Alt kategoriler
                    any(app.get('category').startswith(sub + ' > ') for sub in subcategories)  # Alt kategori hiyerarşisi
                )
            ]
        else:
            # Normal kategori filtreleme
            filtered_apps = [
                app for app in filtered_apps
                if app.get('category') and 
                   (app.get('category') == category or app.get('category').startswith(category + ' > '))
            ]

    # Arama terimine göre filtrele
    if search_term:
        filtered_apps = [
            app for app in filtered_apps 
            if search_term in app.get('name', '').lower() or 
               search_term in app.get('description', '').lower()
        ]

    # Sıralama
    if sort_by == 'name-asc':
        filtered_apps.sort(key=lambda x: x.get('name', ''))
    elif sort_by == 'name-desc':
        filtered_apps.sort(key=lambda x: x.get('name', ''), reverse=True)
    else: # 'default' (sadece tarih/saat sıralaması)
        def get_sort_priority(app):
            creation_date_str = app.get('creationDate')
            last_modified = datetime.fromisoformat(app.get('lastModified', '1970-01-01T00:00:00+00:00').replace('Z', '+00:00'))
            
            # Sadece tarih/saat sıralaması - rozet önceliği yok
            if creation_date_str:
                creation_date = datetime.fromisoformat(creation_date_str.replace('Z', '+00:00'))
                # En yeni tarih/saat solda (ilk sırada) - creationDate ve lastModified'den daha yeni olanı kullan
                return -max(creation_date.timestamp(), last_modified.timestamp())
            else:
                # creationDate yoksa sadece lastModified kullan
                return -last_modified.timestamp()
            
        filtered_apps.sort(key=get_sort_priority)

    # Sayfalama
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 12, type=int)

    # limit=0 ise tüm sonuçları döndür, sayfalama yapma
    if limit == 0:
        paginated_apps = filtered_apps
        total_pages = 1
        page = 1
        total_apps = len(filtered_apps)
    else:
        total_apps = len(filtered_apps)
        total_pages = ceil(total_apps / limit)
        start_index = (page - 1) * limit
        end_index = start_index + limit
        paginated_apps = filtered_apps[start_index:end_index]

    return jsonify({
        'apps': paginated_apps,
        'totalPages': total_pages,
        'currentPage': page,
        'totalApps': total_apps
    })

@app.route('/api/apps', methods=['POST'])
def add_app():
    apps = load_apps()
    new_app_data = request.json
    
    # Aynı isimde uygulama var mı kontrol et
    if any(app['name'] == new_app_data.get('name') for app in apps):
        return jsonify({'error': 'Bu isimde bir uygulama zaten mevcut'}), 409

    # Sürüm formatını düzelt - sadece versiyon numarası
    if 'version' in new_app_data and new_app_data['version']:
        import re
        version = new_app_data['version']
        # "Sürüm" kelimesini kaldır
        version = re.sub(r'^sürüm\s*', '', version, flags=re.IGNORECASE).strip()
        version_match = re.search(r'(\d+(?:\.\d+)*)', version)
        if version_match:
            new_app_data['version'] = version_match.group(1)  # Sadece versiyon numarası
        else:
            new_app_data['version'] = version  # Orijinal değeri koru

    now = datetime.now(timezone.utc).isoformat()
    new_app_data['creationDate'] = now
    new_app_data['lastModified'] = now
    if not 'reviews' in new_app_data:
        new_app_data['reviews'] = []
    if not 'badgeType' in new_app_data:
        new_app_data['badgeType'] = 'new'  # Yeni eklenen uygulamalar otomatik olarak "YENİ" rozeti alır

    apps.insert(0, new_app_data) # Yeni uygulamayı listenin başına ekle
    save_apps(apps)
    return jsonify(new_app_data), 201

@app.route('/api/apps/<app_name>', methods=['PUT'])
def update_app(app_name):
    apps = load_apps()
    app_to_update = None
    app_index = -1

    for i, app in enumerate(apps):
        # Normalize both names for comparison - remove invisible characters
        app_name_normalized = app_name.strip().replace('\u200e', '').replace('\u200f', '')
        stored_name_normalized = app.get('name', '').strip().replace('\u200e', '').replace('\u200f', '')
        
        if stored_name_normalized == app_name_normalized:
            app_to_update = app
            app_index = i
            break

    if not app_to_update:
        return jsonify({'error': 'Uygulama bulunamadı'}), 404

    update_data = request.json
    
    # İsim değişikliği varsa, yeni ismin başka bir uygulamada kullanılmadığından emin ol
    new_name = update_data.get('name')
    if new_name != app_name and any(app['name'] == new_name for app in apps):
        return jsonify({'error': 'Bu isimde bir uygulama zaten mevcut'}), 409

    # Verileri güncelle
    update_data['lastModified'] = datetime.now(timezone.utc).isoformat()
    apps[app_index] = update_data
    
    save_apps(apps)
    return jsonify(apps[app_index])

@app.route('/api/apps/<app_name>', methods=['DELETE'])
def delete_app(app_name):
    apps = load_apps()
    original_length = len(apps)
    
    # Normalize app_name for comparison
    app_name_normalized = app_name.strip().replace('\u200e', '').replace('\u200f', '')
    apps_to_keep = [app for app in apps if app.get('name', '').strip().replace('\u200e', '').replace('\u200f', '') != app_name_normalized]

    if len(apps_to_keep) == original_length:
        return jsonify({'error': 'Uygulama bulunamadı'}), 404

    save_apps(apps_to_keep)
    return jsonify({'message': f'{app_name} başarıyla silindi'}), 200

@app.route('/api/featured-apps', methods=['GET'])
def get_featured_apps():
    """Öne çıkarılan uygulamaları getir"""
    all_apps = load_apps()
    featured_apps = [app for app in all_apps if app.get('featured', False)]
    
    # Öne çıkarılan uygulamaları tarihe göre sırala (en yeni önce)
    featured_apps.sort(key=lambda x: x.get('lastModified', '1970-01-01T00:00:00+00:00'), reverse=True)
    
    return jsonify(featured_apps)

@app.route('/api/apps/<app_name>/featured', methods=['PUT'])
def toggle_featured(app_name):
    """Uygulamanın öne çıkarılan durumunu değiştir"""
    apps = load_apps()
    app_to_update = None
    app_index = -1


    for i, app in enumerate(apps):
        # Normalize both names for comparison - remove invisible characters
        app_name_normalized = app_name.strip().replace('\u200e', '').replace('\u200f', '')
        stored_name_normalized = app.get('name', '').strip().replace('\u200e', '').replace('\u200f', '')
        
        if stored_name_normalized == app_name_normalized:
            app_to_update = app
            app_index = i
            break

    if not app_to_update:
        return jsonify({'error': f'Uygulama bulunamadı: {app_name}'}), 404

    # Featured durumunu toggle et
    current_featured = app_to_update.get('featured', False)
    apps[app_index]['featured'] = not current_featured
    
    # Güncelleme tarihini güncelle
    apps[app_index]['lastModified'] = datetime.now(timezone.utc).isoformat()

    save_apps(apps)
    
    return jsonify({
        'message': f'Uygulama {"öne çıkarıldı" if not current_featured else "öne çıkarılanlardan çıkarıldı"}',
        'featured': not current_featured
    })

# Kategori Yönetimi Endpoint'leri

@app.route('/api/categories', methods=['GET'])
def get_categories():
    apps = load_apps()
    # Mevcut kategorileri al
    existing_categories = sorted(list(set(app.get('category') for app in apps if app.get('category'))))
    
    # Hiyerarşik yapıyı oluştur
    hierarchical_categories = {
        "hierarchy": CATEGORY_HIERARCHY,
        "existing": existing_categories,
        "all": get_all_categories()
    }
    
    return jsonify(hierarchical_categories)

@app.route('/api/categories', methods=['PUT'])
def rename_category():
    data = request.json
    old_name = data.get('old_name')
    new_name = data.get('new_name')

    if not old_name or not new_name:
        return jsonify({'error': 'Eski ve yeni kategori isimleri gereklidir'}), 400

    apps = load_apps()

    existing_categories = set(app.get('category') for app in apps if app.get('category'))
    if new_name in existing_categories and new_name != old_name:
        return jsonify({"error": f"'{new_name}' adında bir kategori zaten mevcut"}), 409

    updated_count = 0
    for app in apps:
        app_category = app.get('category')
        if app_category:
            if app_category == old_name:
                app['category'] = new_name
                app['lastModified'] = datetime.now(timezone.utc).isoformat()
                updated_count += 1
            elif app_category.startswith(old_name + ' > '):
                app['category'] = new_name + app_category[len(old_name):]
                app['lastModified'] = datetime.now(timezone.utc).isoformat()
                updated_count += 1
    
    if updated_count > 0:
        save_apps(apps)

    return jsonify({"message": f"'{old_name}' kategorisi ve alt kategorileri '{new_name}' olarak değiştirildi. {updated_count} uygulama güncellendi."})


@app.route('/api/categories/<string:name>', methods=['DELETE'])
def delete_category(name):
    apps = load_apps()
    updated_count = 0
    for app in apps:
        app_category = app.get('category')
        if app_category:
            if app_category == name or app_category.startswith(name + ' > '):
                app['category'] = 'Kategorisiz'
                app['lastModified'] = datetime.now(timezone.utc).isoformat()
                updated_count += 1

    if updated_count > 0:
        save_apps(apps)

    return jsonify({"message": f"'{name}' kategorisi ve tüm alt kategorileri silindi. {updated_count} uygulama 'Kategorisiz' olarak işaretlendi."})


# Static dosya servisi
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)