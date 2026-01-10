import React, { useMemo, useState, useCallback } from 'react';
import { Report, Teacher, GeneralEvaluationReport, ClassSessionEvaluationReport, SpecialReport, Task, Meeting, PeerVisit, DeliverySheet, SyllabusCoverageReport, GeneralCriterion, ClassSessionCriterionGroup, MeetingOutcome } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { GENERAL_EVALUATION_CRITERIA_TEMPLATE, CLASS_SESSION_BRIEF_TEMPLATE, CLASS_SESSION_EXTENDED_TEMPLATE, CLASS_SESSION_SUBJECT_SPECIFIC_TEMPLATE, GRADES, SUBJECTS } from '../constants';
import { exportKeyMetrics, exportEvaluationAnalysis, exportSupervisorySummary as exportSupervisorySummaryUtil, exportMeetingSummary as exportMeetingSummaryUtil, calculateReportPercentage } from '../lib/exportUtils';

declare const XLSX: any;

interface PerformanceDashboardProps {
  reports: Report[];
  teachers: Teacher[];
  tasks: Task[];
  meetings: Meeting[];
  peerVisits: PeerVisit[];
  deliverySheets: DeliverySheet[];
  syllabusCoverageReports: SyllabusCoverageReport[];
}

// --- Helper Components ---

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; onExport?: (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => void }> = ({ title, children, defaultOpen = false, onExport }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-3 text-lg font-semibold text-right bg-gray-100 hover:bg-gray-200 flex justify-between items-center transition">
                <span>{title}</span>
                <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && <div className="p-4 bg-white">
                {children}
                {onExport && <ExportButtons onExport={onExport} />}
            </div>}
        </div>
    );
};

