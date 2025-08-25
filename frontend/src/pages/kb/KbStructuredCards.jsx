import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BuildingOfficeIcon, UserGroupIcon, CubeIcon, DocumentTextIcon, QuestionMarkCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ToastProvider';
import { useIsDemo } from '../../lib/useDemoData';

export default function KbStructuredCards() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const { toast } = useToast?.() ?? { toast: () => {} };
  const isDemo = useIsDemo();
  
  const [activeTab, setActiveTab] = useState('company');
  const [regenerating, setRegenerating] = useState(false);
  
  const tabs = [
    { id: 'company', label: t('kb.structure.tabs.company'), icon: BuildingOfficeIcon },
    { id: 'contacts', label: t('kb.structure.tabs.contacts'), icon: UserGroupIcon },
    { id: 'products', label: t('kb.structure.tabs.products'), icon: CubeIcon },
    { id: 'policies', label: t('kb.structure.tabs.policies'), icon: DocumentTextIcon },
    { id: 'faq', label: t('kb.structure.tabs.faq'), icon: QuestionMarkCircleIcon }
  ];
  
  // Mock data for demo - will come from API
  const structuredData = isDemo ? {
    company: {
      name: 'Agoralia Inc.',
      description: 'Innovative business solutions provider',
      industry: 'Technology',
      founded: '2020',
      employees: '50-100',
      website: 'https://agoralia.com',
      headquarters: 'San Francisco, CA'
    },
    contacts: [
      { type: 'Support', email: 'support@agoralia.com', phone: '+1-555-0123', hours: '24/7' },
      { type: 'Sales', email: 'sales@agoralia.com', phone: '+1-555-0124', hours: '9AM-6PM PST' },
      { type: 'General', email: 'info@agoralia.com', phone: '+1-555-0125', hours: '9AM-6PM PST' }
    ],
    products: [
      { name: 'Agoralia Platform', description: 'All-in-one business management solution', pricing: 'From $29/month', features: ['CRM', 'Analytics', 'Automation'] },
      { name: 'Agoralia Mobile', description: 'Mobile app for on-the-go management', pricing: 'Included with Platform', features: ['iOS', 'Android', 'Offline sync'] }
    ],
    policies: [
      { name: 'Privacy Policy', lastUpdated: '2024-01-15', status: 'Active', url: '/privacy' },
      { name: 'Terms of Service', lastUpdated: '2024-01-15', status: 'Active', url: '/terms' },
      { name: 'Refund Policy', lastUpdated: '2024-01-15', status: 'Active', url: '/refunds' }
    ],
    faq: [
      { question: 'How do I get started?', answer: 'Sign up for a free trial and follow our onboarding guide.', category: 'Getting Started' },
      { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards and PayPal.', category: 'Billing' },
      { question: 'Can I cancel anytime?', answer: 'Yes, you can cancel your subscription at any time.', category: 'Billing' }
    ]
  } : {};
  
  const handleRegenerate = async () => {
    setRegenerating(true);
    
    // TODO: API call to regenerate structured data
    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      toast?.success?.(t('kb.toasts.structure_started'));
    }
    
    setRegenerating(false);
  };
  
  const renderCompanyTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Name:</span>
                <span className="ml-2 text-gray-900">{structuredData.company?.name}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Description:</span>
                <span className="ml-2 text-gray-900">{structuredData.company?.description}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Industry:</span>
                <span className="ml-2 text-gray-900">{structuredData.company?.industry}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Founded:</span>
                <span className="ml-2 text-gray-900">{structuredData.company?.founded}</span>
              </div>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Details</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Employees:</span>
                <span className="ml-2 text-gray-900">{structuredData.company?.employees}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Website:</span>
                <span className="ml-2 text-gray-900">{structuredData.company?.website}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Headquarters:</span>
                <span className="ml-2 text-gray-900">{structuredData.company?.headquarters}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
  
  const renderContactsTab = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        {structuredData.contacts?.map((contact, index) => (
          <Card key={index}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{contact.type}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 w-20">Email:</span>
                      <span className="text-gray-900">{contact.email}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 w-20">Phone:</span>
                      <span className="text-gray-900">{contact.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 w-20">Hours:</span>
                      <span className="text-gray-900">{contact.hours}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
  
  const renderProductsTab = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        {structuredData.products?.map((product, index) => (
          <Card key={index}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-600 mb-3">{product.description}</p>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-700">Pricing:</span>
                    <span className="text-gray-900">{product.pricing}</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-sm font-medium text-gray-700">Features:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {product.features.map((feature, idx) => (
                        <Badge key={idx} status="default">{feature}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
  
  const renderPoliciesTab = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        {structuredData.policies?.map((policy, index) => (
          <Card key={index}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{policy.name}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 w-24">Last Updated:</span>
                      <span className="text-gray-900">{policy.lastUpdated}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 w-24">Status:</span>
                      <Badge status="success">{policy.status}</Badge>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 w-24">URL:</span>
                      <span className="text-gray-900">{policy.url}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
  
  const renderFaqTab = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        {structuredData.faq?.map((item, index) => (
          <Card key={index}>
            <div className="p-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{item.question}</h3>
                  <Badge status="default">{item.category}</Badge>
                </div>
                <p className="text-gray-600">{item.answer}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'company': return renderCompanyTab();
      case 'contacts': return renderContactsTab();
      case 'products': return renderProductsTab();
      case 'policies': return renderPoliciesTab();
      case 'faq': return renderFaqTab();
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('kb.structure.title')}</h1>
          <p className="text-gray-600 mt-1">Structured information extracted from your knowledge base</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
            {t('kb.structure.actions.regenerate')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-6">
          {Object.keys(structuredData).length > 0 ? (
            renderTabContent()
          ) : (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('kb.structure.empty.title')}</h3>
              <p className="text-gray-600 mb-6">{t('kb.structure.empty.description')}</p>
              <Button onClick={handleRegenerate}>
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                {t('kb.structure.actions.regenerate')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
