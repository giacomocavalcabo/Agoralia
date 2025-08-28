from twilio.rest import Client
from backend.models import ProviderAccount

class TwilioNumbersAdapter:
    def __init__(self, account: ProviderAccount):
        # Use api_key_id/api_key_secret if available, otherwise fallback to sid/token
        if hasattr(account, 'api_key_id') and account.api_key_id:
            self.client = Client(account.api_key_id, account.api_key_secret)
        else:
            # Fallback to legacy sid/token
            self.client = Client(account.sid, account.token)

    def search(self, country, number_type, area_code=None, contains=None, limit=25):
        """Search available phone numbers"""
        try:
            rsrc = getattr(self.client.available_phone_numbers(country), number_type)  # 'local'|'mobile'|'toll_free'
            params = {}
            if area_code:
                params['area_code'] = area_code
            if contains:
                params['contains'] = contains
            
            numbers = rsrc.list(limit=limit, **params)
            return [{
                'phone_number': n.phone_number,
                'friendly_name': getattr(n, 'friendly_name', None),
                'region': getattr(n, 'region', None),
                'capabilities': getattr(n, 'capabilities', {}),
                'iso_country': country
            } for n in numbers]
        except Exception as e:
            import logging
            logging.error(f"Twilio search failed: {e}")
            return []

    def purchase(self, country, number):
        """Purchase a phone number"""
        try:
            # Create IncomingPhoneNumber
            incoming_number = self.client.incoming_phone_numbers.create(
                phone_number=number
            )
            return {
                'sid': incoming_number.sid,
                'phone_number': incoming_number.phone_number,
                'status': 'active'
            }
        except Exception as e:
            import logging
            logging.error(f"Twilio purchase failed: {e}")
            raise

    def import_existing(self, e164):
        """Import existing number (not implemented - use porting workflow)"""
        # Twilio: Hosted SMS o Porting API (complesso) -> per ora raise NotImplemented
        raise NotImplementedError("Use porting workflow for existing numbers")
