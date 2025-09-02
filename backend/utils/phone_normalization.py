"""
Phone number normalization utilities
"""
import re
from typing import Optional

def normalize_e164(phone: str) -> Optional[str]:
    """
    Normalize phone number to E.164 format
    
    Args:
        phone: Phone number in any format
        
    Returns:
        E.164 formatted number or None if invalid
    """
    if not phone:
        return None
    
    # Remove all non-digit characters except +
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    # If it starts with +, it's already international
    if cleaned.startswith('+'):
        # Validate E.164 format (1-15 digits after +)
        digits = cleaned[1:]
        if len(digits) >= 1 and len(digits) <= 15 and digits.isdigit():
            return cleaned
        return None
    
    # If it's all digits, assume it needs country code
    if cleaned.isdigit():
        # Common country codes
        if len(cleaned) == 10 and cleaned.startswith(('2', '3', '4', '5', '6', '7', '8', '9')):
            # Likely US number
            return f"+1{cleaned}"
        elif len(cleaned) == 11 and cleaned.startswith('1'):
            # US number with country code
            return f"+{cleaned}"
        elif len(cleaned) >= 7 and len(cleaned) <= 15:
            # International number without country code - can't auto-detect
            return None
    
    return None

def validate_e164(phone: str) -> bool:
    """
    Validate if phone number is in E.164 format
    
    Args:
        phone: Phone number to validate
        
    Returns:
        True if valid E.164 format
    """
    if not phone:
        return False
    
    # E.164 format: + followed by 1-15 digits
    pattern = r'^\+[1-9]\d{0,14}$'
    return bool(re.match(pattern, phone))

def format_phone_display(phone: str) -> str:
    """
    Format phone number for display (adds spaces for readability)
    
    Args:
        phone: E.164 phone number
        
    Returns:
        Formatted phone number for display
    """
    if not phone or not phone.startswith('+'):
        return phone
    
    # Add spaces every 3 digits for readability
    country_code = phone[:2]  # +1, +39, etc.
    number = phone[2:]
    
    # Group digits in threes
    formatted = country_code
    for i in range(0, len(number), 3):
        formatted += f" {number[i:i+3]}"
    
    return formatted.strip()
