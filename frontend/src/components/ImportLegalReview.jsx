import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    CheckIcon, 
    XMarkIcon, 
    QuestionMarkCircleIcon,
    FlagIcon,
    PencilIcon,
    EyeIcon
} from '@heroicons/react/24/outline';

const ImportLegalReview = ({ 
    contacts, 
    onContactsUpdate, 
    onNext, 
    onBack 
}) => {
    const { t } = useTranslation('pages');
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [bulkAction, setBulkAction] = useState('');
    const [bulkValue, setBulkValue] = useState('');
    const [showTooltip, setShowTooltip] = useState(null);

    // Compliance categories with colors and icons
    const complianceCategories = {
        allowed: { 
            label: t('import.legal.category.allowed', 'Consentito'), 
            color: 'bg-green-100 text-green-800 border-green-200',
            icon: '🟢'
        },
        conditional: { 
            label: t('import.legal.category.conditional', 'Condizionato'), 
            color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            icon: '🟡'
        },
        blocked: { 
            label: t('import.legal.category.blocked', 'Vietato'), 
            color: 'bg-red-100 text-red-800 border-red-200',
            icon: '🔴'
        }
    };

    // Get country flag emoji
    const getCountryFlag = (countryIso) => {
        if (!countryIso) return '🌍';
        const codePoints = countryIso
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt());
        return String.fromCodePoint(...codePoints);
    };

    // Update contact compliance fields
    const updateContact = (contactId, field, value) => {
        const updatedContacts = contacts.map(contact => {
            if (contact.id === contactId) {
                const updated = { ...contact, [field]: value };
                
                // Reclassify if compliance fields changed
                if (['contact_class', 'relationship_basis', 'opt_in', 'national_dnc'].includes(field)) {
                    // This would call the backend to reclassify
                    // For now, we'll simulate it
                    updated.compliance_category = 'conditional';
                    updated.compliance_reasons = [t('import.legal.updating', 'Updating...')];
                }
                
                return updated;
            }
            return contact;
        });
        
        onContactsUpdate(updatedContacts);
    };

    // Bulk operations
    const applyBulkAction = () => {
        if (!bulkAction || !bulkValue || selectedContacts.size === 0) return;
        
        const updatedContacts = contacts.map(contact => {
            if (selectedContacts.has(contact.id)) {
                const updated = { ...contact, [bulkAction]: bulkValue };
                
                // Reclassify if compliance fields changed
                if (['contact_class', 'relationship_basis', 'opt_in', 'national_dnc'].includes(bulkAction)) {
                    updated.compliance_category = 'conditional';
                    updated.compliance_reasons = [t('import.legal.updating', 'Updating...')];
                }
                
                return updated;
            }
            return contact;
        });
        
        onContactsUpdate(updatedContacts);
        setSelectedContacts(new Set());
        setBulkAction('');
        setBulkValue('');
    };

    // Auto-fill heuristics
    const applyHeuristics = () => {
        const updatedContacts = contacts.map(contact => {
            const updated = { ...contact };
            
            // Infer B2B from company/email
            if (contact.company || (contact.email && !contact.email.includes('gmail.com') && !contact.email.includes('outlook.com'))) {
                updated.contact_class = 'b2b';
            }
            
            // Infer existing relationship from email domain
            if (contact.email && contact.workspace_domain) {
                if (contact.email.split('@')[1] === contact.workspace_domain) {
                    updated.relationship_basis = 'existing';
                }
            }
            
            // Reclassify
            updated.compliance_category = 'conditional';
            updated.compliance_reasons = [t('import.legal.updating', 'Updating...')];
            
            return updated;
        });
        
        onContactsUpdate(updatedContacts);
    };

    // Get compliance summary
    const complianceSummary = useMemo(() => {
        const summary = { allowed: 0, conditional: 0, blocked: 0, total: contacts.length };
        contacts.forEach(contact => {
            const category = contact.compliance_category || 'unknown';
            if (summary.hasOwnProperty(category)) {
                summary[category]++;
            }
        });
        return summary;
    }, [contacts]);

    // Select all/none
    const selectAll = () => {
        if (selectedContacts.size === contacts.length) {
            setSelectedContacts(new Set());
        } else {
            setSelectedContacts(new Set(contacts.map(c => c.id)));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    {t('import.legal.title', 'Legal Review')}
                </h2>
                <p className="text-gray-600 mt-2">
                    {t('import.legal.subtitle', 'Review and classify your contacts for compliance')}
                </p>
            </div>

            {/* Compliance Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                        {t('import.legal.summary.title', 'Compliance Summary')}
                    </h3>
                    <div className="flex space-x-4">
                        <div className="flex items-center space-x-2">
                            <span className="text-2xl">🟢</span>
                            <span className="text-sm text-gray-600">
                                {complianceSummary.allowed} {t('import.legal.category.allowed', 'Consentito')}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-2xl">🟡</span>
                            <span className="text-sm text-gray-600">
                                {complianceSummary.conditional} {t('import.legal.category.conditional', 'Condizionato')}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-2xl">🔴</span>
                            <span className="text-sm text-gray-600">
                                {complianceSummary.blocked} {t('import.legal.category.blocked', 'Vietato')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk Actions Toolbar */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={selectedContacts.size === contacts.length}
                            onChange={selectAll}
                            className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-600">
                            {selectedContacts.size} / {contacts.length} {t('import.legal.selected', 'selezionati')}
                        </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        <select
                            value={bulkAction}
                            onChange={(e) => setBulkAction(e.target.value)}
                            className="rounded border-gray-300 text-sm"
                        >
                            <option value="">{t('import.legal.bulk.select', 'Seleziona campo')}</option>
                            <option value="contact_class">{t('import.legal.fields.contact_class', 'Classe contatto')}</option>
                            <option value="relationship_basis">{t('import.legal.fields.relationship_basis', 'Base relazione')}</option>
                            <option value="opt_in">{t('import.legal.fields.opt_in', 'Opt-in')}</option>
                            <option value="national_dnc">{t('import.legal.fields.national_dnc', 'DNC nazionale')}</option>
                        </select>
                        
                        {bulkAction && (
                            <>
                                <select
                                    value={bulkValue}
                                    onChange={(e) => setBulkValue(e.target.value)}
                                    className="rounded border-gray-300 text-sm"
                                >
                                    {bulkAction === 'contact_class' && (
                                        <>
                                            <option value="">{t('import.legal.bulk.select_value', 'Seleziona valore')}</option>
                                            <option value="b2b">B2B</option>
                                            <option value="b2c">B2C</option>
                                            <option value="unknown">{t('import.legal.unknown', 'Sconosciuto')}</option>
                                        </>
                                    )}
                                    {bulkAction === 'relationship_basis' && (
                                        <>
                                            <option value="">{t('import.legal.bulk.select_value', 'Seleziona valore')}</option>
                                            <option value="existing">{t('import.legal.fields.existing', 'Esistente')}</option>
                                            <option value="none">{t('import.legal.fields.none', 'Nessuna')}</option>
                                            <option value="unknown">{t('import.legal.unknown', 'Sconosciuto')}</option>
                                        </>
                                    )}
                                    {bulkAction === 'opt_in' && (
                                        <>
                                            <option value="">{t('import.legal.bulk.select_value', 'Seleziona valore')}</option>
                                            <option value={true}>{t('import.legal.fields.yes', 'Sì')}</option>
                                            <option value={false}>{t('import.legal.fields.no', 'No')}</option>
                                        </>
                                    )}
                                    {bulkAction === 'national_dnc' && (
                                        <>
                                            <option value="">{t('import.legal.bulk.select_value', 'Seleziona valore')}</option>
                                            <option value="in">{t('import.legal.fields.in_registry', 'Nel registro')}</option>
                                            <option value="not_in">{t('import.legal.fields.not_in_registry', 'Non nel registro')}</option>
                                            <option value="unknown">{t('import.legal.unknown', 'Sconosciuto')}</option>
                                        </>
                                    )}
                                </select>
                                
                                <button
                                    onClick={applyBulkAction}
                                    disabled={!bulkValue}
                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {t('import.legal.bulk.apply', 'Applica')}
                                </button>
                            </>
                        )}
                    </div>
                    
                    <button
                        onClick={applyHeuristics}
                        className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                    >
                        {t('import.legal.autofill', 'Auto-fill')}
                    </button>
                </div>
            </div>

            {/* Contacts Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <input
                                        type="checkbox"
                                        checked={selectedContacts.size === contacts.length}
                                        onChange={selectAll}
                                        className="rounded border-gray-300"
                                    />
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.name', 'Nome')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.phone', 'Telefono')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.country', 'Paese')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.class', 'Classe')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.existing', 'Esistente?')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.opt_in', 'Opt-in?')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.dnc', 'DNC?')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.category', 'Categoria')}
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('import.legal.cols.why', 'Perché')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {contacts.map((contact) => (
                                <tr key={contact.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={selectedContacts.has(contact.id)}
                                            onChange={(e) => {
                                                const newSelected = new Set(selectedContacts);
                                                if (e.target.checked) {
                                                    newSelected.add(contact.id);
                                                } else {
                                                    newSelected.delete(contact.id);
                                                }
                                                setSelectedContacts(newSelected);
                                            }}
                                            className="rounded border-gray-300"
                                        />
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {contact.name || '-'}
                                        </div>
                                        {contact.company && (
                                            <div className="text-sm text-gray-500">{contact.company}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {contact.phone_e164}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xl">{getCountryFlag(contact.country_iso)}</span>
                                            <span className="text-sm text-gray-900">{contact.country_iso}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <select
                                            value={contact.contact_class || 'unknown'}
                                            onChange={(e) => updateContact(contact.id, 'contact_class', e.target.value)}
                                            className="rounded border-gray-300 text-sm"
                                        >
                                            <option value="b2b">B2B</option>
                                            <option value="b2c">B2C</option>
                                            <option value="unknown">{t('import.legal.unknown', 'Sconosciuto')}</option>
                                        </select>
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <select
                                            value={contact.relationship_basis || 'unknown'}
                                            onChange={(e) => updateContact(contact.id, 'relationship_basis', e.target.value)}
                                            className="rounded border-gray-300 text-sm"
                                        >
                                            <option value="existing">{t('import.legal.fields.existing', 'Esistente')}</option>
                                            <option value="none">{t('import.legal.fields.none', 'Nessuna')}</option>
                                            <option value="unknown">{t('import.legal.unknown', 'Sconosciuto')}</option>
                                        </select>
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        {contact.contact_class === 'b2c' ? (
                                            <select
                                                value={contact.opt_in === true ? 'true' : contact.opt_in === false ? 'false' : ''}
                                                onChange={(e) => updateContact(contact.id, 'opt_in', e.target.value === 'true' ? true : e.target.value === 'false' ? false : null)}
                                                className="rounded border-gray-300 text-sm"
                                            >
                                                <option value="">{t('import.legal.unknown', 'Sconosciuto')}</option>
                                                <option value="true">{t('import.legal.fields.yes', 'Sì')}</option>
                                                <option value="false">{t('import.legal.fields.no', 'No')}</option>
                                            </select>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <select
                                            value={contact.national_dnc || 'unknown'}
                                            onChange={(e) => updateContact(contact.id, 'national_dnc', e.target.value)}
                                            className="rounded border-gray-300 text-sm"
                                        >
                                            <option value="in">{t('import.legal.fields.in_registry', 'Nel registro')}</option>
                                            <option value="not_in">{t('import.legal.fields.not_in_registry', 'Non nel registro')}</option>
                                            <option value="unknown">{t('import.legal.unknown', 'Sconosciuto')}</option>
                                        </select>
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${complianceCategories[contact.compliance_category]?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                            {complianceCategories[contact.compliance_category]?.icon} {complianceCategories[contact.compliance_category]?.label || contact.compliance_category}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowTooltip(showTooltip === contact.id ? null : contact.id)}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <EyeIcon className="h-4 w-4" />
                                            </button>
                                            
                                            {showTooltip === contact.id && (
                                                <div className="absolute z-10 w-64 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg -top-2 left-8">
                                                    <div className="font-medium mb-1">{t('import.legal.reasons', 'Motivi:')}</div>
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {(contact.compliance_reasons || []).map((reason, index) => (
                                                            <li key={index}>{reason}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                    {t('common.back', 'Indietro')}
                </button>
                
                <button
                    onClick={onNext}
                    className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700"
                >
                    {t('common.next', 'Avanti')}
                </button>
            </div>
        </div>
    );
};

export default ImportLegalReview;