const ProgressBar: React.FC<{ label: string; percentage: number }> = ({ label, percentage }) => {
    const getProgressBarColor = (p: number) => {
        if (p < 26) return 'bg-red-500';
        if (p < 51) return 'bg-yellow-500';
        if (p < 76) return 'bg-orange-500';
        if (p < 90) return 'bg-blue-500';
        return 'bg-green-500';
    };
    const color = getProgressBarColor(percentage);
    return (
        <div className="text-center">
            <p className="font-semibold text-gray-700">{label}</p>
            <div className="w-full bg-gray-200 rounded-full h-4 my-2">
                <div className={`${color} h-4 rounded-full transition-all duration-500`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
            </div>
            <p className="font-bold text-lg">{percentage.toFixed(1)}%</p>
        </div>
    );
};

const ExportButtons: React.FC<{ onExport: (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => void }> = ({ onExport }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4 p-2 bg-gray-100 rounded">
      <button onClick={() => onExport('excel')} className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition transform hover:scale-105">{t('exportExcel')}</button>
      <button onClick={() => onExport('whatsapp')} className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition transform hover:scale-105">{t('sendToWhatsApp')}</button>
    </div>
  );
};


// --- New: Report Summary Tab ---

const ReportSummaryView: React.FC<{ reports: Report[], teachers: Teacher[] }> = ({ reports, teachers }) => {
    const { t } = useLanguage();
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
    const [selectedSources, setSelectedSources] = useState<string[]>(['general', 'brief', 'extended', 'subject_specific']);
    const [showFilters, setShowFilters] = useState(false);
    const [whatsappModal, setWhatsappModal] = useState<{ visible: boolean, data: any[] }>({ visible: false, data: [] });

    const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t])), [teachers]);

    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            const reportDate = new Date(r.date);
            const dateMatch = (!dateRange.start || reportDate >= new Date(dateRange.start)) &&
                              (!dateRange.end || reportDate <= new Date(dateRange.end));
            
            const teacherMatch = selectedTeachers.length === 0 || selectedTeachers.includes(r.teacherId);
            const subjectMatch = selectedSubjects.length === 0 || selectedSubjects.includes(r.subject);
            const gradeMatch = selectedGrades.length === 0 || selectedGrades.includes(r.grades);
            
            let sourceMatch = false;
            if (r.evaluationType === 'general') sourceMatch = selectedSources.includes('general');
            else if (r.evaluationType === 'class_session') {
                sourceMatch = selectedSources.includes((r as ClassSessionEvaluationReport).subType);
            } else if (r.evaluationType === 'special') sourceMatch = true; // Include special if needed
            
            return dateMatch && teacherMatch && subjectMatch && gradeMatch && sourceMatch;
        });
    }, [reports, dateRange, selectedTeachers, selectedSubjects, selectedGrades, selectedSources]);

    const summaryByTeacher = useMemo(() => {
        const grouped: { [teacherId: string]: any } = {};

        filteredReports.forEach(r => {
            if (!grouped[r.teacherId]) {
                const teacher = teacherMap.get(r.teacherId);
                grouped[r.teacherId] = {
                    id: r.teacherId,
                    name: teacher?.name || 'غير معروف',
                    subject: r.subject,
                    grade: r.grades,
                    deficiencies: new Set<string>(),
                    totalCriteria: 0,
                    lowScoreCriteria: 0,
                    reportCount: 0,
                };
            }
            
            const g = grouped[r.teacherId];
            g.reportCount++;
            
            const allCriteria = (r.evaluationType === 'general')
                ? (r as GeneralEvaluationReport).criteria
                : (r.evaluationType === 'class_session') 
                    ? (r as ClassSessionEvaluationReport).criterionGroups.flatMap(grp => grp.criteria)
                    : (r.evaluationType === 'special')
                        ? (r as SpecialReport).criteria
                        : [];
            
            allCriteria.forEach(c => {
                g.totalCriteria++;
                if (c.score < 3) {
                    g.deficiencies.add(c.label);
                    g.lowScoreCriteria++;
                }
            });
        });

        return Object.values(grouped).map(g => ({
            ...g,
            deficiencyPercentage: g.totalCriteria > 0 ? (g.lowScoreCriteria / g.totalCriteria) * 100 : 0,
            deficiencyList: Array.from(g.deficiencies)
        }));
    }, [filteredReports, teacherMap]);

    const handleExportExcel = () => {
        const wsData = summaryByTeacher.map(item => ({
            "اسم المعلم": item.name,
            "المادة": item.subject,
            "الصف": item.grade,
            "جوانب القصور": item.deficiencyList.join('، '),
            "نسبة القصور": `${item.deficiencyPercentage.toFixed(1)}%`,
            "عدد التقارير": item.reportCount
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "خلاصة التقارير");
        XLSX.writeFile(wb, `خلاصة_التقارير_${new Date().toLocaleDateString()}.xlsx`);
    };

    const toggleSelection = (list: string[], setList: (l: string[]) => void, item: string, options: string[]) => {
        if (item === 'all') {
            if (list.length === options.length) setList([]);
            else setList([...options]);
        } else {
            if (list.includes(item)) setList(list.filter(i => i !== item));
            else setList([...list, item]);
        }
    };

    const MultiSelect: React.FC<{ label: string, options: string[], selected: string[], onToggle: (item: string) => void }> = ({ label, options, selected, onToggle }) => (
        <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">{label}</label>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 border rounded bg-white">
                <button
                    onClick={() => onToggle('all')}
                    className={`px-2 py-1 rounded-full text-xs font-semibold transition ${selected.length === options.length ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    {selected.length === options.length ? t('deselectAll') : t('selectAll')}
                </button>
                {options.map(opt => (
                    <button
                        key={opt}
                        onClick={() => onToggle(opt)}
                        className={`px-2 py-1 rounded-full text-xs font-semibold transition ${selected.includes(opt) ? 'bg-primary-light text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );

    const handleWhatsApp = (item: any) => {
        let message = `📝 *خلاصة تقارير الأداء للمعلم: ${item.name}*\n`;
        message += `📍 *المدرسة:* ${reports[0]?.school || '---'}\n`;
        message += `📉 *نسبة القصور:* ${item.deficiencyPercentage.toFixed(1)}%\n`;
        if (item.deficiencyList.length > 0) {
            message += `⚠️ *أهم جوانب القصور التي تحتاج تحسين:*\n- ${item.deficiencyList.join('\n- ')}\n`;
        }
        message += `✅ نأمل العمل على معالجة هذه الجوانب للارتقاء بالأداء.\nإعداد: ${reports[0]?.supervisorName || 'الإدارة التربوية'}`;
        
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const allSubjectOptions = Array.from(new Set(reports.map(r => r.subject))).filter(Boolean) as string[];
    const allGradeOptions = Array.from(new Set(reports.map(r => r.grades))).filter(Boolean) as string[];
    const allTeacherOptions = teachers.map(t => t.id);

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 p-4 border rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition shadow-md font-bold"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>
                        {t('filters')}
                    </button>
                    {summaryByTeacher.length > 0 && (
                        <button onClick={handleExportExcel} className="text-emerald-600 hover:underline font-bold flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            {t('exportExcel')}
                        </button>
                    )}
                </div>
                
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('selectDateRange')}</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="p-2 border rounded text-xs" />
                                    <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="p-2 border rounded text-xs" />
                                </div>
                            </div>
                            <MultiSelect 
                                label={t('reportSource')} 
                                options={['general', 'brief', 'extended', 'subject_specific']} 
                                selected={selectedSources} 
                                onToggle={(item) => toggleSelection(selectedSources, setSelectedSources, item, ['general', 'brief', 'extended', 'subject_specific'])} 
                            />
                        </div>
                        
                        <div className="space-y-4">
                            <MultiSelect 
                                label={t('subjectLabel')} 
                                options={allSubjectOptions} 
                                selected={selectedSubjects} 
                                onToggle={(item) => toggleSelection(selectedSubjects, setSelectedSubjects, item, allSubjectOptions)} 
                            />
                            <MultiSelect 
                                label={t('gradesLabel')} 
                                options={allGradeOptions} 
                                selected={selectedGrades} 
                                onToggle={(item) => toggleSelection(selectedGrades, setSelectedGrades, item, allGradeOptions)} 
                            />
                        </div>

                        <div className="space-y-4">
                            <MultiSelect 
                                label={t('teacherName')} 
                                options={allTeacherOptions.map(id => teacherMap.get(id)?.name || 'غير معروف')} 
                                selected={selectedTeachers.map(id => teacherMap.get(id)?.name || '')} 
                                onToggle={(name) => {
                                    const id = teachers.find(t => t.name === name)?.id;
                                    if (id) toggleSelection(selectedTeachers, setSelectedTeachers, id, allTeacherOptions);
                                }} 
                            />
                        </div>
                    </div>
                )}
            </div>

            <Section title={`${t('reportSummary')} - ${t('filterByTeacher')}`} defaultOpen>
                <div className="overflow-x-auto border rounded-lg shadow-inner bg-white">
                    <table className="min-w-full text-right divide-y divide-gray-200">
                        <thead className="bg-primary text-white">
                            <tr>
                                <th className="p-3 text-sm font-bold">{t('teacherName')}</th>
                                <th className="p-3 text-sm font-bold">{t('subjectLabel')}</th>
                                <th className="p-3 text-sm font-bold">{t('gradesLabel')}</th>
                                <th className="p-3 text-sm font-bold">{t('aspectsOfDeficiency')}</th>
                                <th className="p-3 text-sm font-bold">{t('deficiencyPercentage')}</th>
                                <th className="p-3 text-sm font-bold">{t('sendToWhatsApp')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100 text-xs">
                            {summaryByTeacher.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 transition">
                                    <td className="p-3 font-bold text-gray-800">{item.name}</td>
                                    <td className="p-3">{item.subject}</td>
                                    <td className="p-3">{item.grade}</td>
                                    <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                            {item.deficiencyList.length > 0 ? (
                                                item.deficiencyList.slice(0, 4).map((d: string) => (
                                                    <span key={d} className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100">{d}</span>
                                                ))
                                            ) : <span className="text-green-600 font-bold">لا يوجد قصور</span>}
                                            {item.deficiencyList.length > 4 && <span className="text-gray-400">+{item.deficiencyList.length - 4} أخرى</span>}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-red-500 h-full" style={{ width: `${item.deficiencyPercentage}%` }}></div>
                                            </div>
                                            <span className="font-bold text-red-600">{item.deficiencyPercentage.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <button onClick={() => handleWhatsApp(item)} className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition shadow transform hover:scale-110">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {summaryByTeacher.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">لا توجد بيانات تطابق هذه الفلاتر حالياً</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Section>
        </div>
    );
};


// --- Key Metrics Tab ---
const KeyMetricsView: React.FC<{ reports: Report[], teachers: Teacher[] }> = ({ reports, teachers }) => {
    const { t } = useLanguage();
    const [targets, setTargets] = useState({ strategies: '10', tools: '10', sources: '5', programs: '2' });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [calculatedStats, setCalculatedStats] = useState<any>(null);

    const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);

    const handleCalculate = useCallback(() => {
        const { start, end } = dateRange;
        if (!start || !end) {
            alert(t('selectDateRange'));
            return;
        }

        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weeks = Math.max(1, diffDays / 7);

        const filteredReports = reports.filter(r => {
            const reportDate = new Date(r.date);
            return reportDate >= startDate && reportDate <= endDate;
        });

        const usageCounts = { strategies: 0, tools: 0, sources: 0, programs: 0 };
        const usageDetails: { [key: string]: { [item: string]: { [teacherName: string]: number } } } = {
            strategies: {}, tools: {}, sources: {}, programs: {}
        };
        const itemTypes: (keyof typeof usageCounts)[] = ['strategies', 'tools', 'sources', 'programs'];

        filteredReports.forEach(report => {
            const teacherName = teacherMap.get(report.teacherId) || 'Unknown';
            itemTypes.forEach(type => {
                const itemsStr = (report as GeneralEvaluationReport | ClassSessionEvaluationReport)[type];
                if (itemsStr) {
                    const items = itemsStr.split(/[,،]\s*/).filter(Boolean);
                    usageCounts[type] += items.length;
                    items.forEach(item => {
                        if (!usageDetails[type][item]) usageDetails[type][item] = {};
                        if (!usageDetails[type][item][teacherName]) usageDetails[type][item][teacherName] = 0;
                        usageDetails[type][item][teacherName]++;
                    });
                }
            });
        });
        
        setCalculatedStats({
            percentages: {
                strategies: (usageCounts.strategies / (parseInt(targets.strategies) * weeks)) * 100,
                tools: (usageCounts.tools / (parseInt(targets.tools) * weeks)) * 100,
                sources: (usageCounts.sources / (parseInt(targets.sources) * weeks)) * 100,
                programs: (usageCounts.programs / (parseInt(targets.programs) * weeks)) * 100,
            },
            details: usageDetails,
        });

    }, [dateRange, reports, targets, teacherMap, t]);

    const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTargets(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleExport = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => {
        if (calculatedStats) {
            exportKeyMetrics(format, calculatedStats, t);
        }
    };

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <h3 className="text-xl font-semibold text-center">{t('usageStatistics')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><label className="text-sm font-medium">{t('requiredStrategies')}</label><input type="number" name="strategies" value={targets.strategies} onChange={handleTargetChange} className="w-full p-2 border rounded" /></div>
                    <div><label className="text-sm font-medium">{t('requiredTools')}</label><input type="number" name="tools" value={targets.tools} onChange={handleTargetChange} className="w-full p-2 border rounded" /></div>
                    <div><label className="text-sm font-medium">{t('requiredSources')}</label><input type="number" name="sources" value={targets.sources} onChange={handleTargetChange} className="w-full p-2 border rounded" /></div>
                    <div><label className="text-sm font-medium">{t('requiredPrograms')}</label><input type="number" name="programs" value={targets.programs} onChange={handleTargetChange} className="w-full p-2 border rounded" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div><label className="text-sm font-medium">{t('from_date')}</label><input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="w-full p-2 border rounded" /></div>
                    <div><label className="text-sm font-medium">{t('to_date')}</label><input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="w-full p-2 border rounded" /></div>
                    <button onClick={handleCalculate} className="w-full px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-opacity-90 transition transform hover:scale-105">{t('calculate')}</button>
                </div>
            </div>

            {calculatedStats && (
                <div className="p-4 border rounded-lg space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <ProgressBar label={t('strategiesUsed')} percentage={calculatedStats.percentages.strategies || 0} />
                        <ProgressBar label={t('toolsUsed')} percentage={calculatedStats.percentages.tools || 0} />
                        <ProgressBar label={t('sourcesUsed')} percentage={calculatedStats.percentages.sources || 0} />
                        <ProgressBar label={t('programsUsed')} percentage={calculatedStats.percentages.programs || 0} />
                    </div>
                    
                    <div className="space-y-4">
                        <Section title={t('strategiesUsed')}>
                            <UsageDetailsTable data={calculatedStats.details.strategies} />
                        </Section>
                        <Section title={t('toolsUsed')}>
                            <UsageDetailsTable data={calculatedStats.details.tools} />
                        </Section>
                        <Section title={t('sourcesUsed')}>
                             <UsageDetailsTable data={calculatedStats.details.sources} />
                        </Section>
                        <Section title={t('programsUsed')}>
                             <UsageDetailsTable data={calculatedStats.details.programs} />
                        </Section>
                    </div>
                    <ExportButtons onExport={handleExport} />
                </div>
            )}
        </div>
    );
};

const UsageDetailsTable: React.FC<{data: {[item: string]: {[teacher: string]: number}}}> = ({data}) => {
    if(Object.keys(data).length === 0) return <p className="text-gray-400 italic">لا توجد بيانات.</p>;
    return (
        <div className="space-y-3">
            {Object.entries(data).map(([item, teachers]) => (
                <div key={item} className="p-2 border-b last:border-0 pb-3">
                    <p className="font-bold text-primary">{item}</p>
                    <ul className="list-disc ps-6 text-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(teachers).sort(([,a],[,b]) => b - a).map(([teacher, count]) => (
                            <li key={teacher} className="text-gray-700">{teacher} <span className="font-bold">({count})</span></li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )
};

// --- Evaluation Analysis Tab ---
const EvaluationAnalysisView: React.FC<{ reports: Report[], teachers: Teacher[] }> = ({ reports, teachers }) => {
    const { t } = useLanguage();
    const [view, setView] = useState<string | null>(null);

    const analysisData = useMemo(() => {
        const templates = {
            general: { title: t('generalEvaluationElements'), criteria: GENERAL_EVALUATION_CRITERIA_TEMPLATE.map(c => c.label) },
            brief: { title: t('briefEvaluationElements'), criteria: CLASS_SESSION_BRIEF_TEMPLATE.flatMap(g => g.criteria.map(c => c.label)) },
            extended: { title: t('extendedEvaluationElements'), criteria: CLASS_SESSION_EXTENDED_TEMPLATE.flatMap(g => g.criteria.map(c => c.label)) },
            subject_specific: { title: t('subjectSpecificEvaluationElements'), criteria: CLASS_SESSION_SUBJECT_SPECIFIC_TEMPLATE.flatMap(g => g.criteria.map(c => c.label)) },
        };
        
        const results: { [key: string]: any } = {};

        Object.entries(templates).forEach(([key, template]) => {
            const relevantReports = reports.filter(r => {
                if (key === 'general') return r.evaluationType === 'general';
                if (key === 'brief' || key === 'extended' || key === 'subject_specific') {
                    return r.evaluationType === 'class_session' && r.subType === key;
                }
                return false;
            });

            const criterionData: { [label: string]: { total: number, count: number, teacherScores: {[id: string]: number[]} } } = {};
            template.criteria.forEach(label => {
                criterionData[label] = { total: 0, count: 0, teacherScores: {} };
            });

            relevantReports.forEach(report => {
                const allCriteria = (report.evaluationType === 'general')
                    ? (report as GeneralEvaluationReport).criteria
                    : (report as ClassSessionEvaluationReport).criterionGroups.flatMap(g => g.criteria);
                
                allCriteria.forEach(c => {
                    if(criterionData[c.label]) {
                        criterionData[c.label].total += c.score;
                        criterionData[c.label].count++;
                        if (!criterionData[c.label].teacherScores[report.teacherId]) {
                            criterionData[c.label].teacherScores[report.teacherId] = [];
                        }
                        criterionData[c.label].teacherScores[report.teacherId].push(c.score);
                    }
                });
            });

            const processedCriteria = Object.entries(criterionData).map(([label, data]) => {
                const overallAverage = data.count > 0 ? (data.total / (data.count * 4)) * 100 : 0;
                const teacherAvgs = Object.entries(data.teacherScores).map(([teacherId, scores]) => {
                    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / (scores.length * 4)) * 100 : 0;
                    return { teacherId, name: teachers.find(t => t.id === teacherId)?.name || 'Unknown', avg };
                }).sort((a,b) => b.avg - a.avg);
                return { label, overallAverage, teacherAvgs };
            });

            results[key] = {
                title: template.title,
                excellent: processedCriteria.filter(c => c.overallAverage >= 90).sort((a,b) => b.overallAverage - a.overallAverage),
                good: processedCriteria.filter(c => c.overallAverage >= 75 && c.overallAverage < 90).sort((a,b) => b.overallAverage - a.overallAverage),
                average: processedCriteria.filter(c => c.overallAverage >= 50 && c.overallAverage < 75).sort((a,b) => b.overallAverage - a.overallAverage),
                needsImprovement: processedCriteria.filter(c => c.overallAverage < 50).sort((a,b) => b.overallAverage - a.overallAverage),
            };
        });

        return results;
    }, [reports, teachers, t]);

    const handleExport = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => {
        if (view && analysisData[view]) {
            exportEvaluationAnalysis(format, analysisData[view], t);
        }
    };

    if(view && analysisData[view]) {
        const data = analysisData[view];
        return (
            <div>
                <button onClick={() => setView(null)} className="mb-4 text-sky-600 hover:underline transition">&larr; {t('back')}</button>
                <h3 className="text-2xl font-bold text-center mb-4 text-primary">{data.title}</h3>
                <div className="space-y-6">
                    <PerformanceLevelSection title={t('performanceLevelExcellent')} criteria={data.excellent} />
                    <PerformanceLevelSection title={t('performanceLevelGood')} criteria={data.good} />
                    <PerformanceLevelSection title={t('performanceLevelAverage')} criteria={data.average} />
                    <PerformanceLevelSection title={t('performanceLevelNeedsImprovement')} criteria={data.needsImprovement} />
                </div>
                <ExportButtons onExport={handleExport} />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => setView('general')} className="p-6 bg-blue-100 text-blue-800 font-bold rounded-lg shadow hover:bg-blue-200 transition transform hover:-translate-y-1">{t('generalEvaluationElements')}</button>
            <button onClick={() => setView('brief')} className="p-6 bg-purple-100 text-purple-800 font-bold rounded-lg shadow hover:bg-purple-200 transition transform hover:-translate-y-1">{t('briefEvaluationElements')}</button>
            <button onClick={() => setView('extended')} className="p-6 bg-teal-100 text-teal-800 font-bold rounded-lg shadow hover:bg-teal-200 transition transform hover:-translate-y-1">{t('extendedEvaluationElements')}</button>
            <button onClick={() => setView('subject_specific')} className="p-6 bg-indigo-100 text-indigo-800 font-bold rounded-lg shadow hover:bg-indigo-200 transition transform hover:-translate-y-1">{t('subjectSpecificEvaluationElements')}</button>
        </div>
    );
};

const PerformanceLevelSection: React.FC<{title: string, criteria: any[]}> = ({title, criteria}) => {
    const { t } = useLanguage();
    if(criteria.length === 0) return null;
    return (
        <Section title={title} defaultOpen>
            <div className="space-y-4">
                {criteria.map((c: any) => (
                    <div key={c.label} className="p-2 border-b last:border-0 pb-3">
                        <div className="flex justify-between items-center font-semibold bg-gray-50 p-2 rounded mb-2">
                            <span className="text-gray-800">{c.label}</span>
                            <span className="text-primary font-bold">{t('overallAverage')}: {c.overallAverage.toFixed(1)}%</span>
                        </div>
                        <ul className="list-decimal list-inside ps-4 text-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                           {c.teacherAvgs.map((t: any) => <li key={t.teacherId} className="text-gray-600">{t.name} <span className="font-bold">({t.avg.toFixed(1)}%)</span></li>)}
                        </ul>
                    </div>
                ))}
            </div>
        </Section>
    );
};


// --- Supervisory Reports Tab ---
const SupervisoryReportsView: React.FC<PerformanceDashboardProps> = (props) => {
    const { t } = useLanguage();
    
    const handleSyllabusProgressExport = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => {
        const classSessionReports = props.reports.filter(r => r.evaluationType === 'class_session' && r.syllabusProgress);
        const ahead = classSessionReports.filter(r => r.syllabusProgress?.status === 'ahead');
        const onTrack = classSessionReports.filter(r => r.syllabusProgress?.status === 'on_track');
        const behind = classSessionReports.filter(r => r.syllabusProgress?.status === 'behind');
        const teacherMap = new Map(props.teachers.map(t => [t.id, t.name]));

        const data = [
            `${t('aheadOfSyllabus')} (${ahead.length})`,
            ...ahead.map(r => `  - ${teacherMap.get(r.teacherId)} (${r.subject} - ${r.grades})`),
            '',
            `${t('onTrackWithSyllabus')} (${onTrack.length})`,
            ...onTrack.map(r => `  - ${teacherMap.get(r.teacherId)} (${r.subject} - ${r.grades})`),
            '',
            `${t('behindSyllabus')} (${behind.length})`,
            ...behind.map(r => `  - ${teacherMap.get(r.teacherId)} (${r.subject} - ${r.grades})`),
        ];
        exportSupervisorySummaryUtil({ format, title: t('syllabusProgress'), data, t });
    };

    const handlePeerVisitExport = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => {
        const visits = props.peerVisits.filter(v => v.visitingTeacher);
        const total = visits.length;
        const completed = visits.filter(v => v.status === 'تمت الزيارة').length;
        const inProgress = visits.filter(v => v.status === 'قيد التنفيذ').length;
        const notCompleted = visits.filter(v => v.status === 'لم تتم' || !v.status).length;
        
        const visitsByTeacher = visits.reduce((acc, visit) => {
            acc[visit.visitingTeacher] = (acc[visit.visitingTeacher] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const details = Object.entries(visitsByTeacher).map(([teacher, count]) => `${teacher}: ${count}`);
        
        const data = [
            `${t('totalVisits')}: ${total}`,
            `تمت الزيارة: ${completed}`,
            `قيد التنفيذ: ${inProgress}`,
            `لم تتم: ${notCompleted}`,
            '',
            t('visitsConductedBy') + ':', 
            ...details
        ];
        exportSupervisorySummaryUtil({ format, title: t('peerVisitsReport'), data, t });
    };

    return (
        <div className="space-y-6">
             <Section title={t('syllabusProgress')} onExport={handleSyllabusProgressExport}>
                <SyllabusDashboardReport reports={props.reports} teachers={props.teachers} />
            </Section>
            <Section title={t('meetingOutcomesReport')}>
                <MeetingOutcomesReport meetings={props.meetings} />
            </Section>
             <Section title={t('peerVisitsReport')} onExport={handlePeerVisitExport}>
                <PeerVisitsReport {...props} />
            </Section>
            <Section title={t('deliveryRecordsReport')}><DeliveryRecordsReport {...props} /></Section>
            <Section title={t('syllabusCoverageReport')}><SyllabusCoverageProgressReport {...props} /></Section>
        </div>
    );
};

const MeetingOutcomesReport: React.FC<{ meetings: Meeting[] }> = ({ meetings }) => {
    const { t } = useLanguage();
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [stats, setStats] = useState<any>(null);

    const handleCalculate = useCallback(() => {
        const { start, end } = dateRange;
        if (!start || !end) return;
        const startDate = new Date(start);
        const endDate = new Date(end);

        const relevantMeetings = meetings.filter(m => {
            const meetingDate = new Date(m.date);
            return meetingDate >= startDate && meetingDate <= endDate;
        });
        
        const allOutcomes = relevantMeetings.flatMap(m => m.outcomes.filter(o => o.outcome));
        
        const total = allOutcomes.length;
        if (total === 0) {
            setStats({ total: 0, executed: 0, inProgress: 0, notExecuted: 0, percentages: { executed: 0, inProgress: 0, notExecuted: 0 } });
            return;
        }
        
        const executed = allOutcomes.filter(o => o.status === 'تم التنفيذ').length;
        const inProgress = allOutcomes.filter(o => o.status === 'قيد التنفيذ').length;
        const notExecuted = total - executed - inProgress;

        setStats({
            total,
            executed,
            inProgress,
            notExecuted,
            percentages: {
                executed: (executed / total) * 100,
                inProgress: (inProgress / total) * 100,
                notExecuted: (notExecuted / total) * 100
            }
        });
    }, [meetings, dateRange]);

    const handleExport = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => {
        if (!stats) return;
        exportMeetingSummaryUtil({ format, stats, dateRange, t });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-2 bg-gray-50 rounded">
                <div><label className="text-sm font-medium">{t('from_date')}</label><input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="w-full p-2 border rounded" /></div>
                <div><label className="text-sm font-medium">{t('to_date')}</label><input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="w-full p-2 border rounded" /></div>
                <button onClick={handleCalculate} className="w-full px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-opacity-90 transition transform hover:scale-105">{t('calculate')}</button>
            </div>
            {stats && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                            <p className="font-bold text-2xl text-green-700">{stats.executed} <span className="text-sm">({stats.percentages.executed.toFixed(0)}%)</span></p>
                            <p className="text-green-600">{t('executed')}</p>
                        </div>
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
                             <p className="font-bold text-2xl text-yellow-700">{stats.inProgress} <span className="text-sm">({stats.percentages.inProgress.toFixed(0)}%)</span></p>
                             <p className="text-green-600">{t('inProgress')}</p>
                        </div>
                         <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                             <p className="font-bold text-2xl text-red-700">{stats.notExecuted} <span className="text-sm">({stats.percentages.notExecuted.toFixed(0)}%)</span></p>
                             <p className="text-red-600">{t('notExecuted')}</p>
                        </div>
                    </div>
                    <ExportButtons onExport={handleExport} />
                </>
            )}
        </div>
    );
};

const PeerVisitsReport: React.FC<{ peerVisits: PeerVisit[] }> = ({ peerVisits }) => {
    const { t } = useLanguage();
    const stats = useMemo(() => {
        const visits = peerVisits.filter(v => v.visitingTeacher.trim() !== '');
        const total = visits.length;

        const visitsByTeacher = visits.reduce((acc, visit) => {
            acc[visit.visitingTeacher] = (acc[visit.visitingTeacher] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        if (total === 0) return { total: 0, visitsByTeacher, completed: 0, inProgress: 0, notCompleted: 0 };
        
        const completed = visits.filter(v => v.status === 'تمت الزيارة').length;
        const inProgress = visits.filter(v => v.status === 'قيد التنفيذ').length;
        const notCompleted = visits.filter(v => v.status === 'لم تتم' || !v.status).length;

        return { total, visitsByTeacher, completed, inProgress, notCompleted };
    }, [peerVisits]);

    return (
        <div>
            <p className="mb-2"><strong>{t('totalVisits')}:</strong> {stats.total}</p>
            <div className="grid grid-cols-3 gap-2 my-4 text-center">
                <div className="p-3 bg-green-100 rounded border border-green-200 font-bold text-green-800">تمت: {stats.completed}</div>
                <div className="p-3 bg-yellow-100 rounded border border-yellow-200 font-bold text-yellow-800">قيد التنفيذ: {stats.inProgress}</div>
                <div className="p-3 bg-red-100 rounded border border-red-200 font-bold text-red-800">لم تتم: {stats.notCompleted}</div>
            </div>
            <h4 className="font-semibold mt-4 text-primary">{t('visitsConductedBy')}:</h4>
            <ul className="list-disc ps-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-2">
                {Object.entries(stats.visitsByTeacher).map(([teacher, count]) => (
                    <li key={teacher} className="text-gray-700">{teacher}: <span className="font-bold">{count}</span></li>
                ))}
            </ul>
        </div>
    );
};

const DeliveryRecordsReport: React.FC<{ deliverySheets: DeliverySheet[], teachers: Teacher[] }> = ({ deliverySheets, teachers }) => {
    const { t } = useLanguage();
    const handleExport = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp', title: string, data: any[]) => {
        exportSupervisorySummaryUtil({ format, title, data, t });
    };

    return (
        <div className="space-y-6">
            {deliverySheets.map(sheet => {
                const total = sheet.records.length;
                const delivered = sheet.records.filter(r => r.deliveryDate);
                const notDelivered = sheet.records.filter(r => !r.deliveryDate);
                if (total === 0) return null;

                const exportData = [
                    `${t('delivered')}: ${delivered.length} / ${total} (${(delivered.length / total * 100).toFixed(1)}%)`,
                    `(${delivered.map(r => r.teacherName).join(', ')})`,
                    `${t('notDelivered')}: ${notDelivered.length} / ${total} (${(notDelivered.length / total * 100).toFixed(1)}%)`,
                    `(${notDelivered.map(r => r.teacherName).join(', ')})`
                ];

                return (
                    <div key={sheet.id} className="p-4 border rounded-lg bg-white shadow-sm">
                        <h4 className="font-bold text-primary border-b pb-2 mb-3">{sheet.name}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="p-3 bg-emerald-50 rounded border border-emerald-100">
                                <p className="font-bold text-emerald-700">{t('delivered')}: {delivered.length} من {total} ({(delivered.length / total * 100).toFixed(1)}%)</p>
                                <p className="text-xs text-emerald-600 mt-1 italic">{delivered.map(r => r.teacherName).slice(0, 5).join('، ')}{delivered.length > 5 ? '...' : ''}</p>
                            </div>
                            <div className="p-3 bg-rose-50 rounded border border-rose-100">
                                <p className="font-bold text-rose-700">{t('notDelivered')}: {notDelivered.length} من {total} ({(notDelivered.length / total * 100).toFixed(1)}%)</p>
                                <p className="text-xs text-rose-600 mt-1 italic">{notDelivered.map(r => r.teacherName).slice(0, 5).join('، ')}{notDelivered.length > 5 ? '...' : ''}</p>
                            </div>
                        </div>
                        <ExportButtons onExport={(format) => handleExport(format, sheet.name, exportData)} />
                    </div>
                )
            })}
            {deliverySheets.length === 0 && <p className="text-center text-gray-400 italic py-4">لا توجد سجلات تسليم حالياً.</p>}
        </div>
    );
};

const SyllabusCoverageProgressReport: React.FC<{ syllabusCoverageReports: SyllabusCoverageReport[], teachers: Teacher[] }> = ({ syllabusCoverageReports, teachers }) => {
    const { t } = useLanguage();
    const [filter, setFilter] = useState('all');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);

    const filteredAndGrouped = useMemo(() => {
        let filtered = syllabusCoverageReports;
        if (filter === 'grade' && selectedGrade) {
            filtered = filtered.filter(r => r.grade === selectedGrade);
        }
        if (filter === 'subject' && selectedSubject) {
            filtered = filtered.filter(r => r.subject === selectedSubject);
        }
        
        const ahead = filtered.filter(r => r.branches.some(b => b.status === 'ahead'));
        const onTrack = filtered.filter(r => r.branches.every(b => b.status === 'on_track'));
        const behind = filtered.filter(r => r.branches.some(b => b.status === 'behind') && !r.branches.some(b => b.status === 'ahead'));

        const sortFn = (a: SyllabusCoverageReport, b: SyllabusCoverageReport) => {
            if (filter === 'grade') return a.subject.localeCompare(b.subject);
            if (filter === 'subject') return GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade);
            const subjectCompare = a.subject.localeCompare(b.subject);
            return subjectCompare === 0 ? GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) : subjectCompare;
        };

        return {
            ahead: ahead.sort(sortFn),
            onTrack: onTrack.sort(sortFn),
            behind: behind.sort(sortFn)
        };

    }, [syllabusCoverageReports, filter, selectedGrade, selectedSubject]);

    const handleExport = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => {
        const title = t('syllabusCoverageReport');
        const data = [
            `${t('aheadOfSyllabus')} (${filteredAndGrouped.ahead.length})`,
            ...filteredAndGrouped.ahead.map(r => `  - ${r.subject} - ${r.grade} (${teacherMap.get(r.teacherId)})`),
            '',
            `${t('onTrackWithSyllabus')} (${filteredAndGrouped.onTrack.length})`,
            ...filteredAndGrouped.onTrack.map(r => `  - ${r.subject} - ${r.grade} (${teacherMap.get(r.teacherId)})`),
            '',
            `${t('behindSyllabus')} (${filteredAndGrouped.behind.length})`,
            ...filteredAndGrouped.behind.map(r => `  - ${r.subject} - ${r.grade} (${teacherMap.get(r.teacherId)})`)
        ];
        exportSupervisorySummaryUtil({ format, title, data, t });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg border shadow-sm">
                <div className="flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">تصفية العرض</label>
                    <select value={filter} onChange={e => setFilter(e.target.value)} className="p-2 border rounded w-full bg-white text-sm">
                        <option value="all">{t('allSubjectsAndGrades')}</option>
                        <option value="grade">{t('byGrade')}</option>
                        <option value="subject">{t('bySubject')}</option>
                    </select>
                </div>
                {filter === 'grade' && (
                    <div className="flex-1 min-w-[150px]">
                         <label className="text-xs font-bold text-gray-500 mb-1 block">اختر الصف</label>
                        <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} className="p-2 border rounded w-full bg-white text-sm">{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                    </div>
                )}
                {filter === 'subject' && (
                    <div className="flex-1 min-w-[150px]">
                         <label className="text-xs font-bold text-gray-500 mb-1 block">اختر المادة</label>
                        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-2 border rounded w-full bg-white text-sm">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    </div>
                )}
            </div>
            <div className="space-y-6">
                <SyllabusGroup title={t('aheadOfSyllabus')} reports={filteredAndGrouped.ahead} teacherMap={teacherMap} color="text-blue-600" bgColor="bg-blue-50" />
                <SyllabusGroup title={t('onTrackWithSyllabus')} reports={filteredAndGrouped.onTrack} teacherMap={teacherMap} color="text-green-600" bgColor="bg-green-50" />
                <SyllabusGroup title={t('behindSyllabus')} reports={filteredAndGrouped.behind} teacherMap={teacherMap} color="text-red-600" bgColor="bg-red-50" />
            </div>
            {syllabusCoverageReports.length > 0 && <ExportButtons onExport={handleExport} />}
        </div>
    );
};

const SyllabusGroup: React.FC<{title: string, reports: (SyllabusCoverageReport | Report)[], teacherMap: Map<string, string>, color: string, bgColor: string}> = ({title, reports, teacherMap, color, bgColor}) => {
    if(reports.length === 0) return null;
    return (
        <div className={`p-4 rounded-lg border ${bgColor} shadow-sm transition transform hover:scale-[1.01]`}>
            <h4 className={`font-bold text-lg ${color} border-b border-white pb-2 mb-3`}>{title} ({reports.length})</h4>
            <ul className="list-disc ps-6 space-y-1 grid grid-cols-1 md:grid-cols-2">
                {reports.map(r => <li key={r.id} className="text-gray-700 text-sm">{r.subject} - {r.grades} <span className="font-semibold text-gray-900">({teacherMap.get(r.teacherId)})</span></li>)}
            </ul>
        </div>
    )
}

const SyllabusDashboardReport: React.FC<{ reports: Report[], teachers: Teacher[] }> = ({ reports, teachers }) => {
    const { t } = useLanguage();
    const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);

    const progressData = useMemo(() => {
        const classSessionReports = reports.filter(r => r.evaluationType === 'class_session' && r.syllabusProgress);
        
        const ahead = classSessionReports.filter(r => r.syllabusProgress?.status === 'ahead');
        const onTrack = classSessionReports.filter(r => r.syllabusProgress?.status === 'on_track');
        const behind = classSessionReports.filter(r => r.syllabusProgress?.status === 'behind');
        
        return (
            <div className="space-y-6 mt-4">
                <SyllabusGroup title={t('aheadOfSyllabus')} reports={ahead} teacherMap={teacherMap} color="text-blue-600" bgColor="bg-blue-50" />
                <SyllabusGroup title={t('onTrackWithSyllabus')} reports={onTrack} teacherMap={teacherMap} color="text-green-600" bgColor="bg-green-50" />
                <SyllabusGroup title={t('behindSyllabus')} reports={behind} teacherMap={teacherMap} color="text-red-600" bgColor="bg-red-50" />
            </div>
        )
    }, [reports, teacherMap, t]);

    return progressData;
};

// --- Main Dashboard Component ---

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = (props) => {
  const { reports, teachers, tasks, meetings, peerVisits, deliverySheets, syllabusCoverageReports } = props;
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('keyMetrics');

  const renderContent = () => {
      switch(activeTab) {
          case 'keyMetrics': return <KeyMetricsView reports={reports} teachers={teachers} />;
          case 'reportSummary': return <ReportSummaryView reports={reports} teachers={teachers} />;
          case 'evaluationAnalysis': return <EvaluationAnalysisView reports={reports} teachers={teachers} />;
          case 'supervisoryReports': return <SupervisoryReportsView {...props} />;
          default: return null;
      }
  };

  const getTabClass = (id: string) => `px-6 py-3 rounded-t-lg font-bold transition-all text-sm md:text-base border-b-4 ${activeTab === id ? 'bg-primary text-white border-primary-light shadow-lg' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`;

  return (
    <div className="p-6 bg-white rounded-xl shadow-2xl space-y-8 animate-fadeIn">
        <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-primary">{t('performanceIndicators')}</h2>
            <div className="w-24 h-1 bg-primary-light mx-auto rounded-full"></div>
        </div>
        
        <div className="flex flex-wrap justify-center border-b border-gray-200 overflow-x-auto">
            <button onClick={() => setActiveTab('keyMetrics')} className={getTabClass('keyMetrics')}>{t('keyMetrics')}</button>
            <button onClick={() => setActiveTab('reportSummary')} className={getTabClass('reportSummary')}>{t('reportSummary')}</button>
            <button onClick={() => setActiveTab('evaluationAnalysis')} className={getTabClass('evaluationAnalysis')}>{t('evaluationElementAnalysis')}</button>
            <button onClick={() => setActiveTab('supervisoryReports')} className={getTabClass('supervisoryReports')}>{t('supervisoryReports')}</button>
        </div>
        
        <div className="transition-opacity duration-300">
            {renderContent()}
        </div>
    </div>
  );
};

export default PerformanceDashboard;