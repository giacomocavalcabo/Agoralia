#!/usr/bin/env python3
"""
Script to update the main compliance CSV file with new data
"""

import csv
import os
from pathlib import Path

def read_csv_file(file_path):
    """Read a CSV file and return its content as a list of dictionaries"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None

def write_csv_file(file_path, data, fieldnames):
    """Write data to a CSV file"""
    try:
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
        print(f"Successfully saved {file_path}")
    except Exception as e:
        print(f"Error saving {file_path}: {e}")

def update_compliance_csv():
    """Update the main compliance CSV file with new data"""
    
    # Paths
    base_dir = Path(__file__).parent.parent / "data" / "compliance" / "raw"
    main_csv_file = base_dir / "compliance_global.csv"
    
    # Read existing CSV
    print("Reading existing compliance CSV...")
    existing_data = read_csv_file(main_csv_file)
    if not existing_data:
        return False
    
    # Get fieldnames from existing data
    fieldnames = list(existing_data[0].keys())
    print(f"CSV has {len(fieldnames)} columns: {fieldnames}")
    
    # New data to add (from the user's CSV data)
    new_data = [
        {
            "Continent": "Asia",
            "Country": "Afghanistan",
            "ISO2": "AF",
            "Regime_B2C": "No specific telemarketing regulation found",
            "opt_in_or_out_B2C": "Opt-out (assume allowed by default)",
            "Regime_B2B": "No specific B2B telemarketing law found",
            "opt_in_or_out_B2B": "Opt-out (assume allowed)",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "Unknown",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "Unknown",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (privacy generally protected)",
            "Existing_Relationship_Exemption": "N/A",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Low",
            "Primary_Sources": "(no sources found)",
            "Notes_for_Product": "No public info; assume minimal restrictions."
        },
        {
            "Continent": "Asia",
            "Country": "Burundi",
            "ISO2": "BI",
            "Regime_B2C": "No specific telemarketing regulation; general consumer protections exist",
            "opt_in_or_out_B2C": "Opt-out (calls allowed by default)",
            "Regime_B2B": "No specific B2B telemarketing regulation found",
            "opt_in_or_out_B2B": "Opt-out (calls allowed)",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "Unknown",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "Unknown",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (privacy of communications emphasized)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Medium",
            "Primary_Sources": "ARCT (Burundi) (FR)",
            "Notes_for_Product": "Consumer has right to tranquility (no abusive calls)."
        },
        {
            "Continent": "Asia",
            "Country": "Brunei",
            "ISO2": "BN",
            "Regime_B2C": "Personal Data Protection Order 2025 mandates consent for calls",
            "opt_in_or_out_B2C": "Opt-in (explicit consent required)",
            "Regime_B2B": "Not addressed by current laws",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Depends (no clear rule)",
            "Recording_Basis": "No explicit rule (assume one-party)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "No exceptions",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "PDPO 2025 (effective Jan 2025)",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "2025-01-08",
            "Confidence": "High",
            "Primary_Sources": "Brunei PDPO 2025 (EN)",
            "Notes_for_Product": "PDPO requires prior consent for marketing calls."
        },
        {
            "Continent": "Asia",
            "Country": "Kyrgyzstan",
            "ISO2": "KG",
            "Regime_B2C": "Advertising to consumers requires prior consent",
            "opt_in_or_out_B2C": "Opt-in (consent required)",
            "Regime_B2B": "Not explicitly regulated",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (privacy of calls guaranteed)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "High",
            "Primary_Sources": "Advertising Law (KG) (RU); PD Law (EN)",
            "Notes_for_Product": "Ads by paid info services only with subscriber consent; PD law implies privacy."
        },
        {
            "Continent": "Asia",
            "Country": "Comoros",
            "ISO2": "KM",
            "Regime_B2C": "No specific telemarketing regulation found",
            "opt_in_or_out_B2C": "Opt-out (calls allowed by default)",
            "Regime_B2B": "Not addressed",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "Unknown",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (telecoms confidential by constitution)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Medium",
            "Primary_Sources": "Constitution Art.27 (EN)",
            "Notes_for_Product": "Confidentiality of communications guaranteed; no telemarketing rules found."
        },
        {
            "Continent": "Asia",
            "Country": "North Korea",
            "ISO2": "KP",
            "Regime_B2C": "State-run telecom; no consumer marketing law",
            "opt_in_or_out_B2C": "N/A",
            "Regime_B2B": "Not applicable",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "N/A",
            "Recording_Basis": "Strict state surveillance; no privacy rights",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Low",
            "Primary_Sources": "Amnesty Int'l (EN)",
            "Notes_for_Product": "All telecoms under state control; assume no marketing allowed."
        },
        {
            "Continent": "Asia",
            "Country": "Kazakhstan",
            "ISO2": "KZ",
            "Regime_B2C": "No special telemarketing law (calls allowed)",
            "opt_in_or_out_B2C": "Opt-out (no consent requirement)",
            "Regime_B2B": "Not specifically regulated",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (privacy of calls guaranteed)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "2014-01-12",
            "Confidence": "Medium",
            "Primary_Sources": "NV (Kazakh ad law) (RU); Constitution Art.31 (RU)",
            "Notes_for_Product": "No opt-in required; calls are private."
        },
        {
            "Continent": "Asia",
            "Country": "Lesotho",
            "ISO2": "LS",
            "Regime_B2C": "No specific telemarketing regulation found",
            "opt_in_or_out_B2C": "Opt-out (calls allowed)",
            "Regime_B2B": "Not addressed",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "Unknown",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "Unknown",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (privacy protected by law)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Low",
            "Primary_Sources": "DP Act excerpts (EN)",
            "Notes_for_Product": "No telemarketing rules; protect call privacy per law."
        },
        {
            "Continent": "Asia",
            "Country": "Macau",
            "ISO2": "MO",
            "Regime_B2C": "PDPL applies; consumers may opt-out of marketing",
            "opt_in_or_out_B2C": "Opt-out (data subject can refuse)",
            "Regime_B2B": "Not regulated",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (personal data protected)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "2025-03-11",
            "Confidence": "High",
            "Primary_Sources": "Personal Data Protection Act (EN)",
            "Notes_for_Product": "Individuals can object to marketing calls."
        },
        {
            "Continent": "Asia",
            "Country": "Tajikistan",
            "ISO2": "TJ",
            "Regime_B2C": "PD law requires consent",
            "opt_in_or_out_B2C": "Opt-in (subject consent needed)",
            "Regime_B2B": "Not addressed",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (required by PD law)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "2019-04-04",
            "Confidence": "High",
            "Primary_Sources": "PD Law 2018 (EN)",
            "Notes_for_Product": "Processing of personal numbers requires consent."
        },
        {
            "Continent": "Asia",
            "Country": "Tokelau",
            "ISO2": "TK",
            "Regime_B2C": "No local telemarketing law found",
            "opt_in_or_out_B2C": "Opt-out (assume NZ law)",
            "Regime_B2B": "Not addressed",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "Unknown",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "Unknown",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (follow NZ one-party rule)",
            "Existing_Relationship_Exemption": "N/A",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Low",
            "Primary_Sources": "(no sources found)",
            "Notes_for_Product": "Use NZ approach; no Tokelau-specific info."
        },
        {
            "Continent": "Asia",
            "Country": "Timor-Leste",
            "ISO2": "TL",
            "Regime_B2C": "No specific telemarketing law found",
            "opt_in_or_out_B2C": "Opt-out (calls allowed)",
            "Regime_B2B": "Not addressed",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "Unknown",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "Unknown",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (communications inviolable)",
            "Existing_Relationship_Exemption": "N/A",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Low",
            "Primary_Sources": "Constitution Art.37 (EN)",
            "Notes_for_Product": "Privacy of calls guaranteed; no telmarketing regs."
        },
        {
            "Continent": "Asia",
            "Country": "Turkmenistan",
            "ISO2": "TM",
            "Regime_B2C": "Advertising law bans using personal data for ads",
            "opt_in_or_out_B2C": "Opt-in (personal data use prohibited)",
            "Regime_B2B": "Not specifically regulated",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (personal data protected)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "2017-07-05",
            "Confidence": "Medium",
            "Primary_Sources": "Advertising Law (Turk.) (EN)",
            "Notes_for_Product": "Personal data cannot be used for marketing."
        },
        {
            "Continent": "Asia",
            "Country": "Ukraine",
            "ISO2": "UA",
            "Regime_B2C": "Direct marketing needs consent",
            "opt_in_or_out_B2C": "Opt-in (explicit consent)",
            "Regime_B2B": "Ambiguous (no special rule)",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "No",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "N/A",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (privacy of calls)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "Draft PD law basis (Nov 2024)",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "High",
            "Primary_Sources": "Law on Protection of Consumers (marketing rules) (EN); Constitution Art.31 (EN)",
            "Notes_for_Product": "Marketing calls need consent; calls are private."
        },
        {
            "Continent": "Asia",
            "Country": "Palestine",
            "ISO2": "PS",
            "Regime_B2C": "No specific telemarketing law found",
            "opt_in_or_out_B2C": "Opt-out (calls allowed)",
            "Regime_B2B": "Not addressed",
            "opt_in_or_out_B2B": "N/A",
            "DNC_Registry_Name": "",
            "DNC_Registry_URL": "",
            "DNC_API_or_Bulk(Y/N/Unknown)": "Unknown",
            "DNC_Check_Required_for_ER(Y/N/Depends)": "Unknown",
            "Quiet_Hours(allowed_window_local)": "Not specified",
            "AIDisclosure_Required(Y/N/Depends)": "Not specified",
            "Recording_Basis": "Consent (no clear privacy law)",
            "Existing_Relationship_Exemption": "",
            "Known_Exceptions": "",
            "CallerID/Prefix_Rules": "",
            "Recent_Changes(2024+)": "",
            "Last_Verified": "2025-09-24",
            "Source_Last_Updated": "",
            "Confidence": "Low",
            "Primary_Sources": "(no sources found)",
            "Notes_for_Product": "No known rules; treat cautiously."
        }
    ]
    
    # Add new data to existing data
    print(f"Adding {len(new_data)} new countries to CSV...")
    existing_data.extend(new_data)
    
    # Save updated CSV
    print("Saving updated CSV...")
    write_csv_file(main_csv_file, existing_data, fieldnames)
    
    print(f"✅ CSV updated successfully! Total countries: {len(existing_data)}")
    return True

if __name__ == "__main__":
    print("Starting compliance CSV update...")
    success = update_compliance_csv()
    if success:
        print("✅ Compliance CSV update completed successfully!")
    else:
        print("❌ Compliance CSV update failed!")
        exit(1)
