#!/bin/bash

# 🚀 ColdAI CRM Integrations - MAIN DEPLOYMENT SCRIPT
# Sprint 9: CRM Core Integrations + Ottimizzazioni Last-Mile

set -e  # Exit on any error

echo "🚀 ColdAI CRM Integrations - MAIN DEPLOYMENT SCRIPT"
echo "=================================================="
echo "🎯 Sprint 9: CRM Core Integrations + Ottimizzazioni Last-Mile"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${PURPLE}🎯 $1${NC}"
    echo "=================================================="
}

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

print_step() {
    echo -e "${CYAN}📋 $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "CHECKING PREREQUISITES"
    
    # Check if we're in the right directory
    if [[ ! -f "railway.toml" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
        print_error "Please run this script from the ColdAI project root directory"
        exit 1
    fi
    
    # Check if scripts are executable
    if [[ ! -x "deploy_railway.sh" ]] || [[ ! -x "deploy_vercel.sh" ]] || [[ ! -x "canary_testing.sh" ]]; then
        print_error "Deployment scripts are not executable. Please run: chmod +x deploy_*.sh canary_testing.sh"
        exit 1
    fi
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI not found. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI not found. Please install it first:"
        echo "npm install -g vercel"
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is required for JSON parsing. Please install it first."
        exit 1
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        print_error "curl is required for HTTP requests. Please install it first."
        exit 1
    fi
    
    print_success "All prerequisites are satisfied!"
}

# Pre-deployment checklist
pre_deployment_checklist() {
    print_header "PRE-DEPLOYMENT CHECKLIST"
    
    echo "Please confirm the following items:"
    echo
    
    # Git status
    print_step "Git Status"
    if [[ -n $(git status --porcelain) ]]; then
        print_warning "Git working directory not clean:"
        git status --porcelain
        echo
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled. Please commit or stash changes first."
            exit 1
        fi
    else
        print_success "Git working directory is clean"
    fi
    
    # Environment variables
    print_step "Environment Variables"
    echo "Have you prepared the following environment variables?"
    echo "  - CRM_HUBSPOT_CLIENT_ID/SECRET"
    echo "  - CRM_ZOHO_CLIENT_ID/SECRET"
    echo "  - CRM_ODOO_* variables"
    echo "  - DATABASE_URL"
    echo "  - REDIS_URL"
    echo "  - ENCRYPTION_KEY"
    echo
    read -p "Environment variables ready? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Please prepare environment variables before deployment."
        exit 1
    fi
    
    # Railway project
    print_step "Railway Project"
    echo "Have you created a Railway project for the backend?"
    echo
    read -p "Railway project ready? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Please create a Railway project before deployment."
        exit 1
    fi
    
    # Vercel project
    print_step "Vercel Project"
    echo "Have you created a Vercel project for the frontend?"
    echo
    read -p "Vercel project ready? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Please create a Vercel project before deployment."
        exit 1
    fi
    
    print_success "Pre-deployment checklist completed!"
}

# Deploy backend to Railway
deploy_backend() {
    print_header "DEPLOYING BACKEND TO RAILWAY"
    
    print_status "Starting Railway deployment..."
    
    # Login to Railway (if not already logged in)
    if ! railway whoami &> /dev/null; then
        print_status "Logging in to Railway..."
        railway login
    fi
    
    # Link project (if not already linked)
    if [[ ! -f ".railway" ]]; then
        print_status "Linking project to Railway..."
        railway link
    fi
    
    # Deploy
    print_status "Deploying to Railway..."
    ./deploy_railway.sh
    
    if [[ $? -eq 0 ]]; then
        print_success "Backend deployment completed successfully!"
        
        # Get deployment URL
        local url=$(railway status --json | jq -r '.deployment.url' 2>/dev/null || echo "")
        if [[ -n "$url" && "$url" != "null" ]]; then
            print_success "Backend URL: $url"
            export BACKEND_URL="$url"
        fi
    else
        print_error "Backend deployment failed!"
        exit 1
    fi
}

# Deploy frontend to Vercel
deploy_frontend() {
    print_header "DEPLOYING FRONTEND TO VERCEL"
    
    print_status "Starting Vercel deployment..."
    
    # Go to frontend directory
    cd frontend
    
    # Deploy
    print_status "Deploying to Vercel..."
    ../deploy_vercel.sh
    
    if [[ $? -eq 0 ]]; then
        print_success "Frontend deployment completed successfully!"
        
        # Get deployment URL
        local url=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "")
        if [[ -n "$url" && "$url" != "null" ]]; then
            print_success "Frontend URL: $url"
            export FRONTEND_URL="$url"
        fi
        
        # Go back to root
        cd ..
    else
        print_error "Frontend deployment failed!"
        cd ..
        exit 1
    fi
}

# Configure environment variables
configure_environment() {
    print_header "CONFIGURING ENVIRONMENT VARIABLES"
    
    print_status "Please configure the following environment variables in Railway:"
    echo
    echo "🔑 REQUIRED VARIABLES:"
    echo "  - CRM_HUBSPOT_CLIENT_ID"
    echo "  - CRM_HUBSPOT_CLIENT_SECRET"
    echo "  - CRM_ZOHO_CLIENT_ID"
    echo "  - CRM_ZOHO_CLIENT_SECRET"
    echo "  - CRM_ODOO_BASE_URL"
    echo "  - CRM_ODOO_CLIENT_ID"
    echo "  - CRM_ODOO_CLIENT_SECRET"
    echo "  - DATABASE_URL"
    echo "  - REDIS_URL"
    echo "  - ENCRYPTION_KEY"
    echo
    echo "🌐 OPTIONAL VARIABLES:"
    echo "  - APP_BASE_URL"
    echo "  - FRONTEND_BASE_URL"
    echo "  - LOG_LEVEL"
    echo "  - ENABLE_METRICS"
    echo
    
    read -p "Press Enter when you've configured the environment variables..."
    
    print_success "Environment variables configuration completed!"
}

# Start canary testing
start_canary_testing() {
    print_header "STARTING CANARY TESTING"
    
    print_status "Canary testing will run for 2 hours to validate the deployment."
    echo
    echo "🐦 CANARY TESTING PLAN:"
    echo "  Phase 1 (0-15min): OAuth + Webhooks test"
    echo "  Phase 2 (15-45min): Import piccola (100 righe)"
    echo "  Phase 3 (45-90min): Chiamate outbound/inbound"
    echo "  Phase 4 (90-120min): Decisione finale"
    echo
    
    read -p "Start canary testing now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Starting canary testing..."
        
        # Set environment variables for canary testing
        export BACKEND_URL=${BACKEND_URL:-"https://api.agoralia.app"}
        export FRONTEND_URL=${FRONTEND_URL:-"https://app.agoralia.com"}
        export WORKSPACE_ID="ws_pilot_1"
        
        # Start canary testing
        ./canary_testing.sh
        
        if [[ $? -eq 0 ]]; then
            print_success "Canary testing completed successfully!"
        else
            print_error "Canary testing failed!"
            exit 1
        fi
    else
        print_warning "Canary testing skipped. You can run it manually later with:"
        echo "  ./canary_testing.sh"
    fi
}

# Post-deployment verification
post_deployment_verification() {
    print_header "POST-DEPLOYMENT VERIFICATION"
    
    print_status "Verifying deployment..."
    
    # Check backend health
    if [[ -n "$BACKEND_URL" ]]; then
        print_status "Checking backend health..."
        if curl -s "$BACKEND_URL/health" > /dev/null; then
            print_success "Backend health check passed"
        else
            print_warning "Backend health check failed"
        fi
    fi
    
    # Check frontend accessibility
    if [[ -n "$FRONTEND_URL" ]]; then
        print_status "Checking frontend accessibility..."
        if curl -s "$FRONTEND_URL" > /dev/null; then
            print_success "Frontend accessibility check passed"
        else
            print_warning "Frontend accessibility check failed"
        fi
    fi
    
    print_success "Post-deployment verification completed!"
}

# Main deployment flow
main() {
    echo "🚀 ColdAI CRM Integrations - MAIN DEPLOYMENT SCRIPT"
    echo "=================================================="
    echo "🎯 Sprint 9: CRM Core Integrations + Ottimizzazioni Last-Mile"
    echo "🐦 Canary Deployment Strategy"
    echo
    
    # Check prerequisites
    check_prerequisites
    
    echo
    # Pre-deployment checklist
    pre_deployment_checklist
    
    echo
    # Deploy backend
    deploy_backend
    
    echo
    # Deploy frontend
    deploy_frontend
    
    echo
    # Configure environment
    configure_environment
    
    echo
    # Post-deployment verification
    post_deployment_verification
    
    echo
    # Start canary testing
    start_canary_testing
    
    echo
    print_header "DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉"
    
    echo
    echo "🎯 NEXT STEPS:"
    echo "  1. Monitor canary testing progress"
    echo "  2. Watch metrics and health checks"
    echo "  3. Be ready for incident response if needed"
    echo "  4. Prepare for go-live decision after 2 hours"
    echo
    echo "📚 DOCUMENTATION:"
    echo "  - Deployment Checklist: DEPLOYMENT_CHECKLIST.md"
    echo "  - Rollback Runbook: ROLLBACK_RUNBOOK.md"
    echo "  - Canary Testing: ./canary_testing.sh"
    echo
    echo "🚨 EMERGENCY:"
    echo "  - Rollback Runbook: ROLLBACK_RUNBOOK.md"
    echo "  - Emergency procedures documented"
    echo "  - Team escalation matrix ready"
    echo
    echo "🎉 SUCCESS! Sprint 9 is now deployed and under canary testing!"
    echo
    echo "Status: 🟢 DEPLOYED - CANARY TESTING ACTIVE"
}

# Run main function
main "$@"
