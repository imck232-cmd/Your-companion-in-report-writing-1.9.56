
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { 
    Teacher, Report, CustomCriterion, SpecialReportTemplate, SyllabusPlan, 
    Task, Meeting, PeerVisit, DeliverySheet, BulkMessage, SyllabusCoverageReport, 
    SupervisoryPlanWrapper 
} from '../types';
import SelfEvaluationForm from './SelfEvaluationForm';
import EvaluationSummary from './EvaluationSummary';
import ReportView from './ReportView';
import TeacherList from './TeacherList';
import PerformanceDashboard from './PerformanceDashboard';
import SyllabusCoverageManager from './SyllabusCoverageManager';
import SupervisoryPlanComponent from './SupervisoryPlan';
import TaskPlan from './TaskPlan';
import SupervisoryTools from './SupervisoryTools';
import SpecialReportsAdmin from './SpecialReportsAdmin';
import CriterionManager from './CriterionManager';
import AggregatedReports from './AggregatedReports';
import BulkMessageSender from './BulkMessageSender';
import SyllabusPlanner from './SyllabusPlanner';
import UserManagement from './UserManagement';

type View = 'teachers' | 'evaluation_summary' | 'self_evaluation' | 'performance_dashboard' | 'syllabus_coverage' | 'supervisory_plan' | 'task_plan' | 'supervisory_tools' | 'manage_criteria' | 'special_reports_admin' | 'aggregated_reports' | 'bulk_message' | 'syllabus_plan' | 'user_management';

interface TeacherManagementProps {
    teachers: Teacher[];
    allTeachers: Teacher[];
    reports: Report[];
    customCriteria: CustomCriterion[];
    specialReportTemplates: SpecialReportTemplate[];
    syllabusPlans: SyllabusPlan[];
    syllabusCoverageReports: SyllabusCoverageReport[];
    tasks: Task[];
    meetings: Meeting[];
    peerVisits: PeerVisit[];
    deliverySheets: DeliverySheet[];
    bulkMessages: BulkMessage[];
    supervisoryPlans: SupervisoryPlanWrapper[];
    setSupervisoryPlans: React.Dispatch<React.SetStateAction<SupervisoryPlanWrapper[]>>;
    selectedSchool: string;
    addTeacher: (teacher: Omit<Teacher, 'id' | 'schoolName'>, schoolName: string) => void;
    updateTeacher: (teacher: Teacher) => void;
    deleteTeacher: (id: string) => void;
    saveReport: (report: Report) => void;
    deleteReport: (id: string) => void;
    saveCustomCriterion: (criterion: CustomCriterion) => void;
    deleteCustomCriteria: (ids: string[]) => void;
    saveSpecialReportTemplate: (template: SpecialReportTemplate) => void;
    deleteSpecialReportTemplate: (id: string) => void;
    saveSyllabusPlan: (plan: SyllabusPlan) => void;
    deleteSyllabusPlan: (id: string) => void;
    setSyllabusCoverageReports: React.Dispatch<React.SetStateAction<SyllabusCoverageReport[]>>;
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    hiddenCriteria: { [key: string]: string[] };
    manageHiddenCriteria: (ids: string[], teacherIds: 'all' | string[]) => void;
    saveMeeting: (meeting: Meeting) => void;
    deleteMeeting: (id: string) => void;
    setPeerVisits: React.Dispatch<React.SetStateAction<PeerVisit[]>>;
    deletePeerVisit: (id: string) => void;
    setDeliverySheets: React.Dispatch<React.SetStateAction<DeliverySheet[]>>;
    deleteDeliverySheet: (id: string) => void;
    setBulkMessages: React.Dispatch<React.SetStateAction<BulkMessage[]>>;
}

