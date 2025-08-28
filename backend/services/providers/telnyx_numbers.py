import telnyx
from backend.models import ProviderAccount

class TelnyxNumbersAdapter:
    def __init__(self, account: ProviderAccount):
        # Set API key for Telnyx client
        telnyx.api_key = account.api_key_secret

    def search(self, country, number_type, area_code=None, contains=None, limit=25):
        """Search available phone numbers"""
        try:
            # telnyx.available_phone_numbers.search(...) — implementa quando utile
            # For now, return empty array
            import logging
            logging.info(f"Telnyx search not yet implemented for {country} {number_type}")
            return []
        except Exception as e:
            import logging
            logging.error(f"Telnyx search failed: {e}")
            return []

    def purchase(self, country, number):
        """Purchase a phone number"""
        try:
            # telnyx.NumberOrder.create(...) — implementa quando utile
            # For now, return mock response
            import logging
            logging.info(f"Telnyx purchase not yet implemented for {number}")
            return {
                'id': f"telnyx_{int(__import__('time').time())}",
                'phone_number': number,
                'status': 'pending'
            }
        except Exception as e:
            import logging
            logging.error(f"Telnyx purchase failed: {e}")
            raise

    def import_existing(self, e164):
        """Import existing number (not implemented - use porting workflow)"""
        # Telnyx porting API — richiede pratica. Per ora:
        raise NotImplementedError("Use porting workflow for existing numbers")
