#!/bin/bash

# Sunucuyu başlat
echo "Sunucu başlatılıyor..."
python3 server.py

# Eğer sunucu kapanırsa, 5 saniye bekle ve yeniden başlat
while true; do
    echo "Sunucu kapatıldı. 5 saniye sonra yeniden başlatılıyor..."
    sleep 5
    echo "Sunucu yeniden başlatılıyor..."
    python3 server.py
done
