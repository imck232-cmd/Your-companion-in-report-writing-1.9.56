import React, { useState } from 'react';
import { CustomCriterion, Teacher } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface CriterionManagerProps {
    customCriteria: CustomCriterion[];
    saveCustomCriterion: (criterion: CustomCriterion) => void;
    deleteCustomCriteria: (ids: string[]) => void;
    teachers: Teacher[];
    school: string;
    hiddenCriteria: { [key: string]: string[] };
    manageHiddenCriteria: (ids: string[], teacherIds: 'all' | string[]) => void;
}

const CriterionManager: React.FC<CriterionManagerProps> = ({ 
    customCriteria, saveCustomCriterion, deleteCustomCriteria, teachers, school, hiddenCriteria, manageHiddenCriteria 
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'add' | 'delete'>('add');
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);

    const handleDelete = () => {
        if (selectedCriteria.length > 0 && window.confirm(t('confirmDelete'))) {
            deleteCustomCriteria(selectedCriteria);
            setSelectedCriteria([]);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-lg space-y-6">
            <h2 className="text-2xl font-bold text-center text-primary">{t('addOrDeleteCriterion')}</h2>

            <div className="flex justify-center border-b">
                <button onClick={() => setActiveTab('add')} className={`px-6 py-2 font-bold ${activeTab === 'add' ? 'border-b-4 border-primary text-primary' : 'text-gray-500'}`}>{t('addCriterionTab')}</button>
                <button onClick={() => setActiveTab('delete')} className={`px-6 py-2 font-bold ${activeTab === 'delete' ? 'border-b-4 border-primary text-primary' : 'text-gray-500'}`}>{t('deleteCriterionTab')}</button>
            </div>

            {activeTab === 'add' ? (
                <div className="space-y-4 p-4 bg-gray-50 border rounded-lg">
                    <p className="text-sm text-gray-600">يمكنك إضافة معايير مخصصة مباشرة من واجهة التقييم العام أو تقييم الحصة الدراسية.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="max-h-96 overflow-y-auto border rounded p-2">
                        {customCriteria.map(c => (
                            <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={selectedCriteria.includes(c.id)} 
                                    onChange={e => setSelectedCriteria(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} 
                                />
                                <div>
                                    <p className="font-semibold">{c.criterion.label}</p>
                                    <p className="text-xs text-gray-500">{c.evaluationType === 'general' ? t('generalEvaluation') : t('classSessionEvaluation')}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                    <button 
                        onClick={handleDelete} 
                        disabled={selectedCriteria.length === 0}
                        className="px-6 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 disabled:bg-gray-400"
                    >
                        {t('deleteSelected')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default CriterionManager;