
import React, { useState, useEffect } from 'react';
import { SelfEvaluationReport, Teacher, SyllabusPlan } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { exportSelfEvaluation } from '../lib/exportUtils';
import CustomizableInputSection from './CustomizableInputSection';
import { COMMON_STRATEGIES, COMMON_TOOLS, COMMON_SOURCES } from '../constants';

interface SelfEvaluationFormProps {
    teacher: Teacher;
    onSave: (report: SelfEvaluationReport) => void;
    onCancel: () => void;
    academicYear: string;
    selectedSchool: string;
    initialReport?: SelfEvaluationReport;
}

const inputClass = "w-full bg-transparent outline-none border-b border-gray-300 focus:border-primary p-1 text-right";
const LabeledInputWrapper: React.FC<{label: string, children: React.ReactNode, className?: string}> = ({ label, children, className }) => (
    <div className={`flex items-center w-full p-2 border rounded focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition bg-inherit ${className}`}>
        <span className="pl-2 rtl:pr-0 rtl:pl-2 text-gray-500 text-sm whitespace-nowrap font-bold">{label}</span>
        {children}
    </div>
);

const SelfEvaluationForm: React.FC<SelfEvaluationFormProps> = ({ teacher, onSave, onCancel, academicYear, selectedSchool, initialReport }) => {
    const { t } = useLanguage();
    
    // Initialize state
    const [formData, setFormData] = useState<SelfEvaluationReport>(initialReport || {
        id: `self-eval-${Date.now()}`,
        teacherId: teacher.id,
        date: new Date().toISOString().split('T')[0],
        school: selectedSchool || teacher.schoolName,
        subject: teacher.subjects?.split(',')[0] || '',
        grades: teacher.gradesTaught?.split(',')[0] || '',
        branch: teacher.branch || 'main',
        evaluationType: 'self_evaluation',
        semester: 'الأول',
        academicYear: academicYear,
        
        lastLessons: [{ branch: '', lesson: '', status: 'match', count: 0 }],
        syllabusStatus: 'match', // Kept for backward compatibility but not used in UI
        syllabusLessonCount: 0,
        developmentalMeetingsCount: 0,
        notebookCorrectionPercentage: 100,
        preparationBookPercentage: 100,
        questionsGlossaryPercentage: 100,
        
        programsAndSkills: '',
        strategiesExecuted: '',
        toolsUsed: '',
        sourcesUsed: '',
        tasksAccomplished: '',
        testsDelivered: '',
        peerVisitsDone: '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (name: keyof SelfEvaluationReport, value: string) => {
        const num = parseInt(value) || 0;
        setFormData(prev => ({ ...prev, [name]: num }));
    };

    const handlePercentageChange = (name: keyof SelfEvaluationReport, value: string) => {
        let num = parseInt(value) || 0;
        if (num > 100) num = 100;
        if (num < 0) num = 0;
        setFormData(prev => ({ ...prev, [name]: num }));
    };

    // Syllabus Logic
    const handleAddLessonField = () => {
        setFormData(prev => ({
            ...prev,
            lastLessons: [...prev.lastLessons, { branch: '', lesson: '', status: 'match', count: 0 }]
        }));
    };

    const handleLessonChange = (index: number, field: 'branch' | 'lesson' | 'status' | 'count', value: string | number) => {
        const newLessons = [...formData.lastLessons];
        (newLessons[index] as any)[field] = value;
        setFormData(prev => ({ ...prev, lastLessons: newLessons }));
    };

    const handleRemoveLessonField = (index: number) => {
        const newLessons = formData.lastLessons.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, lastLessons: newLessons }));
    };

    return (
        <div className="p-4 md:p-6 rounded-lg shadow-md space-y-6 bg-white border border-gray-200">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-primary">{t('selfEvaluation')} - {teacher.name}</h2>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">&times; {t('cancel')}</button>
            </div>

            {/* --- Header Data (All Editable) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50">
                <LabeledInputWrapper label={t('schoolNameLabel')}>
                    <input type="text" name="school" value={formData.school} onChange={handleInputChange} className={inputClass} />
                </LabeledInputWrapper>
                <LabeledInputWrapper label={t('academicYear')}>
                    <input type="text" name="academicYear" value={formData.academicYear} onChange={handleInputChange} className={inputClass} />
                </LabeledInputWrapper>
                <LabeledInputWrapper label={t('semesterLabel')}>
                    <select name="semester" value={formData.semester} onChange={handleInputChange} className={`${inputClass} appearance-none`}>
                        <option value="الأول">{t('semester1')}</option>
                        <option value="الثاني">{t('semester2')}</option>
                    </select>
                </LabeledInputWrapper>
                <LabeledInputWrapper label={t('teacherName')}>
                    <input type="text" value={teacher.name} readOnly className={`${inputClass} bg-gray-100 text-gray-600`} />
                </LabeledInputWrapper>
                <LabeledInputWrapper label={t('subjectLabel')}>
                    <input type="text" name="subject" value={formData.subject} onChange={handleInputChange} className={inputClass} />
                </LabeledInputWrapper>
                <LabeledInputWrapper label={t('gradesLabel')}>
                    <input type="text" name="grades" value={formData.grades} onChange={handleInputChange} className={inputClass} />
                </LabeledInputWrapper>
                <LabeledInputWrapper label={t('branchLabel')}>
                    <select name="branch" value={formData.branch} onChange={handleInputChange} className={`${inputClass} appearance-none`}>
                        <option value="main">{t('mainBranch')}</option>
                        <option value="boys">{t('boysBranch')}</option>
                        <option value="girls">{t('girlsBranch')}</option>
                    </select>
                </LabeledInputWrapper>
                <LabeledInputWrapper label={t('dateLabel')}>
                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} className={inputClass} />
                </LabeledInputWrapper>
            </div>

            {/* --- Syllabus Tracking --- */}
            <div className="p-4 border rounded-lg space-y-4">
                <h3 className="font-bold text-lg text-primary border-b pb-2">{t('lastLessonTaken')} & {t('syllabusStatusLabel')}</h3>
                <div className="space-y-4">
                    {formData.lastLessons.map((lesson, index) => (
                        <div key={index} className="flex flex-col md:flex-row gap-2 items-center border-b pb-2">
                            <input 
                                type="text" 
                                placeholder={t('lessonBranchPlaceholder')} 
                                value={lesson.branch} 
                                onChange={e => handleLessonChange(index, 'branch', e.target.value)} 
                                className="border p-2 rounded w-full md:w-1/4"
                            />
                            <input 
                                type="text" 
                                placeholder={t('lessonNamePlaceholder')} 
                                value={lesson.lesson} 
                                onChange={e => handleLessonChange(index, 'lesson', e.target.value)} 
                                className="border p-2 rounded w-full md:w-1/3"
                            />
                            
                            {/* Status and Count per lesson */}
                            <div className="flex gap-2 items-center flex-grow">
                                <select 
                                    value={lesson.status} 
                                    onChange={e => handleLessonChange(index, 'status', e.target.value)} 
                                    className="border p-2 rounded bg-white"
                                >
                                    <option value="match">{t('matchMinistryPlan')}</option>
                                    <option value="ahead">{t('aheadMinistryPlan')}</option>
                                    <option value="behind">{t('behindMinistryPlan')}</option>
                                </select>
                                {(lesson.status === 'ahead' || lesson.status === 'behind') && (
                                    <>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            value={lesson.count || ''} 
                                            onChange={e => handleLessonChange(index, 'count', parseInt(e.target.value) || 0)} 
                                            className="border p-2 rounded w-16 text-center" 
                                        />
                                        <span className="text-sm">{t('lessons')}</span>
                                    </>
                                )}
                            </div>

                            {formData.lastLessons.length > 1 && (
                                <button onClick={() => handleRemoveLessonField(index)} className="text-red-500 font-bold px-2">X</button>
                            )}
                        </div>
                    ))}
                    <button onClick={handleAddLessonField} className="text-sm text-blue-600 hover:underline">+ {t('addLessonField')}</button>
                </div>
            </div>

            {/* --- Metrics --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg bg-gray-50">
                    <label className="block font-semibold mb-2">{t('developmentalMeetings')}</label>
                    <input 
                        type="number" 
                        min="0" 
                        value={formData.developmentalMeetingsCount} 
                        onChange={e => handleNumberChange('developmentalMeetingsCount', e.target.value)} 
                        className="w-full border p-2 rounded" 
                    />
                </div>
                <div className="p-4 border rounded-lg bg-gray-50">
                    <label className="block font-semibold mb-2">{t('notebookCorrection')} ({formData.notebookCorrectionPercentage}%)</label>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={formData.notebookCorrectionPercentage} 
                        onChange={e => handlePercentageChange('notebookCorrectionPercentage', e.target.value)} 
                        className="w-full" 
                    />
                </div>
                <div className="p-4 border rounded-lg bg-gray-50">
                    <label className="block font-semibold mb-2">{t('preparationBook')} ({formData.preparationBookPercentage}%)</label>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={formData.preparationBookPercentage} 
                        onChange={e => handlePercentageChange('preparationBookPercentage', e.target.value)} 
                        className="w-full" 
                    />
                </div>
                <div className="p-4 border rounded-lg bg-gray-50">
                    <label className="block font-semibold mb-2">{t('questionsGlossary')} ({formData.questionsGlossaryPercentage}%)</label>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={formData.questionsGlossaryPercentage} 
                        onChange={e => handlePercentageChange('questionsGlossaryPercentage', e.target.value)} 
                        className="w-full" 
                    />
                </div>
            </div>

            {/* --- Dynamic Text Sections --- */}
            <div className="space-y-6">
                <CustomizableInputSection 
                    title={t('programsSkills')} 
                    value={formData.programsAndSkills} 
                    onChange={v => setFormData(p => ({...p, programsAndSkills: v}))} 
                    defaultItems={[]} 
                    localStorageKey="selfEval_programs" 
                />
                <CustomizableInputSection 
                    title={t('strategiesUsed')} 
                    value={formData.strategiesExecuted} 
                    onChange={v => setFormData(p => ({...p, strategiesExecuted: v}))} 
                    defaultItems={COMMON_STRATEGIES} 
                    localStorageKey="selfEval_strategies" 
                />
                <CustomizableInputSection 
                    title={t('toolsUsed')} 
                    value={formData.toolsUsed} 
                    onChange={v => setFormData(p => ({...p, toolsUsed: v}))} 
                    defaultItems={COMMON_TOOLS} 
                    localStorageKey="selfEval_tools" 
                />
                <CustomizableInputSection 
                    title={t('sourcesUsed')} 
                    value={formData.sourcesUsed} 
                    onChange={v => setFormData(p => ({...p, sourcesUsed: v}))} 
                    defaultItems={COMMON_SOURCES} 
                    localStorageKey="selfEval_sources" 
                />
                <CustomizableInputSection 
                    title={t('assignmentsDone')} 
                    value={formData.tasksAccomplished} 
                    onChange={v => setFormData(p => ({...p, tasksAccomplished: v}))} 
                    defaultItems={[]} 
                    localStorageKey="selfEval_tasks" 
                />
                <CustomizableInputSection 
                    title={t('testsDelivered')} 
                    value={formData.testsDelivered} 
                    onChange={v => setFormData(p => ({...p, testsDelivered: v}))} 
                    defaultItems={[]} 
                    localStorageKey="selfEval_tests" 
                />
                <CustomizableInputSection 
                    title={t('peerVisitsDone')} 
                    value={formData.peerVisitsDone} 
                    onChange={v => setFormData(p => ({...p, peerVisitsDone: v}))} 
                    defaultItems={[]} 
                    localStorageKey="selfEval_visits" 
                />
            </div>

            {/* --- Footer Actions --- */}
            <div className="flex flex-wrap justify-center gap-3 pt-4 border-t">
                <button onClick={() => onSave(formData)} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105">{t('save')}</button>
                <button onClick={() => exportSelfEvaluation(formData, teacher, t, 'txt')} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">{t('exportTxt')}</button>
                <button onClick={() => exportSelfEvaluation(formData, teacher, t, 'pdf')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">{t('exportPdf')}</button>
                <button onClick={() => exportSelfEvaluation(formData, teacher, t, 'excel')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">{t('exportExcel')}</button>
            </div>
        </div>
    );
};

export default SelfEvaluationForm;
