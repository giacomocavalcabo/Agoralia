import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/button';
import { Input } from './ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Badge } from './ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { useToast } from './ToastProvider';
import { useI18n } from '../lib/i18n.jsx';

const CRMFieldMappingEditor = ({ 
  workspaceId, 
  provider, 
  onMappingUpdate,
  initialMapping = null 
}) => {
  const { t } = useI18n();
  const { toast } = useToast();
  
  const [mapping, setMapping] = useState({});
  const [picklists, setPicklists] = useState({});
  const [loading, setLoading] = useState(false);
  const [crmFields, setCrmFields] = useState({});
  const [activeTab, setActiveTab] = useState('contact');

  // Default field mappings for each object type
  const defaultMappings = {
    contact: {
      email: 'email',
      phone_e164: 'phone',
      first_name: 'firstname',
      last_name: 'lastname',
      title: 'jobtitle',
      country_iso: 'country',
      company_id: 'company'
    },
    company: {
      name: 'name',
      domain: 'domain',
      phone: 'phone',
      country_iso: 'country',
      vat: 'vat_number',
      address: 'address'
    },
    deal: {
      title: 'dealname',
      amount_cents: 'amount',
      currency: 'currency',
      stage: 'dealstage',
      pipeline: 'pipeline'
    }
  };

  // CRM field suggestions for each provider
  const providerFields = {
    hubspot: {
      contact: ['email', 'phone', 'firstname', 'lastname', 'jobtitle', 'country', 'company', 'address', 'city', 'state', 'zip'],
      company: ['name', 'domain', 'phone', 'country', 'vat_number', 'address', 'city', 'state', 'zip', 'industry'],
      deal: ['dealname', 'amount', 'currency', 'dealstage', 'pipeline', 'closedate', 'dealtype', 'source']
    },
    zoho: {
      contact: ['Email', 'Phone', 'First_Name', 'Last_Name', 'Title', 'Mailing_Country', 'Account_Name', 'Mailing_Street', 'Mailing_City'],
      company: ['Account_Name', 'Website', 'Phone', 'Billing_Country', 'VAT', 'Billing_Street', 'Billing_City', 'Industry'],
      deal: ['Deal_Name', 'Amount', 'Currency', 'Stage', 'Pipeline', 'Closing_Date', 'Deal_Type', 'Lead_Source']
    },
    odoo: {
      contact: ['email', 'phone', 'name', 'function', 'country_id', 'parent_id', 'street', 'city', 'zip'],
      company: ['name', 'website', 'phone', 'country_id', 'vat', 'street', 'city', 'zip', 'industry'],
      deal: ['name', 'expected_revenue', 'currency_id', 'stage_id', 'pipeline_id', 'date_deadline', 'type', 'source_id']
    }
  };

  useEffect(() => {
    if (initialMapping) {
      setMapping(initialMapping);
    } else {
      setMapping(defaultMappings[activeTab] || {});
    }
    setCrmFields(providerFields[provider] || {});
  }, [provider, activeTab, initialMapping]);

  const handleFieldChange = (canonicalField, crmField) => {
    setMapping(prev => ({
      ...prev,
      [canonicalField]: crmField
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/crm/mapping', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          provider: provider,
          object: activeTab,
          mapping_json: mapping,
          picklists_json: picklists
        })
      });

      if (response.ok) {
        toast({
          title: t('integrations.mapping.saved.title'),
          description: t('integrations.mapping.saved.description'),
          type: 'success'
        });
        
        if (onMappingUpdate) {
          onMappingUpdate(activeTab, mapping, picklists);
        }
      } else {
        throw new Error('Failed to save mapping');
      }
    } catch (error) {
      toast({
        title: t('integrations.mapping.error.title'),
        description: t('integrations.mapping.error.description'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMapping(defaultMappings[activeTab] || {});
    setPicklists({});
  };

  const getCanonicalFields = (objectType) => {
    const fields = {
      contact: [
        { key: 'email', label: 'Email', required: true },
        { key: 'phone_e164', label: 'Phone (E.164)', required: false },
        { key: 'first_name', label: 'First Name', required: false },
        { key: 'last_name', label: 'Last Name', required: false },
        { key: 'title', label: 'Job Title', required: false },
        { key: 'country_iso', label: 'Country (ISO)', required: false },
        { key: 'company_id', label: 'Company ID', required: false }
      ],
      company: [
        { key: 'name', label: 'Company Name', required: true },
        { key: 'domain', label: 'Website Domain', required: false },
        { key: 'phone', label: 'Phone', required: false },
        { key: 'country_iso', label: 'Country (ISO)', required: false },
        { key: 'vat', label: 'VAT Number', required: false },
        { key: 'address', label: 'Address', required: false }
      ],
      deal: [
        { key: 'title', label: 'Deal Title', required: true },
        { key: 'amount_cents', label: 'Amount (cents)', required: false },
        { key: 'currency', label: 'Currency', required: false },
        { key: 'stage', label: 'Stage', required: false },
        { key: 'pipeline', label: 'Pipeline', required: false }
      ]
    };
    
    return fields[objectType] || [];
  };

  const renderFieldMapping = (canonicalField, label, required = false) => {
    const currentValue = mapping[canonicalField] || '';
    const suggestions = crmFields[activeTab] || [];
    
    return (
      <div key={canonicalField} className="flex items-center gap-4 py-3 border-b border-gray-200 last:border-b-0">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Canonical field: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{canonicalField}</code>
          </p>
        </div>
        
        <div className="flex-1">
          <Select
            value={currentValue}
            onValueChange={(value) => handleFieldChange(canonicalField, value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select CRM field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">-- No mapping --</SelectItem>
              {suggestions.map(field => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {currentValue && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              ✓ Mapped to <code className="bg-green-100 dark:bg-green-900 px-1 rounded">{currentValue}</code>
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Field Mapping - {provider.toUpperCase()}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Mapping'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="deal">Deal</TabsTrigger>
          </TabsList>
          
          {['contact', 'company', 'deal'].map(objectType => (
            <TabsContent key={objectType} value={objectType} className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold capitalize">{objectType} Fields</h3>
                  <Badge variant="outline">
                    {Object.keys(mapping).filter(k => mapping[k]).length} mapped
                  </Badge>
                </div>
                
                <div className="space-y-0">
                  {getCanonicalFields(objectType).map(field => 
                    renderFieldMapping(field.key, field.label, field.required)
                  )}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Mapping Tips
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Required fields are marked with <span className="text-red-500">*</span></li>
                    <li>• Phone numbers should be in E.164 format (+1234567890)</li>
                    <li>• Country codes should use ISO 3166-1 alpha-2 (US, IT, DE)</li>
                    <li>• Amount fields are stored in cents (100 = $1.00)</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CRMFieldMappingEditor;
