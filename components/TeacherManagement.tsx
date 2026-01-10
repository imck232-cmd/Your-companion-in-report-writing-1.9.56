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
    return `px-4 py-2 rounded-lg font-bold transition-all text-sm transform hover:scale-105 shadow-sm ${activeView === view ? 'bg-primary text-white scale-110 z-10' : 'bg-white text-gray-600 hover:bg-primary-light hover:text-white'}`;
  }

  return (
    <div className="animate-fadeIn">
      {/* Navigation Bar for Admin and Super Admin */}
      {!isTeacherUser && (
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 p-3 bg-gray-50/50 rounded-2xl border border-gray-200">
          {(isSuperAdmin || hasPermission('view_performance_dashboard')) && <button onClick={() => setActiveView('performance_dashboard')} className={getButtonClass('performance_dashboard')}>{t('performanceIndicators')}</button>}
          {(isSuperAdmin || hasPermission('view_syllabus_coverage')) && <button onClick={() => setActiveView('syllabus_coverage')} className={getButtonClass('syllabus_coverage')}>{t('syllabusCoverageReport')}</button>}
          {(isSuperAdmin || hasPermission('view_aggregated_reports')) && <button onClick={() => setActiveView('aggregated_reports')} className={getButtonClass('aggregated_reports')}>{t('aggregatedReports')}</button>}
          {(isSuperAdmin || hasPermission('view_teachers')) && <button onClick={() => { setActiveView('teachers'); setSelectedTeacher(null); }} className={getButtonClass('teachers')}>{t('manageTeachersAndReports')}</button>}
          {(isSuperAdmin || hasPermission('view_supervisory_plan')) && <button onClick={() => setActiveView('supervisory_plan')} className={getButtonClass('supervisory_plan')}>{t('supervisoryPlan')}</button>}
          {(isSuperAdmin || hasPermission('view_task_plan')) && <button onClick={() => setActiveView('task_plan')} className={getButtonClass('task_plan')}>{t('taskPlan')}</button>}
          {(isSuperAdmin || hasPermission('view_supervisory_tools')) && <button onClick={() => setActiveView('supervisory_tools')} className={getButtonClass('supervisory_tools')}>{t('supervisoryTools')}</button>}
          {(isSuperAdmin || hasPermission('manage_criteria')) && <button onClick={() => setActiveView('manage_criteria')} className={getButtonClass('manage_criteria')}>{t('addOrDeleteCriterion')}</button>}
          {(isSuperAdmin || hasPermission('view_special_reports_admin')) && <button onClick={() => setActiveView('special_reports_admin')} className={getButtonClass('special_reports_admin')}>{t('specialReports')}</button>}
          {(isSuperAdmin || hasPermission('view_syllabus')) && <button onClick={() => setActiveView('syllabus_plan')} className={getButtonClass('syllabus_plan')}>{t('syllabusProgress')}</button>}
          {(isSuperAdmin || hasPermission('view_bulk_message')) && <button onClick={() => setActiveView('bulk_message')} className={getButtonClass('bulk_message')}>{t('bulkMessage')}</button>}
          {isSuperAdmin && <button onClick={() => setActiveView('user_management')} className={getButtonClass('user_management')}>{t('specialCodes')}</button>}
          <button onClick={() => setActiveView('evaluation_summary')} className={getButtonClass('evaluation_summary')}>{t('evaluationSummary')}</button>
        </div>
      )}
      
      {isTeacherUser && (
        <div className="flex justify-center mb-6">
            <button onClick={() => setActiveView('self_evaluation')} className={getButtonClass('self_evaluation')}>{t('selfEvaluation')}</button>
        </div>
      )}

      {renderView()}
    </div>
  );
};

export default TeacherManagement;