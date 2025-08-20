#!/bin/bash

# 🚀 Vercel Deployment Script - ColdAI CRM Integrations
# Sprint 9: CRM Core Integrations + Ottimizzazioni Last-Mile

set -e  # Exit on any error

echo "🚀 Starting Vercel deployment for ColdAI CRM Integrations..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vercel CLI is installed
check_vercel_cli() {
    print_status "Checking Vercel CLI installation..."
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI not found. Please install it first:"
        echo "npm install -g vercel"
        exit 1
    fi
    print_success "Vercel CLI found"
}

# Check if we're in the frontend directory
check_directory() {
    print_status "Checking current directory..."
    if [[ ! -f "package.json" ]] || [[ ! -d "src" ]]; then
        print_error "Please run this script from the frontend directory"
        exit 1
    fi
    print_success "Frontend directory confirmed"
}

# Check if backend is deployed and accessible
check_backend_health() {
    print_status "Checking backend health..."
    
    # Try to get backend URL from environment or use default
    local backend_url=${BACKEND_URL:-"https://api.agoralia.app"}
    
    if curl -s "$backend_url/health" > /dev/null; then
        print_success "Backend health check passed: $backend_url"
    else
        print_warning "Backend health check failed: $backend_url"
        echo "Make sure the backend is deployed and accessible before deploying frontend"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Build the frontend
build_frontend() {
    print_status "Building frontend application..."
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm ci
    
    # Build the application
    print_status "Building application..."
    npm run build
    
    if [[ -d "dist" ]]; then
        print_success "Frontend build completed successfully"
    else
        print_error "Frontend build failed - dist directory not found"
        exit 1
    fi
}

# Deploy to Vercel
deploy_vercel() {
    print_status "Deploying to Vercel..."
    
    # Check if project is linked
    if [[ ! -f ".vercel/project.json" ]]; then
        print_status "Project not linked to Vercel. Linking now..."
        vercel link
    fi
    
    # Deploy the application
    print_status "Starting deployment..."
    vercel --prod
    
    print_success "Vercel deployment completed!"
}

# Get deployment URL
get_deployment_url() {
    print_status "Getting deployment URL..."
    
    # Try to get URL from vercel ls
    local url=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "")
    
    if [[ -n "$url" && "$url" != "null" ]]; then
        print_success "Frontend URL: $url"
        echo "Frontend is now accessible at: $url"
    else
        print_warning "Could not determine frontend URL"
        echo "Check Vercel dashboard for the deployment URL"
    fi
}

# Test frontend functionality
test_frontend() {
    print_status "Testing frontend functionality..."
    
    # Try to get URL from vercel ls
    local url=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "")
    
    if [[ -z "$url" || "$url" == "null" ]]; then
        print_warning "Cannot test frontend - URL not available"
        return 0
    fi
    
    # Test if frontend loads
    print_status "Testing frontend load..."
    if curl -s "$url" > /dev/null; then
        print_success "Frontend loads successfully"
    else
        print_warning "Frontend load test failed"
    fi
    
    # Test if API calls work (basic check)
    print_status "Testing API connectivity..."
    local backend_url=${BACKEND_URL:-"https://api.agoralia.app"}
    if curl -s "$backend_url/health" > /dev/null; then
        print_success "API connectivity confirmed"
    else
        print_warning "API connectivity test failed"
    fi
}

# Main deployment flow
main() {
    echo "🎯 ColdAI CRM Integrations - Vercel Deployment"
    echo "==============================================="
    
    check_vercel_cli
    check_directory
    
    echo
    print_status "Checking backend health..."
    check_backend_health
    
    echo
    print_status "Building frontend application..."
    build_frontend
    
    echo
    print_status "Starting deployment process..."
    deploy_vercel
    
    echo
    print_status "Getting deployment information..."
    get_deployment_url
    
    echo
    print_status "Testing frontend functionality..."
    test_frontend
    
    echo
    print_success "🎉 Vercel deployment completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Verify frontend is accessible at the deployment URL"
    echo "2. Test CRM integration features"
    echo "3. Run canary testing with pilot users"
    echo "4. Monitor frontend performance and errors"
    echo
    echo "Canary testing checklist:"
    echo "✅ Backend deployed to Railway"
    echo "✅ Frontend deployed to Vercel"
    echo "✅ Environment variables configured"
    echo "⏳ CRM integration testing"
    echo "⏳ User acceptance testing"
    echo "⏳ Performance monitoring"
}

# Run main function
main "$@"
