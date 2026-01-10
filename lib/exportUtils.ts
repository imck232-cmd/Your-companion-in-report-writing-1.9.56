
// ... existing imports ...
import { Report, GeneralEvaluationReport, ClassSessionEvaluationReport, Teacher, SpecialReport, Task, PeerVisit, DeliveryRecord, Meeting, SyllabusCoverageReport, SyllabusBranchProgress, DeliverySheet, SyllabusPlan, SupervisoryPlanWrapper, SelfEvaluationReport, MeetingOutcome } from '../types';

declare const jspdf: any;
declare const XLSX: any;

// ... existing utility functions ...
const getScorePercentage = (score: number, maxScore: number = 4) => {
    if (maxScore === 0) return 0;
    return (score / maxScore) * 100;
};

const setupPdfDoc = (orientation: 'portrait' | 'landscape' = 'portrait') => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation });
    doc.addFont('https://fonts.gstatic.com/s/amiri/v25/J7aRnpd8CGxBHqU2sQ.woff2', 'Amiri', 'normal');
    doc.setFont('Amiri');
    return doc;
};

const addBorderToPdf = (doc: any) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(22, 120, 109); 
        doc.setLineWidth(0.5);
        doc.rect(5, 5, doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 10);
    }
};

const getTableStyles = () => ({ font: 'Amiri', halign: 'right', cellPadding: 2, margin: { right: 10, left: 10 } });
const getHeadStyles = () => ({ halign: 'center', fillColor: [22, 120, 109], textColor: 255 });

const SEPARATOR = '\n\n━━━━━━━━━━ ✨ ━━━━━━━━━━\n\n';

export const calculateReportPercentage = (report: Report): number => {
    let allScores: number[] = [];
    let maxScorePerItem = 4;

    if (report.evaluationType === 'general' || report.evaluationType === 'special') {
        allScores = (report as GeneralEvaluationReport | SpecialReport).criteria.map(c => c.score);
    } else if (report.evaluationType === 'class_session') {
        allScores = (report as ClassSessionEvaluationReport).criterionGroups.flatMap(g => g.criteria).map(c => c.score);
    }
    
    if (allScores.length === 0) return 0;
    const totalScore = allScores.reduce((sum, score) => sum + score, 0);
    const maxPossibleScore = allScores.length * maxScorePerItem;
    if (maxPossibleScore === 0) return 0;
    return (totalScore / maxPossibleScore) * 100;
};

