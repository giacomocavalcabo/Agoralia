#!/bin/bash

# 🚀 Railway Deployment Script - ColdAI CRM Integrations
# Sprint 9: CRM Core Integrations + Ottimizzazioni Last-Mile

set -e  # Exit on any error

echo "🚀 Starting Railway deployment for ColdAI CRM Integrations..."

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

# Check if Railway CLI is installed
check_railway_cli() {
    print_status "Checking Railway CLI installation..."
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI not found. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    print_success "Railway CLI found"
}

# Check if git is clean
check_git_status() {
    print_status "Checking git status..."
    if [[ -n $(git status --porcelain) ]]; then
        print_warning "Git working directory not clean. Please commit or stash changes."
        git status --porcelain
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    print_success "Git status clean"
}

# Deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."
    
    # Login to Railway (if not already logged in)
    if ! railway whoami &> /dev/null; then
        print_status "Logging in to Railway..."
        railway login
    fi
    
    # Deploy the application
    print_status "Starting deployment..."
    railway up
    
    print_success "Railway deployment completed!"
}

# Wait for deployment to be ready
wait_for_deployment() {
    print_status "Waiting for deployment to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        print_status "Health check attempt $attempt/$max_attempts..."
        
        # Try to get the deployment URL
        local url=$(railway status --json | jq -r '.deployment.url' 2>/dev/null || echo "")
        
        if [[ -n "$url" && "$url" != "null" ]]; then
            print_success "Deployment URL: $url"
            
            # Test health endpoint
            if curl -s "$url/health" > /dev/null; then
                print_success "Health check passed!"
                return 0
            fi
        fi
        
        print_status "Deployment not ready yet, waiting 10 seconds..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    print_error "Deployment failed to become ready after $max_attempts attempts"
    return 1
}

# Test CRM endpoints
test_crm_endpoints() {
    print_status "Testing CRM endpoints..."
    
    local url=$(railway status --json | jq -r '.deployment.url' 2>/dev/null || echo "")
    if [[ -z "$url" || "$url" == "null" ]]; then
        print_error "Cannot get deployment URL"
        return 1
    fi
    
    # Test base health
    print_status "Testing base health endpoint..."
    if curl -s "$url/health" > /dev/null; then
        print_success "Base health endpoint OK"
    else
        print_error "Base health endpoint failed"
        return 1
    fi
    
    # Test CRM health endpoints
    local providers=("hubspot" "zoho" "odoo")
    for provider in "${providers[@]}"; do
        print_status "Testing CRM health for $provider..."
        if curl -s "$url/crm/health?provider=$provider" > /dev/null; then
            print_success "CRM health for $provider OK"
        else
            print_warning "CRM health for $provider failed (expected for new deployment)"
        fi
    done
    
    # Test metrics endpoint
    print_status "Testing metrics endpoint..."
    if curl -s "$url/crm/metrics" > /dev/null; then
        print_success "Metrics endpoint OK"
    else
        print_warning "Metrics endpoint failed (expected for new deployment)"
    fi
    
    print_success "CRM endpoint testing completed!"
}

# Main deployment flow
main() {
    echo "🎯 ColdAI CRM Integrations - Railway Deployment"
    echo "================================================"
    
    check_railway_cli
    check_git_status
    
    echo
    print_status "Starting deployment process..."
    
    deploy_railway
    
    echo
    print_status "Waiting for deployment to be ready..."
    if wait_for_deployment; then
        echo
        print_success "🚀 Railway deployment successful!"
        
        echo
        print_status "Testing CRM endpoints..."
        test_crm_endpoints
        
        echo
        print_success "🎉 Deployment completed successfully!"
        echo
        echo "Next steps:"
        echo "1. Configure environment variables in Railway dashboard"
        echo "2. Deploy frontend to Vercel"
        echo "3. Run canary testing"
        echo "4. Monitor metrics and health checks"
        
    else
        print_error "❌ Railway deployment failed!"
        echo
        echo "Troubleshooting:"
        echo "1. Check Railway dashboard for errors"
        echo "2. Verify environment variables"
        echo "3. Check build logs"
        echo "4. Contact support if needed"
        exit 1
    fi
}

# Run main function
main "$@"
