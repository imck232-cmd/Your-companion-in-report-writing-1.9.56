import React, { useState } from 'react';
import { SpecialReportTemplate, SpecialReportPlacement } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface SpecialReportsAdminProps {
    templates: SpecialReportTemplate[];
    saveTemplate: (template: SpecialReportTemplate) => void;
    deleteTemplate: (templateId: string) => void;
    school: string;
}

const SpecialReportsAdmin: React.FC<SpecialReportsAdminProps> = ({ templates, saveTemplate, deleteTemplate, school }) => {
    const { t } = useLanguage();
    const [editingTemplate, setEditingTemplate] = useState<SpecialReportTemplate | null>(null);

    const handleNewTemplate = () => {
        setEditingTemplate({
            id: `template-${Date.now()}`,
            schoolName: school,
            name: '',
            criteria: [],
            placement: ['teacher_reports']
        });
    };

    const handleSave = () => {
        if (editingTemplate) {
            if (!editingTemplate.name.trim()) {
                alert('Please enter a template name.');
                return;
            }
            saveTemplate(editingTemplate);
            setEditingTemplate(null);
        }
    };

    const addCriterion = () => {
        if (!editingTemplate) return;
        const label = window.prompt(t('criterionName'));
        if (label && label.trim()) {
            setEditingTemplate({
                ...editingTemplate,
                criteria: [...editingTemplate.criteria, { id: `crit-${Date.now()}`, label: label.trim() }]
            });
        }
    };

    const removeCriterion = (id: string) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            criteria: editingTemplate.criteria.filter(c => c.id !== id)
        });
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-lg space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-primary">{t('permission_view_special_reports_admin')}</h2>
                <button onClick={handleNewTemplate} className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-opacity-90">+ {t('newSpecialReportTemplate')}</button>
            </div>

            {editingTemplate ? (
                <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                    <input 
                        type="text" 
                        value={editingTemplate.name} 
                        onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} 
                        placeholder={t('templateName')} 
                        className="w-full p-2 border rounded"
                    />
                    
                    <div className="space-y-2">
                        <h4 className="font-bold">{t('criteria')}</h4>
                        {editingTemplate.criteria.map(c => (
                            <div key={c.id} className="flex justify-between items-center p-2 bg-white border rounded">
                                <span>{c.label}</span>
                                <button onClick={() => removeCriterion(c.id)} className="text-red-500 hover:text-red-700">✕</button>
                            </div>
                        ))}
                        <button onClick={addCriterion} className="text-sm text-blue-600 hover:underline">+ {t('addNewCriterion')}</button>
                    </div>

                    <div className="flex gap-4 pt-4 border-t">
                        <button onClick={handleSave} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">{t('save')}</button>
                        <button onClick={() => setEditingTemplate(null)} className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">{t('cancel')}</button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {templates.length > 0 ? templates.map(temp => (
                        <div key={temp.id} className="p-3 border rounded flex justify-between items-center bg-white shadow-sm">
                            <span className="font-semibold">{temp.name}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingTemplate(temp)} className="text-blue-500 p-2">{t('edit')}</button>
                                <button onClick={() => window.confirm(t('confirmDelete')) && deleteTemplate(temp.id)} className="text-red-500 p-2">{t('delete')}</button>
                            </div>
                        </div>
                    )) : <p className="text-center text-gray-500 py-8">{t('noSpecialTemplates')}</p>}
                </div>
            )}
        </div>
    );
};

export default SpecialReportsAdmin;