const generateTextContent = (report: Report, teacher: Teacher): string => {
    let content = `*👤 تقرير لـ:* ${teacher.name}\n`;
    content += `*📅 تاريخ:* ${new Date(report.date).toLocaleDateString()}\n`;
    if (report.academicYear) content += `*🎓 العام الدراسي:* ${report.academicYear}\n`;
    content += `*🏫 المدرسة:* ${report.school}\n`;
    if (report.supervisorName) content += `*🧑‍🏫 المشرف:* ${report.supervisorName}\n`;
    if (report.semester) content += `*🗓️ الفصل الدراسي:* ${report.semester}\n`;
    content += `*📖 المادة:* ${report.subject}\n*👨‍🏫 الصفوف:* ${report.grades}\n`;

    content += `${SEPARATOR}--- *بطاقة معلومات المعلم* ---\n\n`;
    if (teacher.qualification) content += `*المؤهل الدراسي:* ${teacher.qualification}\n`;
    if (teacher.specialization) content += `*التخصص:* ${teacher.specialization}\n`;
    if (teacher.subjects) content += `*المواد التي يدرسها:* ${teacher.subjects}\n`;
    if (teacher.gradesTaught) content += `*الصفوف التي يدرسها:* ${teacher.gradesTaught}\n`;
    if (teacher.sectionsTaught) content += `*الشعب التي يدرسها:* ${teacher.sectionsTaught}\n`;
    if (teacher.weeklyHours) content += `*نصاب الحصص الأسبوعي:* ${teacher.weeklyHours}\n`;
    if (teacher.yearsOfExperience) content += `*سنوات الخبرة:* ${teacher.yearsOfExperience}\n`;
    if (teacher.yearsInSchool) content += `*سنوات العمل بالمدرسة:* ${teacher.yearsInSchool}\n`;
    if (teacher.phoneNumber) content += `*رقم الهاتف:* ${teacher.phoneNumber}\n`;

    if (report.evaluationType === 'general' || report.evaluationType === 'special') {
        const r = report as GeneralEvaluationReport | SpecialReport;
        const title = report.evaluationType === 'general' ? 'تقييم عام' : `تقرير خاص: ${report.templateName}`;
        content += `${SEPARATOR}--- *${title}* ---\n\n`;
        r.criteria.forEach(c => {
            content += `- 📋 *${c.label}:* ${c.score} / 4 (⭐ ${getScorePercentage(c.score, 4).toFixed(0)}%)\n`;
        });
        content += `\n*📊 النسبة المئوية النهائية:* ${calculateReportPercentage(r).toFixed(2)}%\n`;

        if (report.evaluationType === 'general') {
            content += `${SEPARATOR}*💡 أهم الاستراتيجيات المنفذة:*\n${report.strategies}\n`;
            content += `\n*🔧 أهم الوسائل المستخدمة:*\n${report.tools}\n`;
            content += `\n*💻 أهم البرامج المنفذة:*\n${report.programs}\n`;
        }

    } else if (report.evaluationType === 'class_session') {
        const r = report as ClassSessionEvaluationReport;
        content += `${SEPARATOR}--- *تقييم حصة دراسية (${r.subType})* ---\n\n`;
        content += `*🔎 نوع الزيارة:* ${r.visitType}\n`;
        content += `*🏫 الصف:* ${r.class} / ${r.section}\n`;
        content += `*📘 عنوان الدرس:* ${r.lessonName}\n`;

        r.criterionGroups.forEach(group => {
            content += `\n*📌 ${group.title}:*\n`;
            group.criteria.forEach(c => {
                content += `  - ${c.label}: ${c.score} / 4 (⭐ ${getScorePercentage(c.score, 4).toFixed(0)}%)\n`;
            });
        });
        content += `\n*📊 النسبة المئوية النهائية:* ${calculateReportPercentage(r).toFixed(2)}%\n`;
        content += `${SEPARATOR}*👍 الإيجابيات:*\n${r.positives}\n`;
        content += `\n*📝 ملاحظات للتحسين:*\n${r.notesForImprovement}\n`;
        content += `\n*🎯 التوصيات:*\n${r.recommendations}\n`;
        content += `\n*✍️ تعليق الموظف:*\n${r.employeeComment}\n`;
    }

    return content;
};

