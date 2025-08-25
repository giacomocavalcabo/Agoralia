import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DocumentTextIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useIsDemo } from '../../lib/useDemoData';
import FilterBuilder from '../../components/filters/FilterBuilder';

export default function KbChunks() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const isDemo = useIsDemo();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ rules: [] });
  
  // Mock data for demo - will come from API
  const chunks = isDemo ? [
    { id: 1, text: 'Our company provides innovative solutions for businesses looking to streamline their operations and improve efficiency.', type: 'company', doc: 'Company Profile', lang: 'en', updated: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { id: 2, text: 'We offer three pricing tiers: Basic ($29/month), Professional ($79/month), and Enterprise (custom pricing).', type: 'pricing', doc: 'Pricing Page', lang: 'en', updated: new Date(Date.now() - 4 * 60 * 60 * 1000) },
    { id: 3, text: 'Contact us at support@example.com or call +1-555-0123 for technical assistance.', type: 'contact', doc: 'Contact Page', lang: 'en', updated: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    { id: 4, text: 'Our refund policy allows customers to request a full refund within 30 days of purchase.', type: 'policy', doc: 'Terms of Service', lang: 'en', updated: new Date(Date.now() - 8 * 60 * 60 * 1000) },
    { id: 5, text: 'Frequently asked questions about our services and how to get started with our platform.', type: 'faq', doc: 'FAQ Page', lang: 'en', updated: Date.now() - 10 * 60 * 60 * 1000 }
  ] : [];
  
  const getTypeColor = (type) => {
    switch (type) {
      case 'company': return 'blue';
      case 'pricing': return 'green';
      case 'contact': return 'purple';
      case 'policy': return 'orange';
      case 'faq': return 'gray';
      default: return 'default';
    }
  };
  
  const getLangFlag = (lang) => {
    switch (lang) {
      case 'en': return '🇺🇸';
      case 'it': return '🇮🇹';
      case 'de': return '🇩🇪';
      case 'fr': return '🇫🇷';
      case 'es': return '🇪🇸';
      default: return '🌐';
    }
  };
  
  const handleViewChunk = (chunk) => {
    // TODO: Show chunk details modal
    console.log('View chunk:', chunk);
  };
  
  const handleTagChunk = (chunk) => {
    // TODO: Show tag editor modal
    console.log('Tag chunk:', chunk);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('kb.chunks.title')}</h1>
          <p className="text-gray-600 mt-1">Browse and manage your knowledge base chunks</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/knowledge/import')}>
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            {t('kb.import.title')}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('kb.chunks.filters.query')}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button variant="outline" onClick={() => setFilters({ rules: [] })}>
                <FunnelIcon className="h-4 w-4 mr-2" />
                {t('common.clear_filters')}
              </Button>
            </div>
            
            {/* FilterBuilder */}
            <FilterBuilder
              value={filters.rules || []}
              onChange={(rules) => setFilters({ ...filters, rules })}
              fields={[
                { key: 'type', type: 'select', label: t('kb.chunks.filters.type') },
                { key: 'lang', type: 'select', label: t('kb.chunks.filters.lang') },
                { key: 'source', type: 'select', label: t('kb.chunks.filters.source') },
                { key: 'document', type: 'select', label: t('kb.chunks.filters.document') }
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Chunks List */}
      {chunks.length > 0 ? (
        <div className="space-y-4">
          {chunks.map((chunk) => (
            <Card key={chunk.id}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center space-x-3 mb-3">
                      <Badge status={getTypeColor(chunk.type)}>
                        {chunk.type}
                      </Badge>
                      <span className="text-sm text-gray-500">{getLangFlag(chunk.lang)} {chunk.lang}</span>
                      <span className="text-sm text-gray-500">• {chunk.doc}</span>
                      <span className="text-sm text-gray-500">• {chunk.updated.toLocaleDateString()}</span>
                    </div>
                    
                    {/* Text Preview */}
                    <div className="text-gray-900 leading-relaxed">
                      {chunk.text.length > 200 
                        ? `${chunk.text.substring(0, 200)}...` 
                        : chunk.text
                      }
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-2 mt-4">
                      <Button size="sm" variant="ghost" onClick={() => handleViewChunk(chunk)}>
                        {t('kb.actions.view')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleTagChunk(chunk)}>
                        Tag
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('kb.chunks.empty.title')}</h3>
            <p className="text-gray-600 mb-6">{t('kb.chunks.empty.description')}</p>
            <Button onClick={() => navigate('/knowledge/import')}>
              <DocumentTextIcon className="h-4 w-4 mr-2" />
              {t('kb.import.title')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
