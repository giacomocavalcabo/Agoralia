# Agoralia - AI-Powered Outbound Calling Platform

A modern, compliance-first platform for AI-powered outbound calling with structured outcomes and phone number management.

## 🚀 Features

### Phone Numbers (Provisioning & Caller ID)
- **BYO (Bring Your Own)**: Verify your own numbers with voice/SMS verification
- **Number Purchase**: Buy numbers through Agoralia with country-specific compliance
- **KYC Integration**: Automated KYC verification for regulated countries
- **Inbound Routing**: Configure routing to agents, business hours, and voicemail
- **Compliance Preflight**: Real-time compliance checks before call placement

### Structured Call Outcomes
- **AI-Powered Extraction**: LLM-based outcome extraction from call transcripts
- **Template System**: Pre-built templates (Sales, Support, Booking) + custom fields
- **CRM Integration**: HubSpot, Zoho, Odoo sync with field mapping
- **Post-call Review**: Rich UI for reviewing and editing call outcomes
- **Export & Analytics**: Filter, search, and export outcomes with metrics

### Admin Console
- **Global Visibility**: Monitor all users, workspaces, calls, and campaigns
- **Compliance Management**: Generate PDF attestations, view preflight logs
- **User Management**: Impersonation, role management, account suspension
- **Notifications**: Bulk email/in-app notifications with delivery tracking
- **Search & Filters**: Unified global search across all entities

### Modern Authentication
- **Multi-method**: Password, Magic Link, OAuth, Passkey, TOTP 2FA
- **RBAC**: Role-based access control at workspace level
- **Session Management**: Redis-backed sessions with CSRF protection
- **SSO Ready**: SAML integration for enterprise customers

## 🏗️ Architecture

### Backend
- **FastAPI**: Modern Python web framework
- **PostgreSQL**: Primary database with Alembic migrations
- **Redis**: Session store and task queues
- **Dramatiq**: Background task processing
- **SQLAlchemy**: ORM with repository pattern

### Frontend
- **React 18**: Modern UI with hooks and context
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: High-quality component library
- **i18n**: Multi-language support (EN, IT, FR, AR, HI)

### Integrations
- **Retell**: AI calling provider integration
- **Postmark/SendGrid**: Email delivery
- **Chromium Headless**: PDF generation for compliance docs

## 📋 Requirements

### Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

Key packages:
- `fastapi==0.104.1` - Web framework
- `chromium` - PDF generation via headless browser
- `dramatiq[redis]==1.15.0` - Task queues
- `bcrypt==4.1.2` - Password hashing

### Frontend Dependencies
```bash
cd frontend
npm install
```

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://user:pass@localhost/agoralia"
export REDIS_URL="redis://localhost:6379"
export ADMIN_EMAILS="admin@example.com"

# Run migrations
alembic upgrade head

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Set API base URL
export VITE_API_BASE_URL="http://localhost:8000"

# Start dev server
npm run dev
```

### 3. Background Workers
```bash
cd backend

# Start Dramatiq worker
dramatiq worker
```

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/agoralia

# Redis
REDIS_URL=redis://localhost:6379

# Admin Access
ADMIN_EMAILS=admin@example.com,admin2@example.com

# Email Providers
EMAIL_PROVIDER=postmark  # or sendgrid
POSTMARK_TOKEN=your_token
SENDGRID_API_KEY=your_key

# Retell Integration
RETELL_API_KEY=your_key
RETELL_WEBHOOK_SECRET=your_secret
```

### Compliance Rules
Country-specific compliance rules are configured in `backend/data/compliance/`:
- `raw/` - Source CSV files from compliance databases
- `rules.v1.json` - Compiled rules for runtime use

## 📱 Usage

### Phone Numbers
1. **Add BYO Number**: Enter E.164, verify via voice/SMS
2. **Buy Number**: Select country, type, capabilities
3. **Configure Routing**: Set agent, hours, voicemail
4. **Set Default**: Choose default caller ID for workspace

### Campaigns
1. **Create Campaign**: Name, goal, language, template
2. **Select Template**: Choose outcome template (Sales, Support, etc.)
3. **Configure Compliance**: Set quiet hours, DNC checks
4. **Launch**: Start calling with AI agents

### Outcomes
1. **AI Extraction**: Automatic outcome extraction post-call
2. **Review & Edit**: Human review and editing of outcomes
3. **CRM Sync**: Automatic sync to configured CRM systems
4. **Analytics**: Filter, export, and analyze call results

## 🧪 Testing

### Run Test Stubs
```bash
cd backend
python test_stubs.py
```

### Test PDF Generation
```bash
cd backend
python compliance_pdf.py
```

## 📊 API Endpoints

### Phone Numbers
- `POST /numbers/byo` - Verify BYO number
- `POST /numbers/buy` - Purchase number
- `POST /numbers/:id/route` - Configure routing
- `GET /numbers` - List workspace numbers

### Outcomes
- `GET /calls/:id/outcome` - Get call outcome
- `PATCH /calls/:id/outcome` - Edit outcome
- `GET /outcomes` - List outcomes with filters
- `POST /templates` - Create outcome template

### Admin
- `GET /admin/search` - Global search
- `POST /admin/compliance/attestations/generate` - Generate PDF
- `GET /admin/users` - List users
- `POST /admin/notifications/send` - Send notifications

## 🔒 Security & Compliance

### Authentication
- HttpOnly cookies with CSRF protection
- Session-based authentication with Redis
- Role-based access control (RBAC)
- Impersonation for admin support

### Compliance
- Real-time DNC checking
- Quiet hours enforcement
- Caller ID validation
- GDPR/privacy law compliance
- Audit logging for all actions

### Data Protection
- E.164 number hashing for compliance reports
- PII minimization in exports
- Encrypted storage of sensitive data
- Regular security audits

## 🚀 Deployment

### Railway (Recommended)
```bash
# Deploy to Railway
railway up
```

### Docker
```bash
# Build and run
docker-compose up -d
```

### Manual
```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port $PORT

# Frontend
cd frontend
npm run build
serve -s dist -l $PORT
```

## 📈 Monitoring

### Health Checks
- Database connectivity
- Redis availability
- External API status
- Worker queue health

### Metrics
- Call success rates
- Outcome extraction accuracy
- Compliance violation rates
- System performance

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: [docs.agoralia.ai](https://docs.agoralia.ai)
- **Issues**: GitHub Issues
- **Email**: support@agoralia.ai

---

**Built with ❤️ by the Agoralia team**
