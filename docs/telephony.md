# Telephony System Documentation

## Overview

The telephony system manages phone numbers, providers, and outbound calling policies with support for hosted and verified CLI numbers.

## Outbound Policy

### Current Policy: `(Hosted) OR (Verified CLI)`

- **Hosted**: Numbers purchased through Agoralia providers (always allowed for outbound)
- **Verified CLI**: BYO numbers verified with the provider (allowed for outbound after verification)
- **Feature Flag**: `TELEPHONY_OUTBOUND_VERIFIED_ENABLED=true` (default: enabled)

### Policy Enforcement

```python
# In backend/services/telephony.py
def enforce_outbound_policy(number) -> None:
    # Checks: outbound_enabled, hosted OR verified_cli, country/provider rules
```

## API Endpoints

### Verify CLI
- **Endpoint**: `POST /settings/telephony/numbers/verify-cli`
- **Payload**: `{"number_id": "uuid"}`
- **Response**: `{"ok": true, "verified_cli": true}`
- **Rate Limit**: 5 requests/minute per user
- **Idempotent**: Returns success if already verified

### Campaign Caller ID
- **Endpoint**: `PATCH /campaigns/{cid}/from_number`
- **Validation**: Number must belong to workspace, be outbound-enabled, and (hosted OR verified)
- **Payload**: `{"e164": "+1234567890"}`

## Pass-through Pricing

- **Zero Markup**: Purchase/rental operations have `amount_cents=0`
- **Ledger**: Marked with `pass_through=true` in metadata
- **Provider Billing**: Direct billing to customer's provider account

## Provider Support

### Twilio
- **CLI Verification**: Outgoing Caller ID verification
- **Coverage**: Live inventory via API
- **Regulations**: Dynamic from Twilio API

### Telnyx
- **CLI Verification**: Number verification API
- **Coverage**: Static JSON file (`backend/static/telephony/telnyx_coverage.json`)
- **Regulations**: Static requirements per country

## Country Rules Hook

```python
def is_country_outbound_blocked(country_code: str, provider: str) -> bool:
    # Extensible: add country/provider specific restrictions
    return False
```

## Environment Variables

- `TELEPHONY_OUTBOUND_VERIFIED_ENABLED`: Enable/disable verified CLI policy (default: true)
- `DEMO_MODE`: Disable telephony operations in demo mode

## Database Schema

### Numbers Table
- `hosted`: Boolean (default: false)
- `verified_cli`: Boolean (default: false)
- `outbound_enabled`: Boolean
- `phone_e164`: String (E.164 format)

## Security

- **Workspace Isolation**: All operations scoped to user's workspace
- **Rate Limiting**: Anti-abuse protection on verify-cli endpoint
- **Audit Trail**: CLI verification events logged
- **Input Validation**: E.164 format validation

## Frontend Components

- **BindControls**: Outbound policy enforcement UI
- **NumbersRowActions**: Verify CLI button for BYO numbers
- **CampaignCreateDialog**: Caller ID selection with validation
- **SettingsTelephony**: Zero markup badge and provider management

## Testing

### Backend Tests
- Policy enforcement with different number states
- Verify CLI idempotency
- Campaign caller ID validation
- Rate limiting

### Frontend Tests
- Component rendering with different number states
- Verify CLI flow
- Campaign creation with caller ID

### E2E Tests
- Complete verify CLI workflow
- Campaign creation and test call
