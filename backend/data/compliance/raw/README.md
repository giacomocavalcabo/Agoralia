# Compliance Data Structure

## Organization

The compliance data is now organized in two complementary ways:

### 1. **Global CSV (Primary)**
- **`compliance_global.csv`** - Single unified file with all countries
- **156 countries** total with continent classification
- **Column "Continent"** for geographic organization
- **Recommended for primary use** and data import/export

### 2. **Continents Directory (Reference)**
- **`continents/`** - Organized by geographic regions
- **5 CSV files** for easy continent-specific management

#### **Africa** (`africa.csv`)
- **36 countries** including North Africa and Sub-Saharan Africa
- Covers entire African continent

#### **Americas** (`americas.csv`) 
- **36 countries** including North, Central, South America and Caribbean
- Complete coverage of American continents

#### **Asia** (`asia.csv`)
- **35 countries** including Middle East and Southeast Asia
- Covers Asia and Middle East regions

#### **Europe** (`europe.csv`)
- **36 countries** including European Union and microstates
- Complete European coverage

#### **Oceania** (`oceania.csv`)
- **13 countries** including Australia, New Zealand and Pacific Islands
- Covers Oceania region

## Data Quality
- All data is cleaned and normalized
- ContentReference tags removed
- Boolean/enum fields standardized
- Dates converted to ISO format
- Machine-readable flags derived automatically
- **Perfect CSV ↔ JSON correspondence**

## Current Coverage
- **Total Countries**: 156
- **Total Unique ISOs**: 152
- **Coverage**: Global coverage with focus on major markets
- **Missing**: 58 countries (mostly small territories and microstates)

## Missing Countries
The following major countries are still missing:
- **Russia (RU)** - Major market
- **Ukraine (UA)** - European market  
- **Vietnam (VN)** - Asian market (NOW INCLUDED!)
- **Kazakhstan (KZ)** - Central Asian market
- And 54 other smaller territories

## File Structure
Each CSV contains standardized columns:
- Continent, Country, ISO2, Regime_B2C, opt_in_or_out_B2C
- Regime_B2B, opt_in_or_out_B2B
- DNC_Registry_Name, DNC_Registry_URL
- Quiet_Hours, AI_Disclosure_Required
- Recording_Basis, Last_Verified
- Primary_Sources, Notes_for_Product
- Source_Last_Updated, Confidence

## Usage
The system automatically prioritizes the global CSV file:

```bash
# Primary: Uses compliance_global.csv
python backend/scripts/ingest_compliance.py

# Fallback: Uses continents/ directory if global CSV not found
```

## Benefits of New Structure
1. **Single source of truth** - One CSV file for all operations
2. **Geographic organization maintained** - Continent column for filtering
3. **No duplicates** - Eliminated duplicate entries across files
4. **Easy maintenance** - Update one file, affects entire system
5. **Backward compatibility** - Continents directory still available for reference
6. **Perfect data integrity** - CSV and JSON always in sync

## Recent Updates
- ✅ **Merged all continent files** into single global CSV
- ✅ **Added 4 new Asian countries**: Vietnam, Cambodia, Laos, Myanmar
- ✅ **Eliminated duplicate files** and orphaned CSV files
- ✅ **Updated ingestion script** to prioritize global CSV
- ✅ **Maintained geographic organization** via continent column
