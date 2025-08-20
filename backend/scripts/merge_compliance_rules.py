#!/usr/bin/env python3
"""
Script to merge new compliance rules into the main rules.v1.json file
"""

import json
import os
from pathlib import Path

def load_json_file(file_path):
    """Load a JSON file and return its content"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None

def save_json_file(file_path, data):
    """Save data to a JSON file"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved {file_path}")
    except Exception as e:
        print(f"Error saving {file_path}: {e}")

def merge_compliance_rules():
    """Merge new compliance rules into the main rules file"""
    
    # Paths
    base_dir = Path(__file__).parent.parent / "data" / "compliance"
    main_rules_file = base_dir / "rules.v1.json"
    new_countries_file = base_dir / "new_rules.json"
    americas_file = base_dir / "americas_rules.json"
    
    # Load main rules file
    print("Loading main rules file...")
    main_rules = load_json_file(main_rules_file)
    if not main_rules:
        return False
    
    # Load new countries rules
    print("Loading new countries rules...")
    new_countries = load_json_file(new_countries_file)
    if not new_countries:
        return False
    
    # Load Americas rules
    print("Loading Americas rules...")
    americas_rules = load_json_file(americas_file)
    if not americas_rules:
        return False
    
    # Merge new countries
    print("Merging new countries...")
    for iso, country_data in new_countries["fused_by_iso"].items():
        if iso in main_rules["fused_by_iso"]:
            print(f"Warning: {iso} ({country_data['country']}) already exists in main rules, skipping...")
        else:
            main_rules["fused_by_iso"][iso] = country_data
            print(f"Added {iso} ({country_data['country']})")
    
    # Merge Americas countries
    print("Merging Americas countries...")
    for iso, country_data in americas_rules["fused_by_iso"].items():
        if iso in main_rules["fused_by_iso"]:
            print(f"Warning: {iso} ({country_data['country']}) already exists in main rules, skipping...")
        else:
            main_rules["fused_by_iso"][iso] = country_data
            print(f"Added {iso} ({country_data['country']})")
    
    # Save updated main rules
    print("Saving updated main rules...")
    save_json_file(main_rules_file, main_rules)
    
    # Clean up temporary files
    print("Cleaning up temporary files...")
    try:
        os.remove(new_countries_file)
        os.remove(americas_file)
        print("Temporary files removed")
    except Exception as e:
        print(f"Warning: Could not remove temporary files: {e}")
    
    return True

if __name__ == "__main__":
    print("Starting compliance rules merge...")
    success = merge_compliance_rules()
    if success:
        print("✅ Compliance rules merge completed successfully!")
    else:
        print("❌ Compliance rules merge failed!")
        exit(1)
