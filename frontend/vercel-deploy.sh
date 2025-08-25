#!/bin/bash

# Script per deployare l'app su Vercel
echo "🚀 Deploying to Vercel..."

# Verifica che vercel CLI sia installato
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI non trovato. Installa con: npm i -g vercel"
    exit 1
fi

# Build dell'app
echo "📦 Building app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build fallito"
    exit 1
fi

# Deploy su Vercel
echo "🚀 Deploying..."
vercel --prod

echo "✅ Deploy completato!"
echo "🔗 Verifica: https://agoralia.vercel.app"
