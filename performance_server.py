# MacFreeApps Performance Enhanced Server
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import json
import os
import time
import hashlib
import gzip
from functools import wraps
from datetime import datetime, timedelta
import threading
import sqlite3
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)
CORS(app)

# Rate Limiting Configuration
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1000 per hour", "100 per minute"],
    storage_uri="memory://"
)

# Cache Configuration
CACHE_DURATION = 300  # 5 minutes
MEMORY_CACHE = {}
CACHE_LOCK = threading.Lock()

# Database for persistent caching
def init_cache_db():
    conn = sqlite3.connect('cache.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            expires_at REAL,
            created_at REAL
        )
    ''')
    conn.commit()
    conn.close()

# Cache functions
def get_cache_key(*args, **kwargs):
    """Generate cache key from arguments"""
    key_string = f"{args}_{kwargs}"
    return hashlib.md5(key_string.encode()).hexdigest()

def get_from_cache(key):
    """Get value from cache"""
    with CACHE_LOCK:
        # Check memory cache first
        if key in MEMORY_CACHE:
            data, expires_at = MEMORY_CACHE[key]
            if time.time() < expires_at:
                return data
            else:
                del MEMORY_CACHE[key]
        
        # Check database cache
        conn = sqlite3.connect('cache.db')
        cursor = conn.cursor()
        cursor.execute(
            'SELECT value FROM cache WHERE key = ? AND expires_at > ?',
            (key, time.time())
        )
        result = cursor.fetchone()
        conn.close()
        
        if result:
            data = json.loads(result[0])
            # Store in memory cache for faster access
            with CACHE_LOCK:
                MEMORY_CACHE[key] = (data, time.time() + CACHE_DURATION)
            return data
    
    return None

def set_cache(key, value, duration=CACHE_DURATION):
    """Set value in cache"""
    expires_at = time.time() + duration
    
    with CACHE_LOCK:
        # Store in memory cache
        MEMORY_CACHE[key] = (value, expires_at)
    
    # Store in database cache
    conn = sqlite3.connect('cache.db')
    cursor = conn.cursor()
    cursor.execute(
        'INSERT OR REPLACE INTO cache (key, value, expires_at, created_at) VALUES (?, ?, ?, ?)',
        (key, json.dumps(value), expires_at, time.time())
    )
    conn.commit()
    conn.close()

def cache_response(duration=CACHE_DURATION):
    """Decorator for caching API responses"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache_key = get_cache_key(f.__name__, args, kwargs)
            cached_result = get_from_cache(cache_key)
            
            if cached_result is not None:
                return jsonify(cached_result)
            
            result = f(*args, **kwargs)
            if hasattr(result, 'get_json'):
                result_data = result.get_json()
                set_cache(cache_key, result_data, duration)
            else:
                set_cache(cache_key, result, duration)
            
            return result
        return decorated_function
    return decorator

# Compression middleware
@app.after_request
def after_request(response):
    """Add compression and caching headers"""
    # Add compression
    if response.content_length and response.content_length > 1024:
        response.data = gzip.compress(response.data)
        response.headers['Content-Encoding'] = 'gzip'
        response.headers['Content-Length'] = len(response.data)
    
    # Add caching headers
    if request.endpoint in ['static', 'get_apps', 'get_categories']:
        response.headers['Cache-Control'] = 'public, max-age=300'  # 5 minutes
    elif request.endpoint in ['get_app', 'scrape_url']:
        response.headers['Cache-Control'] = 'public, max-age=60'   # 1 minute
    else:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    
    # Add security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Add performance headers
    response.headers['X-Powered-By'] = 'MacFreeApps'
    response.headers['X-Cache'] = 'HIT' if get_from_cache(get_cache_key(request.endpoint, request.args)) else 'MISS'
    
    return response

# Performance monitoring
@app.before_request
def before_request():
    request.start_time = time.time()

@app.after_request
def after_request_performance(response):
    if hasattr(request, 'start_time'):
        duration = time.time() - request.start_time
        response.headers['X-Response-Time'] = f"{duration:.3f}s"
        
        # Log slow requests
        if duration > 1.0:  # Slower than 1 second
            print(f"⚠️ Slow request: {request.endpoint} took {duration:.3f}s")
    
    return response

# Load apps data with caching
def load_apps_cached():
    cache_key = 'apps_data'
    cached_data = get_from_cache(cache_key)
    
    if cached_data:
        return cached_data
    
    try:
        with open('apps.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        set_cache(cache_key, data, 300)  # Cache for 5 minutes
        return data
    except FileNotFoundError:
        return {"apps": [], "categories": []}

# Save apps data
def save_apps(data):
    with open('apps.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Invalidate cache
    cache_key = 'apps_data'
    with CACHE_LOCK:
        if cache_key in MEMORY_CACHE:
            del MEMORY_CACHE[cache_key]

# API Routes with caching and rate limiting
@app.route('/api/apps')
@limiter.limit("100 per minute")
@cache_response(300)  # Cache for 5 minutes
def get_apps():
    """Get all apps with caching"""
    try:
        data = load_apps_cached()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/apps/<int:app_id>')
@limiter.limit("200 per minute")
@cache_response(60)  # Cache for 1 minute
def get_app(app_id):
    """Get specific app by ID"""
    try:
        data = load_apps_cached()
        app = next((app for app in data.get('apps', []) if app.get('id') == app_id), None)
        
        if app:
            return jsonify(app)
        else:
            return jsonify({"error": "App not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/categories')
@limiter.limit("50 per minute")
@cache_response(600)  # Cache for 10 minutes
def get_categories():
    """Get all categories"""
    try:
        data = load_apps_cached()
        return jsonify(data.get('categories', []))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/apps', methods=['POST'])
@limiter.limit("20 per minute")
def add_app():
    """Add new app"""
    try:
        data = load_apps_cached()
        new_app = request.get_json()
        
        # Generate ID
        new_app['id'] = max([app.get('id', 0) for app in data.get('apps', [])], default=0) + 1
        new_app['created_at'] = datetime.now().isoformat()
        
        data['apps'].append(new_app)
        save_apps(data)
        
        return jsonify(new_app), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/apps/<int:app_id>', methods=['PUT'])
@limiter.limit("30 per minute")
def update_app(app_id):
    """Update app"""
    try:
        data = load_apps_cached()
        updated_app = request.get_json()
        
        for i, app in enumerate(data.get('apps', [])):
            if app.get('id') == app_id:
                updated_app['id'] = app_id
                updated_app['updated_at'] = datetime.now().isoformat()
                data['apps'][i] = updated_app
                save_apps(data)
                return jsonify(updated_app)
        
        return jsonify({"error": "App not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/apps/<int:app_id>', methods=['DELETE'])
@limiter.limit("10 per minute")
def delete_app(app_id):
    """Delete app"""
    try:
        data = load_apps_cached()
        
        for i, app in enumerate(data.get('apps', [])):
            if app.get('id') == app_id:
                del data['apps'][i]
                save_apps(data)
                return jsonify({"message": "App deleted"})
        
        return jsonify({"error": "App not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/scrape-url', methods=['POST'])
@limiter.limit("10 per minute")
def scrape_url():
    """Scrape URL with caching"""
    try:
        url = request.get_json().get('url')
        if not url:
            return jsonify({"error": "URL is required"}), 400
        
        # Check cache first
        cache_key = f"scrape_{hashlib.md5(url.encode()).hexdigest()}"
        cached_result = get_from_cache(cache_key)
        
        if cached_result:
            return jsonify(cached_result)
        
        # Simulate scraping (replace with actual scraping logic)
        scraped_data = {
            "name": "Sample App",
            "category": "Programlar",
            "description": "Sample description",
            "version": "1.0.0",
            "image": "https://via.placeholder.com/300x200",
            "download_url": url,
            "scraped_at": datetime.now().isoformat()
        }
        
        # Cache for 1 hour
        set_cache(cache_key, scraped_data, 3600)
        
        return jsonify(scraped_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Static file serving with caching
@app.route('/')
def index():
    """Serve index.html with caching"""
    return send_file('index.html')

@app.route('/admin.html')
def admin():
    """Serve admin.html"""
    return send_file('admin.html')

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files with appropriate caching"""
    if filename.endswith(('.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico')):
        return send_from_directory('.', filename)
    return send_file(filename)

# Health check endpoint
@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "cache_size": len(MEMORY_CACHE),
        "uptime": time.time() - app.start_time if hasattr(app, 'start_time') else 0
    })

# Cache management endpoints
@app.route('/api/cache/clear', methods=['POST'])
@limiter.limit("5 per minute")
def clear_cache():
    """Clear all caches"""
    try:
        with CACHE_LOCK:
            MEMORY_CACHE.clear()
        
        # Clear database cache
        conn = sqlite3.connect('cache.db')
        cursor = conn.cursor()
        cursor.execute('DELETE FROM cache')
        conn.commit()
        conn.close()
        
        return jsonify({"message": "Cache cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cache/stats')
@limiter.limit("20 per minute")
def cache_stats():
    """Get cache statistics"""
    try:
        conn = sqlite3.connect('cache.db')
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM cache')
        db_cache_count = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({
            "memory_cache_size": len(MEMORY_CACHE),
            "database_cache_size": db_cache_count,
            "total_memory_usage": sum(len(str(v)) for v in MEMORY_CACHE.values())
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Error handlers
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Rate limit exceeded", "retry_after": e.retry_after}), 429

@app.errorhandler(404)
def not_found_handler(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error_handler(e):
    return jsonify({"error": "Internal server error"}), 500

# Initialize
if __name__ == '__main__':
    app.start_time = time.time()
    init_cache_db()
    
    # Start cache cleanup thread
    def cleanup_cache():
        while True:
            time.sleep(3600)  # Run every hour
            conn = sqlite3.connect('cache.db')
            cursor = conn.cursor()
            cursor.execute('DELETE FROM cache WHERE expires_at < ?', (time.time(),))
            conn.commit()
            conn.close()
    
    cleanup_thread = threading.Thread(target=cleanup_cache, daemon=True)
    cleanup_thread.start()
    
    print("🚀 MacFreeApps Performance Server starting...")
    print("📊 Features enabled:")
    print("  ✅ Rate Limiting")
    print("  ✅ Memory + Database Caching")
    print("  ✅ Gzip Compression")
    print("  ✅ Security Headers")
    print("  ✅ Performance Monitoring")
    print("  ✅ Cache Management")
    
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