// مكون أيقونة مخصص لكل زر
const NavIcon = ({ view }: { view: View }) => {
    switch (view) {
        case 'performance_dashboard': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
        case 'syllabus_coverage': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        case 'aggregated_reports': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
        case 'teachers': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
        case 'supervisory_plan': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>;
        case 'task_plan': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
        case 'supervisory_tools': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
        case 'manage_criteria': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        case 'special_reports_admin': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
        case 'syllabus_plan': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
        case 'bulk_message': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
        case 'user_management': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>;
        case 'evaluation_summary': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
        default: return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
};

const TeacherManagement: React.FC<TeacherManagementProps> = (props) => {
  const { 
    teachers, allTeachers, reports, customCriteria, specialReportTemplates, syllabusPlans, syllabusCoverageReports,
    tasks, meetings, peerVisits, deliverySheets, bulkMessages, supervisoryPlans, setSupervisoryPlans, selectedSchool,
    addTeacher, updateTeacher, deleteTeacher, saveReport, deleteReport, saveCustomCriterion, deleteCustomCriteria,
    saveSpecialReportTemplate, deleteSpecialReportTemplate, saveSyllabusPlan, deleteSyllabusPlan, setSyllabusCoverageReports,
    setTasks, hiddenCriteria, manageHiddenCriteria, saveMeeting, deleteMeeting, setPeerVisits, deletePeerVisit, setDeliverySheets, deleteDeliverySheet, setBulkMessages
  } = props;

  const { t } = useLanguage();
  const { hasPermission, academicYear, currentUser } = useAuth();
  
  const [activeView, setActiveView] = useState<View>('teachers');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [supervisorName, setSupervisorName] = useState(currentUser?.name || '');
  const [semester, setSemester] = useState<'الأول' | 'الثاني'>('الأول');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const isTeacherUser = currentUser && !currentUser.permissions.includes('all') && currentUser.permissions.includes('create_self_evaluation');
  const isSuperAdmin = currentUser?.permissions.includes('all') || currentUser?.name === 'إبراهيم دخان';
  
  const visibleTeachers = useMemo(() => {
      if (isTeacherUser && currentUser) {
          return teachers.filter(t => t.name === currentUser.name);
      }
      return teachers;
  }, [teachers, isTeacherUser, currentUser]);

  useEffect(() => {
      if (isTeacherUser && currentUser) {
          const teacher = teachers.find(t => t.name === currentUser.name);
          if (teacher) {
              setSelectedTeacher(teacher);
              setActiveView('self_evaluation');
          }
      }
  }, [isTeacherUser, currentUser, teachers]);

  const handleSelectTeacher = (teacher: Teacher) => {
      setSelectedTeacher(teacher);
      if (isTeacherUser) {
          setActiveView('self_evaluation');
      } else {
          setActiveView('teachers');
      }
  };

  const handleSaveSelfEvaluation = (report: any) => {
      saveReport(report);
      if (!isTeacherUser) {
          setSelectedTeacher(null);
          setActiveView('teachers');
      } else {
          alert('تم حفظ التقييم الذاتي بنجاح');
      }
  };

  const handleViewReport = (teacherId: string, reportId: string) => {
      const teacher = allTeachers.find(t => t.id === teacherId);
      if (teacher) {
          setSelectedTeacher(teacher);
          setSelectedReportId(reportId);
          setActiveView('teachers');
      }
  };

  const renderView = () => {
    switch (activeView) {
      case 'performance_dashboard':
          return <PerformanceDashboard 
                    reports={reports} 
                    teachers={allTeachers} 
                    tasks={tasks} 
                    meetings={meetings} 
                    peerVisits={peerVisits} 
                    deliverySheets={deliverySheets} 
                    syllabusCoverageReports={syllabusCoverageReports}
                 />;
      case 'syllabus_coverage':
          return <SyllabusCoverageManager 
                    reports={syllabusCoverageReports} 
                    setReports={setSyllabusCoverageReports} 
                    school={selectedSchool} 
                    academicYear={academicYear!} 
                    semester={semester} 
                    allTeachers={allTeachers} 
                 />;
      case 'supervisory_plan':
          return <SupervisoryPlanComponent plans={supervisoryPlans} setPlans={setSupervisoryPlans} />;
      case 'task_plan':
          return <TaskPlan tasks={tasks} setTasks={setTasks} />;
      case 'supervisory_tools':
          return <SupervisoryTools 
                    meetings={meetings} 
                    saveMeeting={saveMeeting} 
                    deleteMeeting={deleteMeeting} 
                    peerVisits={peerVisits} 
                    setPeerVisits={setPeerVisits} 
                    deletePeerVisit={deletePeerVisit} 
                    deliverySheets={deliverySheets} 
                    setDeliverySheets={setDeliverySheets} 
                    deleteDeliverySheet={deleteDeliverySheet} 
                    allTeachers={allTeachers} 
                    academicYear={academicYear!}
                 />;
      case 'manage_criteria':
          return <CriterionManager 
                    customCriteria={customCriteria} 
                    saveCustomCriterion={saveCustomCriterion} 
                    deleteCustomCriteria={deleteCustomCriteria} 
                    teachers={allTeachers} 
                    school={selectedSchool} 
                    hiddenCriteria={hiddenCriteria}
                    manageHiddenCriteria={manageHiddenCriteria}
                 />;
      case 'special_reports_admin':
          return <SpecialReportsAdmin 
                    templates={specialReportTemplates} 
                    saveTemplate={saveSpecialReportTemplate} 
                    deleteTemplate={deleteSpecialReportTemplate} 
                    school={selectedSchool} 
                 />;
      case 'aggregated_reports':
          return <AggregatedReports 
                    reports={reports} 
                    teachers={allTeachers} 
                    tasks={tasks} 
                    meetings={meetings} 
                    peerVisits={peerVisits} 
                    deliverySheets={deliverySheets} 
                 />;
      case 'bulk_message':
          return <BulkMessageSender messages={bulkMessages} setMessages={setBulkMessages} teachers={allTeachers} />;
      case 'syllabus_plan':
          return <SyllabusPlanner syllabusPlans={syllabusPlans} saveSyllabusPlan={saveSyllabusPlan} deleteSyllabusPlan={deleteSyllabusPlan} schoolName={selectedSchool} />;
      case 'user_management':
          return <UserManagement allTeachers={allTeachers} />;
      case 'self_evaluation':
          if (selectedTeacher) {
              const existingReport = reports.find(r => r.teacherId === selectedTeacher.id && r.evaluationType === 'self_evaluation' && r.academicYear === academicYear) as any;
              return <SelfEvaluationForm 
                        teacher={selectedTeacher}
                        onSave={handleSaveSelfEvaluation}
                        onCancel={() => !isTeacherUser && setSelectedTeacher(null)}
                        academicYear={academicYear!}
                        selectedSchool={selectedSchool}
                        initialReport={existingReport}
                     />
          }
          return null;
      case 'evaluation_summary':
        return <EvaluationSummary reports={reports} teachers={allTeachers} onViewReport={handleViewReport} />;
      case 'teachers':
      default:
        if (selectedTeacher) {
          return <ReportView 
                    teacher={selectedTeacher} 
                    reports={reports.filter(r => r.teacherId === selectedTeacher.id)}
                    customCriteria={customCriteria}
                    specialReportTemplates={specialReportTemplates}
                    syllabusPlans={syllabusPlans}
                    onBack={() => { setSelectedTeacher(null); setSelectedReportId(null); }}
                    saveReport={saveReport}
                    deleteReport={deleteReport}
                    updateTeacher={updateTeacher}
                    saveCustomCriterion={saveCustomCriterion}
                    hiddenCriteria={hiddenCriteria}
                    supervisorName={supervisorName}
                    semester={semester}
                    academicYear={academicYear!}
                    initiallyOpenReportId={selectedReportId}
                 />;
        }
        return (
            <>
                <div className="bg-white p-4 rounded-xl shadow-lg mb-6 flex flex-col md:flex-row items-center gap-4 border border-primary-light/20">
                    <input type="text" placeholder={t('supervisorNameLabel')} value={supervisorName} onChange={e => setSupervisorName(e.target.value)} className="p-2 border rounded w-full md:w-auto flex-grow outline-none focus:ring-2 focus:ring-primary-light" />
                    <div className="flex items-center gap-2">
                        <label className="font-semibold text-primary">{t('semesterLabel')}</label>
                        <select value={semester} onChange={e => setSemester(e.target.value as any)} className="p-2 border rounded w-full md:w-auto outline-none focus:ring-2 focus:ring-primary-light">
                            <option value="الأول">{t('semester1')}</option>
                            <option value="الثاني">{t('semester2')}</option>
                        </select>
                    </div>
                </div>
                <TeacherList teachers={visibleTeachers} onSelectTeacher={handleSelectTeacher} addTeacher={(data) => addTeacher(data, selectedSchool)} deleteTeacher={deleteTeacher} updateTeacher={updateTeacher} />
            </>
        );
    }
  };

  const getButtonClass = (view: View) => {
    const isActive = activeView === view;
    return `
      flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 
      transform hover:scale-[1.02] shadow-sm text-sm border-2
      ${isActive 
        ? 'bg-primary text-white border-primary shadow-md scale-105 z-10' 
        : 'bg-white text-gray-600 border-gray-100 hover:border-primary/30 hover:bg-primary/5 hover:text-primary'
      }
    `;
  }

  return (
    <div className="animate-fadeIn">
      {/* Navigation Bar - Modern Grid Layout */}
      {!isTeacherUser && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {(isSuperAdmin || hasPermission('view_performance_dashboard')) && (
                    <button onClick={() => setActiveView('performance_dashboard')} className={getButtonClass('performance_dashboard')}>
                        <NavIcon view="performance_dashboard" />
                        <span>{t('performanceIndicators')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_syllabus_coverage')) && (
                    <button onClick={() => setActiveView('syllabus_coverage')} className={getButtonClass('syllabus_coverage')}>
                        <NavIcon view="syllabus_coverage" />
                        <span>{t('syllabusCoverageReport')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_aggregated_reports')) && (
                    <button onClick={() => setActiveView('aggregated_reports')} className={getButtonClass('aggregated_reports')}>
                        <NavIcon view="aggregated_reports" />
                        <span>{t('aggregatedReports')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_teachers')) && (
                    <button onClick={() => { setActiveView('teachers'); setSelectedTeacher(null); }} className={getButtonClass('teachers')}>
                        <NavIcon view="teachers" />
                        <span>{t('manageTeachersAndReports')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_supervisory_plan')) && (
                    <button onClick={() => setActiveView('supervisory_plan')} className={getButtonClass('supervisory_plan')}>
                        <NavIcon view="supervisory_plan" />
                        <span>{t('supervisoryPlan')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_task_plan')) && (
                    <button onClick={() => setActiveView('task_plan')} className={getButtonClass('task_plan')}>
                        <NavIcon view="task_plan" />
                        <span>{t('taskPlan')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_supervisory_tools')) && (
                    <button onClick={() => setActiveView('supervisory_tools')} className={getButtonClass('supervisory_tools')}>
                        <NavIcon view="supervisory_tools" />
                        <span>{t('supervisoryTools')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('manage_criteria')) && (
                    <button onClick={() => setActiveView('manage_criteria')} className={getButtonClass('manage_criteria')}>
                        <NavIcon view="manage_criteria" />
                        <span>{t('addOrDeleteCriterion')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_special_reports_admin')) && (
                    <button onClick={() => setActiveView('special_reports_admin')} className={getButtonClass('special_reports_admin')}>
                        <NavIcon view="special_reports_admin" />
                        <span>{t('specialReports')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_syllabus')) && (
                    <button onClick={() => setActiveView('syllabus_plan')} className={getButtonClass('syllabus_plan')}>
                        <NavIcon view="syllabus_plan" />
                        <span>{t('syllabusProgress')}</span>
                    </button>
                )}
                {(isSuperAdmin || hasPermission('view_bulk_message')) && (
                    <button onClick={() => setActiveView('bulk_message')} className={getButtonClass('bulk_message')}>
                        <NavIcon view="bulk_message" />
                        <span>{t('bulkMessage')}</span>
                    </button>
                )}
                {isSuperAdmin && (
                    <button onClick={() => setActiveView('user_management')} className={getButtonClass('user_management')}>
                        <NavIcon view="user_management" />
                        <span>{t('specialCodes')}</span>
                    </button>
                )}
                <button onClick={() => setActiveView('evaluation_summary')} className={getButtonClass('evaluation_summary')}>
                    <NavIcon view="evaluation_summary" />
                    <span>{t('evaluationSummary')}</span>
                </button>
            </div>
        </div>
      )}
      
      {isTeacherUser && (
        <div className="flex justify-center mb-6">
            <button onClick={() => setActiveView('self_evaluation')} className={getButtonClass('self_evaluation')}>
                <NavIcon view="evaluation_summary" />
                <span>{t('selfEvaluation')}</span>
            </button>
        </div>
      )}

      {renderView()}
    </div>
  );
};

export default TeacherManagement;
