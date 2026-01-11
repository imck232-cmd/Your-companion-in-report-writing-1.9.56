
import React, { useState, useMemo } from 'react';
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
    formatVersion: string;
}

const DataManagementModal: React.FC<DataManagementModalProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const [exportType, setExportType] = useState<'full' | 'teacher' | 'school' | 'type'>('full');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedSchoolName, setSelectedSchoolName] = useState('');
    const [selectedWorkType, setSelectedWorkType] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    
    const [pendingImport, setPendingImport] = useState<ExportPackage | null>(null);

    const teachers = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('teachers') || '[]'); } catch { return []; }
    }, []);

    const schools = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('schools') || '[]'); } catch { return []; }
    }, []);

    const evalTypes = [
        { id: 'general', label: t('generalEvaluation') },
        { id: 'class_session', label: t('classSessionEvaluation') },
        { id: 'special', label: t('specialReports') },
        { id: 'self_evaluation', label: t('selfEvaluation') }
    ];

    // --- Backup Logic (FIFO - Limit 5) ---
    const createBackup = () => {
        const currentData: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !key.startsWith('backup_')) {
                try { currentData[key] = JSON.parse(localStorage.getItem(key) || 'null'); } 
                catch { currentData[key] = localStorage.getItem(key); }
            }
        }

        const historyRaw = localStorage.getItem('backup_history');
        let history = [];
        try { history = historyRaw ? JSON.parse(historyRaw) : []; } catch { history = []; }
        
        history.push({ 
            id: `backup-${Date.now()}`,
            timestamp: Date.now(), 
            data: currentData 
        });

        if (history.length > 5) history.shift(); // Remove oldest
        localStorage.setItem('backup_history', JSON.stringify(history));
    };

    // --- Export Logic ---
    const handleExport = () => {
        const sourceName = window.prompt(t('enterSourceName'), currentUser?.name || "مستخدم رفيقك");
        if (!sourceName) return;

        const payload: Record<string, any> = {};
        const keysToExport = ['teachers', 'reports', 'schools', 'customCriteria', 'specialReportTemplates', 'syllabusPlans', 'tasks', 'meetings', 'peerVisits', 'deliverySheets', 'bulkMessages', 'syllabusCoverageReports', 'supervisoryPlans', 'hiddenCriteria'];

        keysToExport.forEach(key => {
            let data;
            try { data = JSON.parse(localStorage.getItem(key) || '[]'); } catch { return; }

            if (exportType === 'full') {
                payload[key] = data;
            } else if (exportType === 'teacher' && selectedTeacherId) {
                if (key === 'teachers') payload[key] = data.filter((t: any) => t.id === selectedTeacherId);
                else if (key === 'reports') payload[key] = data.filter((r: any) => r.teacherId === selectedTeacherId);
                else payload[key] = data; // Keep global configs
            } else if (exportType === 'school' && selectedSchoolName) {
                if (key === 'teachers') payload[key] = data.filter((t: any) => t.schoolName === selectedSchoolName);
                else if (key === 'reports') payload[key] = data.filter((r: any) => r.school === selectedSchoolName);
                else if (key === 'schools') payload[key] = data.filter((s: any) => s.name === selectedSchoolName);
                else payload[key] = data;
            } else if (exportType === 'type' && selectedWorkType) {
                if (key === 'reports') payload[key] = data.filter((r: any) => r.evaluationType === selectedWorkType);
                else payload[key] = data;
            }
        });

        const pkg: ExportPackage = {
            sourceUser: sourceName,
            timestamp: Date.now(),
            payload: payload,
            formatVersion: "2.0"
        };

        const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rafiq_Backup_${exportType}_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // --- Import Fix & Logic ---
    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) throw new Error("File is empty");
                
                const parsed = JSON.parse(content);
                
                // Detect format: New Wrapped or Old Raw
                if (parsed.payload && parsed.sourceUser) {
                    setPendingImport(parsed);
                } else {
                    // Convert legacy raw backup to new format for processing
                    setPendingImport({
                        sourceUser: "نسخة قديمة",
                        timestamp: Date.now(),
                        payload: parsed,
                        formatVersion: "1.0-legacy"
                    });
                }
            } catch (err) {
                console.error("Import Parse Error:", err);
                alert(t('importError'));
            }
        };
        reader.onerror = () => alert(t('importError'));
        reader.readAsText(file);
    };

    const executeSmartMerge = () => {
        if (!pendingImport) return;
        
        const confirmMsg = t('importConfirmMsg')
            .replace('{user}', pendingImport.sourceUser)
            .replace('{date}', new Date(pendingImport.timestamp).toLocaleString());

        if (!window.confirm(confirmMsg)) return;

        setIsImporting(true);
        try {
            // 1. Create Safety Backup
            createBackup();

            // 2. Selective Merge
            Object.entries(pendingImport.payload).forEach(([key, importedValue]) => {
                const localRaw = localStorage.getItem(key);
                let localValue: any;
                try { localValue = localRaw ? JSON.parse(localRaw) : null; } catch { localValue = localRaw; }

                if (Array.isArray(importedValue)) {
                    const localItems = Array.isArray(localValue) ? localValue : [];
                    const localIds = new Set(localItems.map((item: any) => item.id).filter(Boolean));
                    
                    // CRITICAL: Filter out items whose ID already exists locally (Safe Append)
                    const newUniqueItems = importedValue.filter((item: any) => 
                        item && item.id && !localIds.has(item.id)
                    );
                    
                    const merged = [...localItems, ...newUniqueItems];
                    localStorage.setItem(key, JSON.stringify(merged));
                } else if (localValue === null || localValue === undefined) {
                    // For single objects (settings), only fill if currently empty
                    localStorage.setItem(key, JSON.stringify(importedValue));
                }
            });

            alert(t('importSuccess'));
            window.location.reload();
        } catch (err) {
            console.error("Merge Process Error:", err);
            alert(t('importError'));
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
                
                {/* Header */}
                <div className="flex justify-between items-center border-b p-6 bg-gray-50">
                    <div>
                        <h2 className="text-2xl font-bold text-primary">{t('dataManagement')}</h2>
                        <p className="text-xs text-gray-500 mt-1">تصدير ذكي ودمج آمن (Smart Selective Merge)</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Export Section */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2 border-r-4 border-green-500 pr-3">
                            {t('exportData')}
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'full', label: t('fullExport') },
                                { id: 'teacher', label: t('exportByTeacher') },
                                { id: 'school', label: t('exportBySchool') },
                                { id: 'type', label: t('exportByWorkType') }
                            ].map(opt => (
                                <button 
                                    key={opt.id}
                                    onClick={() => setExportType(opt.id as any)}
                                    className={`p-3 text-xs font-bold rounded-xl border-2 transition ${exportType === opt.id ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                            {exportType === 'teacher' && (
                                <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary">
                                    <option value="">-- {t('selectTeacher')} --</option>
                                    {teachers.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            )}
                            {exportType === 'school' && (
                                <select value={selectedSchoolName} onChange={e => setSelectedSchoolName(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary">
                                    <option value="">-- {t('selectSchool')} --</option>
                                    {schools.map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            )}
                            {exportType === 'type' && (
                                <select value={selectedWorkType} onChange={e => setSelectedWorkType(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary">
                                    <option value="">-- {t('selectWorkType')} --</option>
                                    {evalTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                                </select>
                            )}
                            <button 
                                onClick={handleExport}
                                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                {t('exportData')}
                            </button>
                        </div>
                    </div>

                    {/* Import Section */}
                    <div className="space-y-4 pt-4 border-t border-dashed">
                        <h3 className="font-bold text-lg text-indigo-600 flex items-center gap-2 border-r-4 border-indigo-500 pr-3">
                            {t('importData')}
                        </h3>
                        
                        {!pendingImport ? (
                            <div className="relative border-2 border-indigo-200 border-dotted rounded-2xl p-8 bg-indigo-50/30 hover:bg-indigo-50 transition group text-center">
                                <input type="file" accept=".json" onChange={onFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className="flex flex-col items-center pointer-events-none">
                                    <svg className="w-12 h-12 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                    <p className="mt-4 font-bold text-indigo-800">{t('importFile')}</p>
                                    <p className="text-[10px] text-indigo-500 mt-1">سيتم تجاهل العناصر المكررة وإضافة الجديد فقط (Safe Merge)</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl animate-fadeIn space-y-4 shadow-inner">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-full text-indigo-600 shadow-sm"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                                    <div className="flex-grow">
                                        <p className="text-sm font-bold text-indigo-900">مصدر الملف: {pendingImport.sourceUser}</p>
                                        <p className="text-[10px] text-indigo-600">التاريخ: {new Date(pendingImport.timestamp).toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => setPendingImport(null)} className="text-indigo-400 hover:text-red-500 p-1"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                                <button 
                                    onClick={executeSmartMerge}
                                    disabled={isImporting}
                                    className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-3 transition transform active:scale-95 disabled:bg-gray-400"
                                >
                                    {isImporting ? <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3 3L22 4m-2 12v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>}
                                    بدء الدمج الذكي للبيانات
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t p-4 bg-gray-50 flex justify-between items-center px-6">
                    <p className="text-[10px] text-gray-400">سياسة الأمان: يتم الاحتفاظ بآخر 5 نسخ احتياطية تلقائياً قبل أي دمج.</p>
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition text-sm">{t('cancel')}</button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `}} />
        </div>
    );
};

export default DataManagementModal;
