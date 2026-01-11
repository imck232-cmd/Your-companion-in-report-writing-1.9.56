
import React, { useState, useMemo, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Teacher, School } from '../types';

interface DataManagementModalProps {
    onClose: () => void;
}

interface ExportPackage {
    sourceUser: string;
    timestamp: number;
    payload: Record<string, any>;
}

const DataManagementModal: React.FC<DataManagementModalProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const [exportType, setExportType] = useState<'full' | 'teacher' | 'school' | 'type'>('full');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedSchoolName, setSelectedSchoolName] = useState('');
    const [selectedWorkType, setSelectedWorkType] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    
    // Smart Import States
    const [pendingImport, setPendingImport] = useState<ExportPackage | null>(null);

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

    // Backup Logic (FIFO - Limit 5)
    const createBackup = () => {
        const currentData: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !key.startsWith('backup_')) {
                try { currentData[key] = JSON.parse(localStorage.getItem(key) || 'null'); } catch { currentData[key] = localStorage.getItem(key); }
            }
        }

        const historyRaw = localStorage.getItem('backup_history');
        let history = historyRaw ? JSON.parse(historyRaw) : [];
        
        history.push({ timestamp: Date.now(), data: currentData });
        if (history.length > 5) history.shift(); // FIFO: Remove oldest
        
        localStorage.setItem('backup_history', JSON.stringify(history));
    };

    const handleFullExport = () => {
        const sourceName = window.prompt(t('enterSourceName'), currentUser?.name || "");
        if (!sourceName) return;

        const backupData: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !key.startsWith('backup_') && !key.startsWith('dm_')) {
                try {
                    const item = localStorage.getItem(key);
                    backupData[key] = item ? JSON.parse(item) : null;
                } catch {
                    backupData[key] = localStorage.getItem(key);
                }
            }
        }

        const pkg: ExportPackage = {
            sourceUser: sourceName,
            timestamp: Date.now(),
            payload: backupData
        };

        const date = new Date().toISOString().split('T')[0];
        downloadJson(pkg, `Backup_Full_${sourceName}_${date}.json`);
    };

    const handleFilteredExport = () => {
        const sourceName = window.prompt(t('enterSourceName'), currentUser?.name || "");
        if (!sourceName) return;

        const backupData: Record<string, any> = {};
        const allKeys = Object.keys(localStorage);
        
        allKeys.forEach(key => {
            if (key.startsWith('backup_') || key.startsWith('dm_')) return;
            
            let data;
            try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch { data = localStorage.getItem(key); }

            if (exportType === 'teacher' && selectedTeacherId) {
                if (key === 'teachers') backupData[key] = data.filter((t: any) => t.id === selectedTeacherId);
                else if (key === 'reports') backupData[key] = data.filter((r: any) => r.teacherId === selectedTeacherId);
                else backupData[key] = data;
            } else if (exportType === 'school' && selectedSchoolName) {
                if (key === 'teachers') backupData[key] = data.filter((t: any) => t.schoolName === selectedSchoolName);
                else if (key === 'reports') backupData[key] = data.filter((r: any) => r.school === selectedSchoolName);
                else backupData[key] = data;
            } else if (exportType === 'type' && selectedWorkType) {
                if (key === 'reports') backupData[key] = data.filter((r: any) => r.evaluationType === selectedWorkType);
                else backupData[key] = data;
            }
        });

        const pkg: ExportPackage = {
            sourceUser: sourceName,
            timestamp: Date.now(),
            payload: backupData
        };

        const date = new Date().toISOString().split('T')[0];
        downloadJson(pkg, `Backup_${exportType}_${sourceName}_${date}.json`);
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
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const pkg = JSON.parse(content);
                    if (pkg.payload && pkg.sourceUser) {
                        setPendingImport(pkg);
                    } else {
                        // Legacy format or invalid
                        alert(t('importError'));
                    }
                } catch { alert(t('importError')); }
            };
            reader.readAsText(file);
        }
    };

    const executeSmartMerge = () => {
        if (!pendingImport) return;
        
        const confirmMsg = t('importConfirmMsg')
            .replace('{user}', pendingImport.sourceUser)
            .replace('{date}', new Date(pendingImport.timestamp).toLocaleString());

        if (!window.confirm(confirmMsg)) return;

        setIsImporting(true);
        try {
            // 1. Create Backup before merge
            createBackup();

            // 2. Perform Smart Merge
            Object.entries(pendingImport.payload).forEach(([key, importedValue]) => {
                const currentRaw = localStorage.getItem(key);
                let currentValue: any;
                try { currentValue = currentRaw ? JSON.parse(currentRaw) : null; } catch { currentValue = currentRaw; }

                if (Array.isArray(importedValue)) {
                    // Safe Append logic for Arrays
                    const localItems = Array.isArray(currentValue) ? currentValue : [];
                    const localIds = new Set(localItems.map((item: any) => item.id));
                    
                    const newItems = importedValue.filter((item: any) => item && item.id && !localIds.has(item.id));
                    const mergedItems = [...localItems, ...newItems];
                    
                    localStorage.setItem(key, JSON.stringify(mergedItems));
                } else {
                    // For non-array values (configs/auth), only set if local doesn't exist
                    if (currentValue === null || currentValue === undefined) {
                        localStorage.setItem(key, JSON.stringify(importedValue));
                    }
                    // Else: SKIP - preserve local settings
                }
            });

            setIsImporting(false);
            alert(t('importSuccess'));
            window.location.reload(); 
        } catch (err) {
            console.error("Merge failed:", err);
            setIsImporting(false);
            alert(t('importError'));
        }
    };

    return (
        <div className="dm-modal-overlay fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[100] p-4">
            <div className="dm-modal-content bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
                
                {/* Header */}
                <div className="flex justify-between items-center border-b p-6 bg-gray-50">
                    <div>
                        <h2 className="text-2xl font-bold text-primary">{t('dataManagement')}</h2>
                        <p className="text-xs text-gray-500 mt-1">تصدير ذكي ودمج آمن مع نظام النسخ الاحتياطي</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
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
                                    <span className="text-xs text-gray-500">للنقل لجهاز آخر</span>
                                </div>
                            </label>
                            <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${exportType === 'teacher' ? 'border-primary bg-primary/5 shadow-inner' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="exportType" checked={exportType === 'teacher'} onChange={() => setExportType('teacher')} className="w-5 h-5 accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">{t('exportByTeacher')}</span>
                                    <span className="text-xs text-gray-500">بيانات معلم محدد</span>
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
                            <button 
                                onClick={exportType === 'full' ? handleFullExport : handleFilteredExport}
                                className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-3"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                {t('exportData')}
                            </button>
                        </div>
                    </div>

                    {/* Import Section */}
                    <div className="space-y-4 pt-4 border-t border-dashed">
                        <h3 className="font-bold text-lg text-indigo-600 flex items-center gap-2">
                            <span className="p-2 bg-indigo-100 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg></span>
                            {t('importData')}
                        </h3>
                        
                        {!pendingImport ? (
                            <div className="relative border-2 border-indigo-200 border-dotted rounded-2xl p-8 bg-indigo-50/30 hover:bg-indigo-50 transition-colors group text-center">
                                <input type="file" accept=".json" onChange={onFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className="flex flex-col items-center">
                                    <svg className="w-12 h-12 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                                    <p className="mt-4 font-bold text-indigo-800">{t('importFile')}</p>
                                    <p className="text-xs text-indigo-500 mt-1">سيتم دمج العناصر الجديدة فقط مع الحفاظ على بياناتك</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl animate-fadeIn space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-full text-indigo-600 shadow-sm"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                                    <div className="flex-grow">
                                        <p className="text-sm font-bold text-indigo-900">المصدر: {pendingImport.sourceUser}</p>
                                        <p className="text-xs text-indigo-600">تاريخ الملف: {new Date(pendingImport.timestamp).toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => setPendingImport(null)} className="text-indigo-400 hover:text-red-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                                <button 
                                    onClick={executeSmartMerge}
                                    disabled={isImporting}
                                    className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-3 transition transform active:scale-95"
                                >
                                    {isImporting ? <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
                                    {t('importData')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Backups History Info */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            سجل النسخ الاحتياطية (تلقائي)
                        </h4>
                        <p className="text-xs text-gray-500">يحتفظ النظام بآخر 5 حالات للبرنامج قبل كل عملية دمج لضمان عدم ضياع بياناتك.</p>
                    </div>
                </div>

                <div className="border-t p-4 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-8 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition transform active:scale-95">{t('cancel')}</button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .dm-modal-overlay { animation: fadeIn 0.3s ease-out; backdrop-filter: blur(4px); }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}} />
        </div>
    );
};

export default DataManagementModal;