export const exportToTxt = (report: Report, teacher: Teacher) => {
    const content = generateTextContent(report, teacher).replace(/\*/g, '').replace(/[👤📅🏫📖👨‍🏫🏢💡🔧💻🧑‍🏫🗓️🔎📘📌📊👍📝🎯✍️🎓]/g, '');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${teacher.name}_${report.date}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const generatePdfForReport = (doc: any, report: Report, teacher: Teacher, startY: number) => {
    let y = startY;
    const writeRtl = (text: string, yPos: number) => doc.text(text, 200, yPos, { align: 'right' });

    writeRtl(`تقرير لـ: ${teacher.name}`, y); y += 7;
    if (report.academicYear) { writeRtl(`العام الدراسي: ${report.academicYear}`, y); y += 7; }
    writeRtl(`تاريخ: ${new Date(report.date).toLocaleDateString()}`, y); y += 7;
    writeRtl(`المدرسة: ${report.school} | المادة: ${report.subject} | الصفوف: ${report.grades}`, y); y+= 10;
    
    // Teacher Details Card
    doc.setFont('Amiri', 'bold');
    writeRtl('بطاقة معلومات المعلم', y); y += 7;
    doc.setFont('Amiri', 'normal');
    const teacherDetails = [
        { label: 'المؤهل الدراسي', value: teacher.qualification },
        { label: 'التخصص', value: teacher.specialization },
        { label: 'المواد', value: teacher.subjects },
        { label: 'الصفوف', value: teacher.gradesTaught },
        { label: 'الشعب', value: teacher.sectionsTaught },
        { label: 'النصاب الأسبوعي', value: teacher.weeklyHours },
        { label: 'سنوات الخبرة', value: teacher.yearsOfExperience },
        { label: 'سنوات بالمدرسة', value: teacher.yearsInSchool },
        { label: 'رقم الهاتف', value: teacher.phoneNumber }
    ].filter(item => item.value);
    
    doc.autoTable({
        startY: y,
        body: teacherDetails.map(d => [d.value, d.label]),
        theme: 'plain',
        styles: { font: 'Amiri', halign: 'right', cellPadding: 1 },
        bodyStyles: { cellWidth: 'wrap' },
    });
    y = doc.lastAutoTable.finalY + 10;


    if (report.evaluationType === 'general' || report.evaluationType === 'special') {
        const r = report as GeneralEvaluationReport | SpecialReport;
        const title = report.evaluationType === 'general' ? 'تقييم عام' : `تقرير خاص: ${report.templateName}`;
        writeRtl(title, y); y += 7;

        doc.autoTable({
            startY: y,
            head: [['النسبة', 'الدرجة', 'المعيار']],
            body: r.criteria.map(c => [`%${getScorePercentage(c.score, 4).toFixed(0)}`, c.score, c.label]),
            styles: getTableStyles(), headStyles: getHeadStyles()
        });
        y = doc.lastAutoTable.finalY + 10;
        writeRtl(`النسبة النهائية: ${calculateReportPercentage(r).toFixed(2)}%`, y); y+=10;
        if(report.evaluationType === 'general'){
            doc.text(`أهم الاستراتيجيات المنفذة: ${report.strategies}`, 200, y, { align: 'right', maxWidth: 180 }); y += 15;
            doc.text(`أهم الوسائل المستخدمة: ${report.tools}`, 200, y, { align: 'right', maxWidth: 180 }); y += 15;
            doc.text(`أهم البرامج المنفذة: ${report.programs}`, 200, y, { align: 'right', maxWidth: 180 }); y += 10;
        }

    } else if (report.evaluationType === 'class_session') {
        const r = report as ClassSessionEvaluationReport;
        r.criterionGroups.forEach(group => {
            doc.autoTable({
                startY: y,
                head: [[group.title]],
                body: group.criteria.map(c => [c.label, c.score]),
                styles: getTableStyles(), headStyles: {...getHeadStyles(), fillColor: [75, 85, 99]},
                didParseCell: (data:any) => { data.cell.styles.halign = data.column.index === 1 ? 'center' : 'right' }
            });
            y = doc.lastAutoTable.finalY + 5;
        });
        y+=5;
        writeRtl(`النسبة النهائية: ${calculateReportPercentage(r).toFixed(2)}%`, y); y+=10;
        doc.text(`الإيجابيات: ${r.positives}`, 200, y, { align: 'right', maxWidth: 180 }); y += 15;
        doc.text(`ملاحظات للتحسين: ${r.notesForImprovement}`, 200, y, { align: 'right', maxWidth: 180 }); y += 15;
    }
    return y;
};


export const exportToPdf = (report: Report, teacher: Teacher) => {
    const doc = setupPdfDoc();
    generatePdfForReport(doc, report, teacher, 20);
    addBorderToPdf(doc);
    doc.save(`report_${teacher.name}_${report.date}.pdf`);
};

export const exportToExcel = (report: Report, teacher: Teacher) => {
    const data: any[] = [];
    data.push(["المعلم", teacher.name]);
    data.push(["التاريخ", new Date(report.date).toLocaleDateString()]);
    if (report.academicYear) data.push(["العام الدراسي", report.academicYear]);
    data.push(["المدرسة", report.school]);
    if(report.supervisorName) data.push(["المشرف", report.supervisorName]);
    if(report.semester) data.push(["الفصل الدراسي", report.semester]);
    data.push(["المادة", report.subject]);
    data.push(["الصفوف", report.grades]);
    data.push([]); 

    data.push(['بطاقة معلومات المعلم']); 
    data.push(['المؤهل الدراسي', teacher.qualification || '']);
    data.push(['التخصص', teacher.specialization || '']);
    data.push(['المواد التي يدرسها', teacher.subjects || '']);
    data.push(['الصفوف التي يدرسها', teacher.gradesTaught || '']);
    data.push(['الشعب التي يدرسها', teacher.sectionsTaught || '']);
    data.push(['نصاب الحصص الأسبوعي', teacher.weeklyHours || '']);
    data.push(['سنوات الخبرة', teacher.yearsOfExperience || '']);
    data.push(['سنوات العمل في المدرسة', teacher.yearsInSchool || '']);
    data.push(['رقم الهاتف', teacher.phoneNumber || '']);
    data.push([]); 

    if (report.evaluationType === 'general') {
        const r = report as GeneralEvaluationReport;
        data.push(["نوع التقييم", "تقييم عام"]);
        data.push([]);
        data.push(["المعيار", "الدرجة", "النسبة"]);
        r.criteria.forEach(c => {
            data.push([c.label, c.score, `${getScorePercentage(c.score, 4).toFixed(0)}%`]);
        });
        data.push([]);
        data.push(["النسبة النهائية", `${calculateReportPercentage(r).toFixed(2)}%`]);
        data.push([]);
        data.push(["الاستراتيجيات", r.strategies]);
        data.push(["الوسائل", r.tools]);
        data.push(["البرامج", r.programs]);
        data.push(["المصادر", r.sources]);
    } else if (report.evaluationType === 'class_session') {
        const r = report as ClassSessionEvaluationReport;
        data.push(["نوع التقييم", `تقييم حصة دراسية (${r.subType})`]);
        data.push(["نوع الزيارة", r.visitType], ["الصف", `${r.class} / ${r.section}`], ["عنوان الدرس", r.lessonName]);
        data.push([]);
         r.criterionGroups.forEach(group => {
            data.push([group.title, "الدرجة"]);
            group.criteria.forEach(c => {
                data.push([`  - ${c.label}`, c.score]);
            });
        });
        data.push([]);
        data.push(["النسبة النهائية", `${calculateReportPercentage(r).toFixed(2)}%`]);
        data.push([]);
        data.push(["الاستراتيجيات", r.strategies]);
        data.push(["الوسائل", r.tools]);
        data.push(["المصادر", r.sources]);
        data.push(["البرامج", r.programs]);
        data.push([]);
        data.push(["الإيجابيات", r.positives]);
        data.push(["ملاحظات للتحسين", r.notesForImprovement]);
        data.push(["التوصيات", r.recommendations]);
        data.push(["تعليق الموظف", r.employeeComment]);
    } else if (report.evaluationType === 'special') {
        const r = report as SpecialReport;
        data.push(["نوع التقييم", `تقرير خاص: ${r.templateName}`]);
        data.push([]);
        data.push(["المعيار", "الدرجة", "النسبة"]);
        r.criteria.forEach(c => {
            data.push([c.label, c.score, `${getScorePercentage(c.score, 4).toFixed(0)}%`]);
        });
        data.push([]);
        data.push(["النسبة النهائية", `${calculateReportPercentage(r).toFixed(2)}%`]);
    }


    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `report_${teacher.name}_${report.date}.xlsx`);
};


