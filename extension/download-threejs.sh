#!/bin/bash

echo "Descargando Three.js r128..."

# Intentar con curl
if command -v curl &> /dev/null; then
    curl -sL -o three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
    if [ $? -eq 0 ]; then
        echo "✅ Three.js descargado con curl"
        ls -lh three.min.js
        exit 0
    fi
fi

# Intentar con wget
if command -v wget &> /dev/null; then
    wget -q -O three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
    if [ $? -eq 0 ]; then
        echo "✅ Three.js descargado con wget"
        ls -lh three.min.js
        exit 0
    fi
fi

echo "❌ Error: No se pudo descargar Three.js"
echo ""
echo "Por favor, descarga manualmente desde:"
echo "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
echo ""
echo "Y guárdalo como: three.min.js en esta carpeta"
exit 1
