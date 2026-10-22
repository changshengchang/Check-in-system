import * as XLSX from 'xlsx';
import { CombinedAttendeeView, EventInfo, RegisteredParticipant } from '../types';

/**
 * Intelligent column mapping for Excel/CSV import
 */
function findColumnKey(row: Record<string, any>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  // Loose search
  for (const candidate of candidates) {
    const found = keys.find(k => k.trim().toLowerCase().includes(candidate.toLowerCase()));
    if (found) return found;
  }
  return null;
}

export function parseSpreadsheet(data: ArrayBuffer): {
  participants: RegisteredParticipant[];
  rawRowsCount: number;
  recognizedColumns: { nameCol?: string; titleCol?: string; deptCol?: string };
} {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    return { participants: [], rawRowsCount: 0, recognizedColumns: {} };
  }

  // Find column mapping from first row
  const sampleRow = rawRows[0];
  const nameCol = findColumnKey(sampleRow, ['姓名', 'name', '員工姓名', '學員姓名', '參與者', '名字', 'participant', 'attendee']);
  const titleCol = findColumnKey(sampleRow, ['職稱', 'title', '職務', '職級', '職位', 'job title', 'job_title', 'position', 'role']);
  const deptCol = findColumnKey(sampleRow, ['部門', 'department', '單位', '組別', '處室', '機構', 'dept']);
  const phoneCol = findColumnKey(sampleRow, ['電話', 'phone', '手機', '聯絡電話', 'mobile', 'tel']);
  const emailCol = findColumnKey(sampleRow, ['信箱', 'email', '電子郵件', '電子信箱', 'mail']);

  const participants: RegisteredParticipant[] = [];

  rawRows.forEach((row, index) => {
    // Extract name
    let name = '';
    if (nameCol && row[nameCol]) {
      name = String(row[nameCol]).trim();
    } else {
      // Fallback: look for any string that looks like a name
      const vals = Object.values(row);
      const possibleName = vals.find(v => typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 5);
      if (possibleName) name = String(possibleName).trim();
    }

    if (!name) return; // Skip empty rows

    // Extract title
    let title = '';
    if (titleCol && row[titleCol]) {
      title = String(row[titleCol]).trim();
    }

    // Extract department
    let department = '';
    if (deptCol && row[deptCol]) {
      department = String(row[deptCol]).trim();
    }

    // Extract phone & email
    const phone = phoneCol && row[phoneCol] ? String(row[phoneCol]).trim() : undefined;
    const email = emailCol && row[emailCol] ? String(row[emailCol]).trim() : undefined;

    participants.push({
      id: `imported-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      title: title || '未填寫職稱',
      department: department || undefined,
      phone,
      email,
      registeredAt: new Date().toISOString()
    });
  });

  return {
    participants,
    rawRowsCount: rawRows.length,
    recognizedColumns: {
      nameCol: nameCol || undefined,
      titleCol: titleCol || undefined,
      deptCol: deptCol || undefined
    }
  };
}

/**
 * Export data to Excel (.xlsx) file
 */
export function exportToExcel(attendees: CombinedAttendeeView[], eventInfo: EventInfo) {
  const statusLabels: Record<string, string> = {
    CHECKED_IN: '已完成報到',
    NOT_CHECKED_IN: '未完成報到',
    WALK_IN: '現場臨時報到'
  };

  const exportRows = attendees.map((item, idx) => ({
    '項次': idx + 1,
    '姓名': item.name,
    '職稱': item.title || '—',
    '部門/單位': item.department || '—',
    '報到狀態': statusLabels[item.status] || item.status,
    '報到時間': item.checkInTime ? new Date(item.checkInTime).toLocaleString('zh-TW', { hour12: false }) : '—',
    '手寫簽名狀態': item.signatureDataUrl ? '已完成電子簽署' : '未簽署',
    '人事覆核': item.hrVerified ? '已覆核' : '未覆核',
    '備註/類別': item.isWalkIn ? '現場追加' : '名冊預先報名'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 8 },  // 項次
    { wch: 14 }, // 姓名
    { wch: 18 }, // 職稱
    { wch: 18 }, // 部門
    { wch: 16 }, // 報到狀態
    { wch: 22 }, // 報到時間
    { wch: 18 }, // 手寫簽名
    { wch: 14 }, // 人事覆核
    { wch: 16 }  // 備註
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '報到清冊');

  const safeEventName = eventInfo.title.replace(/[\\/*?:"<>|]/g, '_');
  const filename = `${safeEventName}_報到名冊比對表_${formatDateForFilename(new Date())}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Export data to CSV with UTF-8 BOM
 */
export function exportToCsv(attendees: CombinedAttendeeView[], eventInfo: EventInfo) {
  const statusLabels: Record<string, string> = {
    CHECKED_IN: '已完成報到',
    NOT_CHECKED_IN: '未完成報到',
    WALK_IN: '現場臨時報到'
  };

  const headers = ['項次', '姓名', '職稱', '部門/單位', '報到狀態', '報到時間', '手寫簽名狀態', '人事覆核', '名單類別'];
  const rows = attendees.map((item, idx) => [
    idx + 1,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${(item.title || '—').replace(/"/g, '""')}"`,
    `"${(item.department || '—').replace(/"/g, '""')}"`,
    `"${statusLabels[item.status] || item.status}"`,
    `"${item.checkInTime ? new Date(item.checkInTime).toLocaleString('zh-TW', { hour12: false }) : '—'}"`,
    `"${item.signatureDataUrl ? '已完成電子簽署' : '未簽署'}"`,
    `"${item.hrVerified ? '已覆核' : '未覆核'}"`,
    `"${item.isWalkIn ? '現場追加' : '名冊預先報名'}"`
  ]);

  const csvContent = '\uFEFF' + [
    `# 活動名稱: "${eventInfo.title.replace(/"/g, '""')}"`,
    `# 匯出時間: "${new Date().toLocaleString('zh-TW', { hour12: false })}"`,
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeEventName = eventInfo.title.replace(/[\\/*?:"<>|]/g, '_');
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeEventName}_報到清冊_${formatDateForFilename(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a template CSV / Excel for easy upload
 */
export function downloadSampleRoster(type: 'excel' | 'csv' = 'excel') {
  const sampleData = [
    { '職稱': '技術總監', '姓名': '王大偉', '部門': '資訊研發處', '聯絡電話': '0912-345-678' },
    { '職稱': '高級工程師', '姓名': '陳建明', '部門': '資訊研發處', '聯絡電話': '0923-456-789' },
    { '職稱': '產品經理', '姓名': '林美華', '部門': '產品創新中心', '聯絡電話': '0934-567-890' },
    { '職稱': '人力資源經理', '姓名': '張淑珍', '部門': '人資發展部', '聯絡電話': '0945-678-901' },
    { '職稱': '資深行銷專員', '姓名': '黃俊彥', '部門': '行銷企劃部', '聯絡電話': '0956-789-012' },
    { '職稱': '財務專員', '姓名': '劉怡君', '部門': '財務會計部', '聯絡電話': '0967-890-123' },
    { '職稱': '品保工程師', '姓名': '楊宗緯', '部門': '品質保證部', '聯絡電話': '0978-901-234' },
    { '職稱': '客戶成功顧問', '姓名': '蔡雅芳', '部門': '客務服務處', '聯絡電話': '0989-012-345' }
  ];

  if (type === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '預先報名名冊範本');
    XLSX.writeFile(workbook, '活動預先報名人員名冊_範本.xlsx');
  } else {
    const headers = ['職稱', '姓名', '部門', '聯絡電話'];
    const rows = sampleData.map(d => [d['職稱'], d['姓名'], d['部門'], d['聯絡電話']]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '活動預先報名人員名冊_範本.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function formatDateForFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}_${hh}${mm}`;
}
