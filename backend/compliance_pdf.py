"""
Compliance PDF generation for Agoralia
Generates PDF attestations for compliance requirements
"""
import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import hashlib

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False
    print("Warning: WeasyPrint not available. PDF generation will use fallback.")

class CompliancePDFGenerator:
    """Generate compliance PDF attestations"""
    
    def __init__(self):
        self.template_dir = os.path.join(os.path.dirname(__file__), 'templates')
        self.output_dir = os.path.join(os.path.dirname(__file__), 'output')
        
        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)
    
    def generate_attestation_pdf(self, workspace_id: str, campaign_id: Optional[str], 
                                iso: str, inputs: Dict[str, Any], 
                                signed_by_user_id: str) -> Dict[str, Any]:
        """Generate compliance attestation PDF"""
        
        # Generate unique attestation ID
        attestation_id = f"att_{workspace_id}_{iso}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create attestation data
        attestation_data = {
            'id': attestation_id,
            'workspace_id': workspace_id,
            'campaign_id': campaign_id,
            'iso': iso.upper(),
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'signed_by_user_id': signed_by_user_id,
            'inputs': inputs,
            'compliance_rules': self._get_compliance_rules(iso),
            'hash': None  # Will be set after generation
        }
        
        # Generate HTML content
        html_content = self._generate_html_content(attestation_data)
        
        # Generate PDF
        pdf_path = self._generate_pdf(html_content, attestation_id)
        
        # Calculate SHA256 hash
        with open(pdf_path, 'rb') as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()
        
        attestation_data['hash'] = f"sha256:{file_hash}"
        attestation_data['pdf_path'] = pdf_path
        
        return attestation_data
    
    def _get_compliance_rules(self, iso: str) -> Dict[str, Any]:
        """Get compliance rules for specific country"""
        rules = {
            'US': {
                'name': 'United States',
                'regulations': ['TCPA', 'CAN-SPAM', 'FCC Rules'],
                'quiet_hours': '8:00 AM - 9:00 PM local time',
                'dnc_required': True,
                'consent_required': True,
                'caller_id_rules': 'Valid returnable CLI required'
            },
            'IT': {
                'name': 'Italy',
                'regulations': ['GDPR', 'Italian Privacy Code', 'D.Lgs. 196/2003'],
                'quiet_hours': '9:00 AM - 8:00 PM local time',
                'dnc_required': True,
                'consent_required': True,
                'caller_id_rules': 'No anonymous CLI allowed'
            },
            'UK': {
                'name': 'United Kingdom',
                'regulations': ['PECR', 'GDPR', 'ICO Guidelines'],
                'quiet_hours': '8:00 AM - 9:00 PM local time',
                'dnc_required': True,
                'consent_required': True,
                'caller_id_rules': 'Valid returnable CLI required'
            }
        }
        return rules.get(iso.upper(), rules['US'])
    
    def _generate_html_content(self, attestation_data: Dict[str, Any]) -> str:
        """Generate HTML content for PDF"""
        
        rules = attestation_data['compliance_rules']
        campaign_info = f"Campaign: {attestation_data['campaign_id']}" if attestation_data['campaign_id'] else "General Workspace"
        
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Compliance Attestation - {rules['name']}</title>
            <style>
                body {{
                    font-family: 'Arial', sans-serif;
                    line-height: 1.6;
                    margin: 40px;
                    color: #333;
                }}
                .header {{
                    text-align: center;
                    border-bottom: 3px solid #2563eb;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }}
                .header h1 {{
                    color: #2563eb;
                    margin: 0;
                    font-size: 28px;
                }}
                .header .subtitle {{
                    color: #6b7280;
                    font-size: 16px;
                    margin-top: 10px;
                }}
                .section {{
                    margin-bottom: 25px;
                }}
                .section h2 {{
                    color: #1f2937;
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 8px;
                    font-size: 20px;
                }}
                .info-grid {{
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin: 15px 0;
                }}
                .info-item {{
                    background: #f9fafb;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #2563eb;
                }}
                .info-label {{
                    font-weight: bold;
                    color: #374151;
                    margin-bottom: 5px;
                }}
                .info-value {{
                    color: #6b7280;
                }}
                .rules-list {{
                    background: #fef3c7;
                    padding: 20px;
                    border-radius: 8px;
                    border-left: 4px solid #f59e0b;
                }}
                .rules-list h3 {{
                    color: #92400e;
                    margin-top: 0;
                }}
                .rules-list ul {{
                    margin: 10px 0;
                    padding-left: 20px;
                }}
                .rules-list li {{
                    margin-bottom: 8px;
                    color: #92400e;
                }}
                .attestation {{
                    background: #ecfdf5;
                    padding: 20px;
                    border-radius: 8px;
                    border-left: 4px solid #10b981;
                    margin: 25px 0;
                }}
                .attestation h3 {{
                    color: #065f46;
                    margin-top: 0;
                }}
                .signature {{
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }}
                .signature .checkbox {{
                    margin-bottom: 15px;
                }}
                .signature .checkbox input {{
                    margin-right: 10px;
                }}
                .footer {{
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    color: #6b7280;
                    font-size: 12px;
                }}
                .hash {{
                    font-family: monospace;
                    background: #f3f4f6;
                    padding: 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    word-break: break-all;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Compliance Attestation</h1>
                <div class="subtitle">
                    {rules['name']} - {campaign_info}<br>
                    Generated: {datetime.fromisoformat(attestation_data['generated_at']).strftime('%B %d, %Y at %I:%M %p UTC')}
                </div>
            </div>
            
            <div class="section">
                <h2>Campaign Information</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Workspace ID</div>
                        <div class="info-value">{attestation_data['workspace_id']}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Country</div>
                        <div class="info-value">{rules['name']} ({attestation_data['iso']})</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Campaign</div>
                        <div class="info-value">{campaign_info}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Generated By</div>
                        <div class="info-value">User {attestation_data['signed_by_user_id']}</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Applicable Regulations</h2>
                <div class="rules-list">
                    <h3>Compliance Rules for {rules['name']}</h3>
                    <ul>
                        <li><strong>Regulations:</strong> {', '.join(rules['regulations'])}</li>
                        <li><strong>Quiet Hours:</strong> {rules['quiet_hours']}</li>
                        <li><strong>DNC Check:</strong> {'Required' if rules['dnc_required'] else 'Not Required'}</li>
                        <li><strong>Consent Required:</strong> {'Yes' if rules['consent_required'] else 'No'}</li>
                        <li><strong>Caller ID Rules:</strong> {rules['caller_id_rules']}</li>
                    </ul>
                </div>
            </div>
            
            <div class="section">
                <h2>User Inputs & Declarations</h2>
                <div class="info-grid">
        """
        
        # Add user inputs
        for key, value in attestation_data['inputs'].items():
            html += f"""
                    <div class="info-item">
                        <div class="info-label">{key.replace('_', ' ').title()}</div>
                        <div class="info-value">{value}</div>
                    </div>
            """
        
        html += """
                </div>
            </div>
            
            <div class="attestation">
                <h3>Compliance Attestation</h3>
                <p>By checking the box below, I confirm that:</p>
                <ul>
                    <li>I have reviewed and understand the compliance requirements for the target country</li>
                    <li>All necessary consents and permissions have been obtained</li>
                    <li>DNC lists have been checked where required</li>
                    <li>Quiet hours restrictions will be respected</li>
                    <li>Caller ID requirements are met</li>
                    <li>All local regulations and best practices will be followed</li>
                </ul>
                
                <div class="signature">
                    <div class="checkbox">
                        <input type="checkbox" id="compliance_attest" checked disabled>
                        <label for="compliance_attest">
                            <strong>I confirm compliance with all applicable regulations and take full responsibility for this campaign.</strong>
                        </label>
                    </div>
                    
                    <div class="checkbox">
                        <input type="checkbox" id="data_consent" checked disabled>
                        <label for="data_consent">
                            I confirm that data processing follows GDPR and local privacy laws
                        </label>
                    </div>
                    
                    <div class="checkbox">
                        <input type="checkbox" id="record_consent" checked disabled>
                        <label for="record_consent">
                            I confirm that call recording consent will be obtained where required
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Document Hash:</strong></p>
                <div class="hash">{attestation_data['hash'] or 'Pending generation'}</div>
                <p>This document serves as a compliance attestation and should be retained for audit purposes.</p>
                <p>Generated by Agoralia Compliance System</p>
            </div>
        </body>
        </html>
        """
        
        return html
    
    def _generate_pdf(self, html_content: str, filename: str) -> str:
        """Generate PDF from HTML content"""
        
        if WEASYPRINT_AVAILABLE:
            # Use WeasyPrint for high-quality PDF generation
            html = HTML(string=html_content)
            css = CSS(string='@page { size: A4; margin: 1in; }')
            
            pdf_path = os.path.join(self.output_dir, f"{filename}.pdf")
            html.write_pdf(pdf_path, stylesheets=[css])
            
            return pdf_path
        else:
            # Fallback: save as HTML file
            html_path = os.path.join(self.output_dir, f"{filename}.html")
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            print(f"Warning: WeasyPrint not available. Saved HTML to {html_path}")
            return html_path

def generate_test_attestation():
    """Generate a test attestation for development"""
    generator = CompliancePDFGenerator()
    
    test_inputs = {
        'notice_version': 'it-2025-01-01',
        'consent_mechanism': 'Opt-in checkbox on website',
        'dnc_check_method': 'Real-time API integration',
        'quiet_hours_respect': 'Automated scheduling system',
        'caller_id_verification': 'E.164 validation + provider verification'
    }
    
    attestation = generator.generate_attestation_pdf(
        workspace_id='ws_test',
        campaign_id='campaign_it_sales',
        iso='IT',
        inputs=test_inputs,
        signed_by_user_id='admin_user'
    )
    
    print(f"✅ Generated attestation: {attestation['pdf_path']}")
    print(f"📄 Hash: {attestation['hash']}")
    
    return attestation

if __name__ == "__main__":
    generate_test_attestation()
