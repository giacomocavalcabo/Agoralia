import phonenumbers
from typing import Optional, Dict, Any
import re

def normalize_phone_number(phone: str, default_country: str = 'IT') -> Dict[str, Any]:
    """
    Normalize phone number to E.164 format with validation
    
    Args:
        phone: Raw phone number string
        default_country: Default country code (e.g., 'IT')
    
    Returns:
        Dict with normalized data:
        {
            'e164': str,           # E.164 format (+39...)
            'is_valid': bool,      # Is valid phone number
            'country': str,        # Country code
            'type': str,           # Phone type (MOBILE, FIXED_LINE, etc.)
            'national': str,       # National format
            'international': str,  # International format
            'error': str           # Error message if any
        }
    """
    if not phone or not isinstance(phone, str):
        return {
            'e164': None,
            'is_valid': False,
            'country': None,
            'type': None,
            'national': None,
            'international': None,
            'error': 'Invalid input'
        }
    
    # Clean the input
    clean_phone = phone.strip()
    
    # Handle common prefixes and formats
    if clean_phone.startswith('0039'):
        clean_phone = '+' + clean_phone[2:]
    elif clean_phone.startswith('39') and not clean_phone.startswith('+39'):
        clean_phone = '+' + clean_phone
    elif clean_phone.startswith('0') and default_country == 'IT':
        # Italian numbers starting with 0
        clean_phone = '+39' + clean_phone[1:]
    
    try:
        # Parse phone number
        phone_number = phonenumbers.parse(clean_phone, default_country)
        
        if phonenumbers.is_valid_number(phone_number):
            # Get phone type
            phone_type = phonenumbers.number_type(phone_number)
            type_names = {
                phonenumbers.PhoneNumberType.MOBILE: 'MOBILE',
                phonenumbers.PhoneNumberType.FIXED_LINE: 'FIXED_LINE',
                phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE: 'FIXED_LINE_OR_MOBILE',
                phonenumbers.PhoneNumberType.TOLL_FREE: 'TOLL_FREE',
                phonenumbers.PhoneNumberType.PREMIUM_RATE: 'PREMIUM_RATE',
                phonenumbers.PhoneNumberType.SHARED_COST: 'SHARED_COST',
                phonenumbers.PhoneNumberType.VOIP: 'VOIP',
                phonenumbers.PhoneNumberType.PERSONAL_NUMBER: 'PERSONAL_NUMBER',
                phonenumbers.PhoneNumberType.PAGER: 'PAGER',
                phonenumbers.PhoneNumberType.UAN: 'UAN',
                phonenumbers.PhoneNumberType.UNKNOWN: 'UNKNOWN'
            }
            
            return {
                'e164': phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.E164),
                'is_valid': True,
                'country': phonenumbers.region_code_for_number(phone_number),
                'type': type_names.get(phone_type, 'UNKNOWN'),
                'national': phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.NATIONAL),
                'international': phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.INTERNATIONAL),
                'error': None
            }
        else:
            return {
                'e164': None,
                'is_valid': False,
                'country': None,
                'type': None,
                'national': None,
                'international': None,
                'error': 'Invalid phone number'
            }
            
    except phonenumbers.NumberParseException as e:
        return {
            'e164': None,
            'is_valid': False,
            'country': None,
            'type': None,
            'national': None,
            'international': None,
            'error': f'Parse error: {str(e)}'
        }
    except Exception as e:
        return {
            'e164': None,
            'is_valid': False,
            'country': None,
            'type': None,
            'national': None,
            'international': None,
            'error': f'Unexpected error: {str(e)}'
        }

def validate_phone_number(phone: str, default_country: str = 'IT') -> bool:
    """Quick validation without full normalization"""
    try:
        phone_number = phonenumbers.parse(phone, default_country)
        return phonenumbers.is_valid_number(phone_number)
    except:
        return False

def extract_country_code(phone: str) -> Optional[str]:
    """Extract country code from phone number"""
    try:
        phone_number = phonenumbers.parse(phone)
        return phonenumbers.region_code_for_number(phone_number)
    except:
        return None

def format_phone_number(phone: str, format_type: str = 'E164', default_country: str = 'IT') -> Optional[str]:
    """
    Format phone number to different formats
    
    Args:
        phone: Phone number to format
        format_type: 'E164', 'NATIONAL', 'INTERNATIONAL'
        default_country: Default country code
    
    Returns:
        Formatted phone number string or None
    """
    try:
        phone_number = phonenumbers.parse(phone, default_country)
        
        if phonenumbers.is_valid_number(phone_number):
            if format_type == 'E164':
                return phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.E164)
            elif format_type == 'NATIONAL':
                return phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.NATIONAL)
            elif format_type == 'INTERNATIONAL':
                return phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
            else:
                return phonenumbers.format_number(phone_number, phonenumbers.PhoneNumberFormat.E164)
    except:
        return None

def is_mobile_number(phone: str, default_country: str = 'IT') -> bool:
    """Check if phone number is mobile"""
    try:
        phone_number = phonenumbers.parse(phone, default_country)
        if phonenumbers.is_valid_number(phone_number):
            phone_type = phonenumbers.number_type(phone_number)
            return phone_type in [
                phonenumbers.PhoneNumberType.MOBILE,
                phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE
            ]
        return False
    except:
        return False