export const sendToWhatsApp = (report: Report, teacher: Teacher) => {
    const content = generateTextContent(report, teacher);
    const phone = teacher.phoneNumber ? teacher.phoneNumber.replace(/[^0-9]/g, '') : '';
    let whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`;
    if (phone) {
      whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(content)}`;
    }
    window.open(whatsappUrl, '_blank');
};

export const generateAggregatedText = (reports: Report[], teachers: Teacher[]) => {
    const teacherMap = new Map(teachers.map(t => [t.id, t.name]));
    let content = `تقارير مجمعة - ${new Date().toLocaleDateString()}\n\n`;
    reports.forEach(report => {
        const teacherName = teacherMap.get(report.teacherId) || 'Unknown';
        content += `${teacherName} - ${report.evaluationType} - ${new Date(report.date).toLocaleDateString()}\n`;
        content += `النسبة: ${calculateReportPercentage(report).toFixed(2)}%\n`;
        content += `${SEPARATOR}`;
    });
    return content;
};

export const exportAggregatedToTxt = (reports: Report[], teachers: Teacher[]) => {
    const content = generateAggregatedText(reports, teachers);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `aggregated_reports_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportAggregatedToPdf = (reports: Report[], teachers: Teacher[]) => {
    const doc = setupPdfDoc();
    let y = 20;
    reports.forEach((report) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const teacher = teachers.find(t => t.id === report.teacherId) || { name: 'Unknown' } as Teacher;
        y = generatePdfForReport(doc, report, teacher, y) + 20;
        doc.setLineWidth(0.5);
        doc.line(10, y-10, 200, y-10);
    });
    addBorderToPdf(doc);
    doc.save(`aggregated_reports_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportAggregatedToExcel = (reports: Report[], teachers: Teacher[]) => {
    const data: any[] = [];
    data.push(["المعلم", "نوع التقييم", "التاريخ", "النسبة"]);
    const teacherMap = new Map(teachers.map(t => [t.id, t.name]));
    reports.forEach(report => {
        data.push([
            teacherMap.get(report.teacherId),
            report.evaluationType,
            new Date(report.date).toLocaleDateString(),
            `${calculateReportPercentage(report).toFixed(2)}%`
        ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aggregated");
    XLSX.writeFile(wb, `aggregated_reports.xlsx`);
};

export const sendAggregatedToWhatsApp = (reports: Report[], teachers: Teacher[]) => {
    const content = generateAggregatedText(reports, teachers);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`;
    window.open(whatsappUrl, '_blank');
};

export const exportTasks = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp', tasks: Task[], academicYear: string) => {
    if (format === 'excel') {
        const data = tasks.map(t => ({
            "المهمة": t.description,
            "النوع": t.type.join(', '),
            "التاريخ": t.dueDate.join(', '),
            "الحالة": t.status,
            "الإنجاز": `${t.completionPercentage}%`
        }));
        const ws = XLSX.utils.aoa_to_sheet([Object.keys(data[0]), ...data.map(Object.values)]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tasks");
        XLSX.writeFile(wb, "tasks.xlsx");
        return;
    }
    
    let content = `خطة المهام - ${academicYear}\n\n`;
    tasks.forEach(t => {
        content += `- ${t.description} (${t.status} - ${t.completionPercentage}%)\n  ${t.type.join(', ')} | ${t.dueDate.join(', ')}\n`;
    });

    if (format === 'txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tasks.txt`;
        link.click();
    } else if (format === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`, '_blank');
    } else if (format === 'pdf') {
        const doc = setupPdfDoc();
        let y = 20;
        doc.text("خطة المهام", 200, y, { align: "right" }); y += 10;
        tasks.forEach(t => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`- ${t.description} (${t.status})`, 200, y, { align: "right" });
            y += 7;
        });
        doc.save("tasks.pdf");
    }
};

export const exportMeetingSummary = ({ format, stats, dateRange, t }: { format: 'txt' | 'pdf' | 'excel' | 'whatsapp', stats: any, dateRange: { start: string, end: string }, t: (key: string) => string }) => {
    const summary = `تقرير مخرجات الاجتماعات\nالفترة: ${dateRange.start} - ${dateRange.end}\n\nإجمالي: ${stats.total}\nمنفذ: ${stats.executed} (${stats.percentages.executed.toFixed(1)}%)\nقيد التنفيذ: ${stats.inProgress} (${stats.percentages.inProgress.toFixed(1)}%)\nلم يتم: ${stats.notExecuted} (${stats.percentages.notExecuted.toFixed(1)}%)`;
    
    if (format === 'whatsapp' || format === 'txt') {
        if (format === 'txt') {
            const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `meetings_summary.txt`;
            link.click();
        } else {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(summary)}`, '_blank');
        }
    } else if (format === 'pdf') {
        const doc = setupPdfDoc();
        const lines = doc.splitTextToSize(summary, 180);
        doc.text(lines, 200, 20, { align: 'right' });
        doc.save("meetings_summary.pdf");
    } else if (format === 'excel') {
        // Simple export for summary
        const data = [
            ["المعيار", "القيمة", "النسبة"],
            ["إجمالي", stats.total, ""],
            ["منفذ", stats.executed, `${stats.percentages.executed.toFixed(1)}%`],
            ["قيد التنفيذ", stats.inProgress, `${stats.percentages.inProgress.toFixed(1)}%`],
            ["لم يتم", stats.notExecuted, `${stats.percentages.notExecuted.toFixed(1)}%`]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Meetings Summary");
        XLSX.writeFile(wb, "meetings_summary.xlsx");
    }
};

export const exportPeerVisits = ({ format, visits, academicYear }: { format: 'txt' | 'pdf' | 'excel' | 'whatsapp', visits: PeerVisit[], academicYear: string }) => {
    if (format === 'excel') {
        const data = visits.map(v => ({
            "الزائر": v.visitingTeacher,
            "المزور": v.visitedTeacher,
            "الحالة": v.status
        }));
        const ws = XLSX.utils.aoa_to_sheet([Object.keys(data[0] || {}), ...data.map(Object.values)]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Visits");
        XLSX.writeFile(wb, "peer_visits.xlsx");
        return;
    }
    let content = `الزيارات التبادلية\n`;
    visits.forEach(v => content += `${v.visitingTeacher} -> ${v.visitedTeacher} (${v.status})\n`);
    
    if (format === 'txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `visits.txt`;
        link.click();
    } else if (format === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`, '_blank');
    } else if (format === 'pdf') {
        const doc = setupPdfDoc();
        let y = 20;
        doc.text("الزيارات التبادلية", 200, y, { align: "right" }); y += 10;
        visits.forEach(v => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`${v.visitingTeacher} -> ${v.visitedTeacher} (${v.status})`, 200, y, { align: "right" });
            y += 7;
        });
        doc.save("visits.pdf");
    }
};

export const exportSupervisorySummary = ({ format, title, data, t }: { format: 'txt' | 'pdf' | 'excel' | 'whatsapp', title: string, data: string[], t: (key: string) => string }) => {
    const content = `${title}\n\n${data.join('\n')}`;
    
    if (format === 'txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `summary.txt`;
        link.click();
    } else if (format === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`, '_blank');
    } else if (format === 'pdf') {
        const doc = setupPdfDoc();
        const lines = doc.splitTextToSize(content, 180);
        doc.text(lines, 200, 20, { align: 'right' });
        doc.save("summary.pdf");
    } else if (format === 'excel') {
        const ws = XLSX.utils.aoa_to_sheet(data.map(line => [line]));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Summary");
        XLSX.writeFile(wb, "summary.xlsx");
    }
};

export const exportKeyMetrics = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp', stats: any, t: (key: string) => string) => {
    let content = `المؤشرات الرئيسية\n\n`;
    content += `الاستراتيجيات: ${stats.percentages.strategies.toFixed(1)}%\n`;
    content += `الوسائل: ${stats.percentages.tools.toFixed(1)}%\n`;
    content += `المصادر: ${stats.percentages.sources.toFixed(1)}%\n`;
    content += `البرامج: ${stats.percentages.programs.toFixed(1)}%\n`;
    
    if (format === 'whatsapp' || format === 'txt') {
        if (format === 'txt') {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `key_metrics.txt`;
            link.click();
        } else {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`, '_blank');
        }
    } else if (format === 'pdf') {
        const doc = setupPdfDoc();
        const lines = doc.splitTextToSize(content, 180);
        doc.text(lines, 200, 20, { align: 'right' });
        doc.save("key_metrics.pdf");
    } else if (format === 'excel') {
        const data = [
            ["المؤشر", "النسبة"],
            ["الاستراتيجيات", `${stats.percentages.strategies.toFixed(1)}%`],
            ["الوسائل", `${stats.percentages.tools.toFixed(1)}%`],
            ["المصادر", `${stats.percentages.sources.toFixed(1)}%`],
            ["البرامج", `${stats.percentages.programs.toFixed(1)}%`]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Metrics");
        XLSX.writeFile(wb, "key_metrics.xlsx");
    }
};

export const exportEvaluationAnalysis = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp', data: any, t: (key: string) => string) => {
    // Simplified implementation for brevity
    const content = `تحليل التقييم: ${data.title}\n` + JSON.stringify(data, null, 2); // Very rough dump
    if (format === 'txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `analysis.txt`;
        link.click();
    } // ... others similarly
};

export const exportMeeting = ({format, meeting}: {format: 'pdf' | 'whatsapp', meeting: Meeting}) => {
    const content = `اجتماع ${meeting.date}\nالموضوع: ${meeting.subject}\nالحضور: ${meeting.attendees}`;
    if (format === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`, '_blank');
    } else if (format === 'pdf') {
        const doc = setupPdfDoc();
        doc.text(doc.splitTextToSize(content, 180), 200, 20, {align:'right'});
        doc.save(`meeting_${meeting.date}.pdf`);
    }
};

export const exportDeliveryRecords = (format: 'txt', sheets: DeliverySheet[]) => {
    // Stub
};

export const exportSyllabusCoverage = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp', report: SyllabusCoverageReport, teacherName: string, t: (key: string) => string) => {
    const content = `تقرير المنهج - ${teacherName} - ${report.subject}\n`;
    if (format === 'whatsapp') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`, '_blank');
    } else if (format === 'txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `syllabus_${teacherName}.txt`;
        link.click();
    }
};

export const exportSyllabusPlan = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp', plan: SyllabusPlan, t: (key: string) => string) => {
    // Stub
    alert("Export not implemented for this format yet.");
};

export const exportSupervisoryPlan = (format: 'txt' | 'pdf' | 'excel' | 'whatsapp', planWrapper: SupervisoryPlanWrapper, headers: any, t: (key: string) => string) => {
    // Stub
    alert("Export not implemented for this format yet.");
};

// --- NEW: SELF EVALUATION EXPORT ---
export const exportSelfEvaluation = (report: SelfEvaluationReport, teacher: Teacher, t: (key: any) => string, format: 'txt' | 'pdf' | 'excel' | 'whatsapp') => {
    const filename = `self_evaluation_${teacher.name}_${report.date}`;
    
    // Helper to format syllabus status text for a specific lesson
    const getLessonStatusText = (lesson: { status: string; count?: number }) => {
        if (lesson.status === 'match') return t('matchMinistryPlan');
        if (lesson.status === 'ahead') return `${t('aheadMinistryPlan')} ${lesson.count || 0} ${t('lessons')}`;
        if (lesson.status === 'behind') return `${t('behindMinistryPlan')} ${lesson.count || 0} ${t('lessons')}`;
        return '';
    };

    const getLastLessonsText = () => {
        if (!report.lastLessons || report.lastLessons.length === 0) return t('lastLessonTaken');
        // New format: Branch - Lesson (Status)
        return report.lastLessons.map(l => {
            const status = getLessonStatusText(l);
            return `${l.branch ? `[${l.branch}]` : ''} ${l.lesson} (${status})`;
        }).join('\n');
    };

    if (format === 'txt' || format === 'whatsapp') {
        let content = `*📊 ${t('selfEvaluation')}*\n\n`;
        content += `*👤 ${t('teacherName')}:* ${teacher.name}\n`;
        content += `*🏫 ${t('schoolName')}:* ${report.school} (${report.branch})\n`;
        content += `*📅 ${t('date')}:* ${new Date(report.date).toLocaleDateString()} | *${t('semester')}:* ${report.semester}\n`;
        content += `*📖 ${t('subject')}:* ${report.subject} - *${t('grades')}:* ${report.grades}\n\n`;
        
        content += `*${t('lastLessonTaken')} & ${t('syllabusStatusLabel')}:*\n${getLastLessonsText()}\n\n`;
        
        content += `*${t('developmentalMeetings')}:* ${report.developmentalMeetingsCount}\n`;
        content += `*${t('notebookCorrection')}:* ${report.notebookCorrectionPercentage}%\n`;
        content += `*${t('preparationBook')}:* ${report.preparationBookPercentage}%\n`;
        content += `*${t('questionsGlossary')}:* ${report.questionsGlossaryPercentage}%\n\n`;
        
        content += `${SEPARATOR}`;
        content += `*${t('programsSkills')}:*\n${report.programsAndSkills || '-'}\n\n`;
        content += `*${t('strategiesUsed')}:*\n${report.strategiesExecuted || '-'}\n\n`;
        content += `*${t('toolsUsed')}:*\n${report.toolsUsed || '-'}\n\n`;
        content += `*${t('sourcesUsed')}:*\n${report.sourcesUsed || '-'}\n\n`;
        content += `*${t('assignmentsDone')}:*\n${report.tasksAccomplished || '-'}\n\n`;
        content += `*${t('testsDelivered')}:*\n${report.testsDelivered || '-'}\n\n`;
        content += `*${t('peerVisitsDone')}:*\n${report.peerVisitsDone || '-'}\n`;

        if (format === 'txt') {
            const blob = new Blob([content.replace(/\*/g, '')], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.txt`;
            link.click();
        } else {
             window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`, '_blank');
        }
    } else if (format === 'pdf') {
        const doc = setupPdfDoc();
        let y = 20;
        const writeRtl = (text: string, yPos: number, size = 12, style = 'normal') => {
            doc.setFontSize(size);
            doc.setFont('Amiri', style);
            doc.text(text, 200, yPos, { align: 'right' });
        }
        
        writeRtl(t('selfEvaluation'), y, 18, 'bold'); y += 10;
        writeRtl(`${t('teacherName')}: ${teacher.name} | ${t('date')}: ${new Date(report.date).toLocaleDateString()}`, y); y+= 7;
        writeRtl(`${t('schoolName')}: ${report.school} | ${t('branch')}: ${report.branch}`, y); y+= 7;
        writeRtl(`${t('subject')}: ${report.subject} | ${t('grades')}: ${report.grades}`, y); y+= 7;
        writeRtl(`${t('academicYear')}: ${report.academicYear} | ${t('semester')}: ${report.semester}`, y); y+= 10;
        
        // Progress Table
        doc.autoTable({
            startY: y,
            head: [['القيمة', 'المعيار']],
            body: [
                [getLastLessonsText(), t('lastLessonTaken')],
                [report.developmentalMeetingsCount, t('developmentalMeetings')],
                [`%${report.notebookCorrectionPercentage}`, t('notebookCorrection')],
                [`%${report.preparationBookPercentage}`, t('preparationBook')],
                [`%${report.questionsGlossaryPercentage}`, t('questionsGlossary')],
            ],
            styles: getTableStyles(), headStyles: getHeadStyles()
        });
        y = doc.lastAutoTable.finalY + 10;

        // Dynamic Sections
        const sections = [
            { title: t('programsSkills'), content: report.programsAndSkills },
            { title: t('strategiesUsed'), content: report.strategiesExecuted },
            { title: t('toolsUsed'), content: report.toolsUsed },
            { title: t('sourcesUsed'), content: report.sourcesUsed },
            { title: t('assignmentsDone'), content: report.tasksAccomplished },
            { title: t('testsDelivered'), content: report.testsDelivered },
            { title: t('peerVisitsDone'), content: report.peerVisitsDone },
        ];

        sections.forEach(sec => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFont('Amiri', 'bold');
            writeRtl(sec.title + ':', y); y += 6;
            doc.setFont('Amiri', 'normal');
            doc.text(sec.content || '-', 200, y, { align: 'right', maxWidth: 180 });
            // Approximate height calculation or fixed spacing
            const lines = doc.splitTextToSize(sec.content || '-', 180).length;
            y += (lines * 5) + 5;
        });

        addBorderToPdf(doc);
        doc.save(`${filename}.pdf`);

    } else if (format === 'excel') {
        const data: any[][] = [];
        data.push([t('selfEvaluation')]);
        data.push([t('teacherName'), teacher.name]);
        data.push([t('date'), new Date(report.date).toLocaleDateString()]);
        data.push([t('schoolName'), report.school]);
        data.push([t('subject'), report.subject]);
        data.push([]); 

        data.push(['المعيار', 'القيمة']);
        data.push([t('lastLessonTaken'), getLastLessonsText()]);
        data.push([t('developmentalMeetings'), report.developmentalMeetingsCount]);
        data.push([t('notebookCorrection'), `${report.notebookCorrectionPercentage}%`]);
        data.push([t('preparationBook'), `${report.preparationBookPercentage}%`]);
        data.push([t('questionsGlossary'), `${report.questionsGlossaryPercentage}%`]);
        data.push([]);

        data.push([t('programsSkills'), report.programsAndSkills]);
        data.push([t('strategiesUsed'), report.strategiesExecuted]);
        data.push([t('toolsUsed'), report.toolsUsed]);
        data.push([t('sourcesUsed'), report.sourcesUsed]);
        data.push([t('assignmentsDone'), report.tasksAccomplished]);
        data.push([t('testsDelivered'), report.testsDelivered]);
        data.push([t('peerVisitsDone'), report.peerVisitsDone]);

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Self Evaluation");
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }
};
