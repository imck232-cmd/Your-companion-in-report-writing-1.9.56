
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
    const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

    const teachers = useMemo(() => {
        try { 
            const raw = localStorage.getItem('teachers');
            return raw ? JSON.parse(raw) : []; 
        } catch { return []; }
    }, []);

    const schools = useMemo(() => {
        try { 
            const raw = localStorage.getItem('schools');
            return raw ? JSON.parse(raw) : []; 
        } catch { return []; }
    }, []);

    const evalTypes = [
        { id: 'general', label: t('generalEvaluation') },
        { id: 'class_session', label: t('classSessionEvaluation') },
        { id: 'special', label: t('specialReports') },
        { id: 'self_evaluation', label: t('selfEvaluation') }
    ];

    const keysToManage = [
        'teachers', 'reports', 'schools', 'customCriteria', 'specialReportTemplates', 
        'syllabusPlans', 'tasks', 'meetings', 'peerVisits', 'deliverySheets', 
        'bulkMessages', 'syllabusCoverageReports', 'supervisoryPlans', 'hiddenCriteria', 
        'bookmarkedReportIds'
    ];

    const createBackup = () => {
        const currentData: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !key.startsWith('backup_') && !key.startsWith('dm_')) {
                try { 
                    const val = localStorage.getItem(key);
                    currentData[key] = val ? JSON.parse(val) : null; 
                } 
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

        if (history.length > 5) history.shift(); 
        localStorage.setItem('backup_history', JSON.stringify(history));
    };

    const handleExport = () => {
        const sourceName = window.prompt(t('enterSourceName'), currentUser?.name || "مستخدم رفيقك");
        if (!sourceName) return;

        const payload: Record<string, any> = {};

        keysToManage.forEach(key => {
            let data;
            try { 
                const raw = localStorage.getItem(key);
                data = (raw && raw !== 'undefined') ? JSON.parse(raw) : []; 
            } catch { data = []; }

            if (exportType === 'full') {
                payload[key] = data;
            } else if (exportType === 'teacher' && selectedTeacherId) {
                if (key === 'teachers') payload[key] = data.filter((t: any) => t.id === selectedTeacherId);
                else if (key === 'reports') payload[key] = data.filter((r: any) => r.teacherId === selectedTeacherId);
                else payload[key] = data;
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
            formatVersion: "2.3"
        };

        const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rafiq_Data_${exportType}_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) throw new Error("File is empty");
                const parsed = JSON.parse(content);
                
                if (parsed.payload && typeof parsed.payload === 'object') {
                    setPendingImport(parsed);
                } else {
                    setPendingImport({
                        sourceUser: "ملف نسخة سابقة",
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
        reader.readAsText(file);
    };

    const executeImport = () => {
        if (!pendingImport) return;
        
        setIsImporting(true);
        try {
            createBackup();
            const payload = pendingImport.payload;

            if (importMode === 'replace') {
                // 1. مسح البيانات القديمة تماماً لضمان عدم حدوث تضارب
                keysToManage.forEach(key => localStorage.removeItem(key));

                // 2. استيراد البيانات الجديدة مع التحقق من نوعها (يجب أن تكون مصفوفة)
                keysToManage.forEach(key => {
                    if (payload[key]) {
                        const sanitizedValue = Array.isArray(payload[key]) ? payload[key] : [];
                        localStorage.setItem(key, JSON.stringify(sanitizedValue));
                    }
                });

                // 3. إصلاح "اسم المدرسة المختارة": إذا كانت المدرسة الحالية غير موجودة في البيانات الجديدة، نغيرها
                const newSchools = Array.isArray(payload['schools']) ? payload['schools'] : [];
                if (newSchools.length > 0) {
                    const firstSchoolName = newSchools[0].name;
                    localStorage.setItem('selectedSchool', JSON.stringify(firstSchoolName));
                }
            } else {
                // وضع الدمج الذكي (Append)
                Object.entries(payload).forEach(([key, importedValue]) => {
                    if (!keysToManage.includes(key)) return;

                    const localRaw = localStorage.getItem(key);
                    let localValue: any;
                    try { localValue = (localRaw && localRaw !== 'undefined') ? JSON.parse(localRaw) : []; } catch { localValue = []; }

                    if (Array.isArray(importedValue)) {
                        const localItems = Array.isArray(localValue) ? localValue : [];
                        const localIds = new Set(localItems.map((item: any) => item?.id).filter(Boolean));
                        const localNames = (key === 'teachers') ? new Set(localItems.map((item: any) => item?.name?.trim()).filter(Boolean)) : new Set();
                        
                        const filteredImported = importedValue.filter((item: any) => {
                            if (!item || !item.id) return false;
                            const isIdDup = localIds.has(item.id);
                            const isNameDup = (key === 'teachers' && item.name) ? localNames.has(item.name.trim()) : false;
                            return !isIdDup && !isNameDup;
                        });
                        
                        localStorage.setItem(key, JSON.stringify([...localItems, ...filteredImported]));
                    } else if (!localRaw || localRaw === 'null') {
                        localStorage.setItem(key, JSON.stringify(importedValue));
                    }
                });
            }

            setIsImporting(false);
            alert(t('importSuccess'));
            
            // إعادة تحميل الصفحة بالكامل لتنظيف الذاكرة المؤقتة (React State)
            window.location.assign(window.location.origin + window.location.pathname);
        } catch (err) {
            console.error("Import Execution Error:", err);
            setIsImporting(false);
            alert(t('importError'));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden animate-fadeIn">
                
                <div className="flex justify-between items-center border-b p-6 bg-gray-50">
                    <div>
                        <h2 className="text-2xl font-bold text-primary">{t('dataManagement')}</h2>
                        <p className="text-xs text-gray-500 mt-1">نظام الاستبعاد الذكي ومزامنة الجلسة</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
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
                                    <p className="text-[10px] text-indigo-500 mt-1">يدعم الاستبدال الشامل أو الدمج الذكي</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl animate-fadeIn space-y-6">
                                <div className="flex items-center gap-4 bg-white/50 p-3 rounded-xl border border-indigo-100">
                                    <div className="p-3 bg-indigo-100 rounded-full text-indigo-600 shadow-sm"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                                    <div className="flex-grow">
                                        <p className="text-sm font-bold text-indigo-900">مصدر الملف: {pendingImport.sourceUser}</p>
                                        <p className="text-[10px] text-indigo-600">التاريخ: {new Date(pendingImport.timestamp).toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => setPendingImport(null)} className="text-indigo-400 hover:text-red-500 p-1"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-indigo-800 px-1">تحديد وضع الاستيراد:</p>
                                    <div 
                                        onClick={() => setImportMode('append')}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition flex items-start gap-3 ${importMode === 'append' ? 'border-indigo-600 bg-indigo-100/50 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-200'}`}
                                    >
                                        <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${importMode === 'append' ? 'border-indigo-600' : 'border-gray-300'}`}>
                                            {importMode === 'append' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-indigo-900">{t('importModeAppend')}</p>
                                            <p className="text-[10px] text-indigo-600 mt-1">{t('importModeAppendWarning')}</p>
                                        </div>
                                    </div>

                                    <div 
                                        onClick={() => setImportMode('replace')}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition flex items-start gap-3 ${importMode === 'replace' ? 'border-red-500 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-red-200'}`}
                                    >
                                        <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${importMode === 'replace' ? 'border-red-500' : 'border-gray-300'}`}>
                                            {importMode === 'replace' && <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-red-800">{t('importModeReplace')}</p>
                                            <p className="text-[10px] text-red-600 mt-1">{t('importModeReplaceWarning')}</p>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={executeImport}
                                    disabled={isImporting}
                                    className={`w-full font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 transition transform active:scale-95 disabled:bg-gray-400 ${importMode === 'replace' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                                >
                                    {isImporting ? <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3 3L22 4m-2 12v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>}
                                    {importMode === 'replace' ? 'تنفيذ الاستبدال الشامل' : 'تنفيذ الدمج الذكي'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t p-4 bg-gray-50 flex justify-between items-center px-6">
                    <p className="text-[10px] text-gray-400">نظام الأرشفة مفعل: يتم الاحتفاظ بآخر 5 نسخ احتياطية تلقائياً.</p>
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
