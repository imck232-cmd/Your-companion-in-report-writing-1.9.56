
import React, { useState, useMemo, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Teacher, School } from '../types';

interface DataManagementModalProps {
    onClose: () => void;
}

const DataManagementModal: React.FC<DataManagementModalProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const [exportType, setExportType] = useState<'full' | 'teacher' | 'school' | 'type'>('full');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedSchoolName, setSelectedSchoolName] = useState('');
    const [selectedWorkType, setSelectedWorkType] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const getAppTeachers = (): Teacher[] => {
        try {
            const data = localStorage.getItem('teachers');
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    };
    
    const getAppSchools = (): School[] => {
        try {
            const data = localStorage.getItem('schools');
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    };

    const teachers = useMemo(() => getAppTeachers(), []);
    const schools = useMemo(() => getAppSchools(), []);

    const handleFullExport = () => {
        if (!window.confirm(t('confirmFullExport'))) return;

        const backupData: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !key.startsWith('dm_')) {
                try {
                    const item = localStorage.getItem(key);
                    backupData[key] = item ? JSON.parse(item) : null;
                } catch {
                    backupData[key] = localStorage.getItem(key);
                }
            }
        }

        const date = new Date().toISOString().split('T')[0];
        const fileName = `Backup_Full_${date}.json`;
        downloadJson(backupData, fileName);
    };

    const handleFilteredExport = () => {
        const backupData: Record<string, any> = {};
        const allKeys = Object.keys(localStorage);
        
        allKeys.forEach(key => {
            if (key.startsWith('dm_')) return;
            
            let data;
            try {
                const item = localStorage.getItem(key);
                data = item ? JSON.parse(item) : null;
            } catch {
                data = localStorage.getItem(key);
            }

            if (exportType === 'teacher' && selectedTeacherId) {
                if (key === 'teachers') {
                    backupData[key] = data.filter((t: any) => t.id === selectedTeacherId);
                } else if (key === 'reports') {
                    backupData[key] = data.filter((r: any) => r.teacherId === selectedTeacherId);
                } else {
                    backupData[key] = data;
                }
            } else if (exportType === 'school' && selectedSchoolName) {
                if (key === 'teachers') {
                    backupData[key] = data.filter((t: any) => t.schoolName === selectedSchoolName);
                } else if (key === 'reports') {
                    backupData[key] = data.filter((r: any) => r.school === selectedSchoolName);
                } else {
                    backupData[key] = data;
                }
            } else if (exportType === 'type' && selectedWorkType) {
                if (key === 'reports') {
                    backupData[key] = data.filter((r: any) => r.evaluationType === selectedWorkType);
                } else {
                    backupData[key] = data;
                }
            }
        });

        const date = new Date().toISOString().split('T')[0];
        const fileName = `Backup_${exportType}_${date}.json`;
        downloadJson(backupData, fileName);
    };

    const downloadJson = (data: object, fileName: string) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type !== "application/json" && !file.name.endsWith('.json')) {
                alert(t('importError'));
                event.target.value = '';
                return;
            }
            setSelectedFile(file);
        } else {
            setSelectedFile(null);
        }
    };

    const executeImport = () => {
        if (!selectedFile) {
            alert(t('noFileSelected'));
            return;
        }

        if (!window.confirm(t('importWarningText'))) {
            return;
        }

        setIsImporting(true);
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                    throw new Error("Invalid structure");
                }

                // حفظ البيانات الحالية كنسخة احتياطية سريعة في حالة الخطأ (اختياري)
                // localStorage.clear();

                // دمج البيانات المستوردة مع الحالية أو استبدالها بالكامل حسب رغبة المستخدم
                // هنا سنقوم بالاستبدال الكامل لضمان النظافة
                localStorage.clear();

                Object.entries(data).forEach(([key, value]) => {
                    localStorage.setItem(key, JSON.stringify(value));
                });

                setIsImporting(false);
                alert(t('importSuccess'));
                window.location.reload(); 
            } catch (err) {
                console.error("Import failed:", err);
                setIsImporting(false);
                alert(t('importError'));
            }
        };

        reader.onerror = () => {
            setIsImporting(false);
            alert(t('importError'));
        };

        reader.readAsText(selectedFile);
    };

    return (
        <div className="dm-modal-overlay fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[100] p-4">
            <div className="dm-modal-content bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
                
                {/* Header - Fixed */}
                <div className="flex justify-between items-center border-b p-6 bg-gray-50">
                    <div>
                        <h2 className="text-2xl font-bold text-primary">{t('dataManagement')}</h2>
                        <p className="text-xs text-gray-500 mt-1">تصدير واستيراد قواعد البيانات والإعدادات</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Export Section */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <span className="p-2 bg-green-100 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg></span>
                            {t('exportData')}
                        </h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${exportType === 'full' ? 'border-primary bg-primary/5 shadow-inner' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="exportType" checked={exportType === 'full'} onChange={() => setExportType('full')} className="w-5 h-5 accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">{t('fullExport')}</span>
                                    <span className="text-xs text-gray-500">نسخة احتياطية شاملة</span>
                                </div>
                            </label>
                            <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${exportType === 'teacher' ? 'border-primary bg-primary/5 shadow-inner' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="exportType" checked={exportType === 'teacher'} onChange={() => setExportType('teacher')} className="w-5 h-5 accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">{t('exportByTeacher')}</span>
                                    <span className="text-xs text-gray-500">بيانات معلم محدد</span>
                                </div>
                            </label>
                            <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${exportType === 'school' ? 'border-primary bg-primary/5 shadow-inner' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="exportType" checked={exportType === 'school'} onChange={() => setExportType('school')} className="w-5 h-5 accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">{t('exportBySchool')}</span>
                                    <span className="text-xs text-gray-500">بيانات مدرسة كاملة</span>
                                </div>
                            </label>
                            <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${exportType === 'type' ? 'border-primary bg-primary/5 shadow-inner' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="exportType" checked={exportType === 'type'} onChange={() => setExportType('type')} className="w-5 h-5 accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">{t('exportByWorkType')}</span>
                                    <span className="text-xs text-gray-500">حسب نوع التقارير</span>
                                </div>
                            </label>
                        </div>

                        <div className="bg-gray-50 p-5 rounded-2xl space-y-4 border border-gray-100">
                            {exportType === 'teacher' && (
                                <div className="animate-slideDown">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('selectTeacher')}</label>
                                    <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                                        <option value="">-- {t('selectTeacher')} --</option>
                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {exportType === 'school' && (
                                <div className="animate-slideDown">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('selectSchool')}</label>
                                    <select value={selectedSchoolName} onChange={e => setSelectedSchoolName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                                        <option value="">-- {t('selectSchool')} --</option>
                                        {schools.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {exportType === 'type' && (
                                <div className="animate-slideDown">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('selectWorkType')}</label>
                                    <select value={selectedWorkType} onChange={e => setSelectedWorkType(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                                        <option value="">-- {t('selectWorkType')} --</option>
                                        <option value="general">{t('generalEvaluation')}</option>
                                        <option value="class_session">{t('classSessionEvaluation')}</option>
                                        <option value="self_evaluation">{t('selfEvaluation')}</option>
                                    </select>
                                </div>
                            )}

                            <button 
                                onClick={exportType === 'full' ? handleFullExport : handleFilteredExport}
                                className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-3"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                {exportType === 'full' ? t('fullExport') : t('exportData')}
                            </button>
                        </div>
                    </div>

                    {/* Import Section */}
                    <div className="space-y-4 pt-4 border-t border-dashed">
                        <h3 className="font-bold text-lg text-red-600 flex items-center gap-2">
                            <span className="p-2 bg-red-100 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></span>
                            {t('importData')}
                        </h3>
                        <div className="bg-red-50 p-6 border-2 border-red-100 border-dashed rounded-2xl space-y-5">
                            <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                <p className="text-sm text-red-700 font-bold mb-1 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    {t('importWarningTitle')}
                                </p>
                                <p className="text-xs text-red-600 leading-relaxed">{t('importWarningText')}</p>
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                <div className="relative border-2 border-gray-300 border-dotted rounded-xl p-4 bg-white hover:bg-gray-50 transition-colors group">
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        onChange={onFileChange}
                                        ref={fileInputRef}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                    />
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <p className="mt-2 text-sm font-semibold text-gray-700">{selectedFile ? selectedFile.name : "اسحب ملف JSON أو انقر هنا"}</p>
                                        <p className="text-xs text-gray-400">الملفات المدعومة: .json فقط</p>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={executeImport}
                                    disabled={!selectedFile || isImporting}
                                    className={`w-full py-4 rounded-xl font-bold transition transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-3 ${selectedFile && !isImporting ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                >
                                    {isImporting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>جاري المعالجة...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <span>{t('importFile')}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - Fixed */}
                <div className="border-t p-4 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-8 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition transform active:scale-95">{t('cancel')}</button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .dm-modal-overlay {
                    animation: fadeIn 0.3s ease-out;
                    backdrop-filter: blur(4px);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideDown {
                    from { transform: translateY(-10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}} />
        </div>
    );
};

export default DataManagementModal;
