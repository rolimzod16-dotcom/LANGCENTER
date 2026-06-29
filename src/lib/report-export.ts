import {
  filterOwnerPayments,
  getDuePaymentsOnDate,
  getOwnerPaymentsForMonth,
  listPaymentsReceivedOnDate,
  sortOwnerPayments,
  summarizeOwnerPayments,
  summarizeDailyDue,
  summarizeDailyReceived,
  type DailyReportSection,
  type PaymentListFilter,
  type StudentPayment,
} from "@/lib/payments";
import {
  buildTeacherPayrollReport,
  getTeacherAssignmentsByStudentIds,
  studentPayrollAmount,
  TEACHER_SALARY_RATE,
  type PayrollBasis,
  type TeacherPayrollRow,
} from "@/lib/teacher-payroll";

const FILTER_LABELS: Record<PaymentListFilter, string> = {
  all: "Все",
  paid: "Оплачено",
  debt: "Должники",
  overdue: "Просрочено",
  new: "Новые",
};

const SECTION_LABELS: Record<DailyReportSection, string> = {
  received: "Получено в этот день",
  due: "Срок оплаты в этот день",
};

const PAYMENT_COLUMNS = [
  "№",
  "ФИО",
  "Код",
  "Учитель",
  "Статус",
  "К оплате (сум)",
  "Оплачено (сум)",
  "Долг (сум)",
  "ЗП учителя (50%)",
  "Срок оплаты",
  "Дата получения",
  "Дата начала",
  "Счёт выставлен",
];

const PAYROLL_COLUMNS = [
  "№",
  "Учитель",
  "Код учителя",
  "Учеников",
  "Сумма курсов (сум)",
  "ЗП 50% (сум)",
];

function formatDateRu(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function monthLabel(periodMonth: string): string {
  const [y, m] = periodMonth.slice(0, 7).split("-");
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  return `${months[Number(m) - 1]} ${y}`;
}

function statusLabel(payment: StudentPayment): string {
  if (!payment.has_invoice) return "Новый";
  const labels: Record<string, string> = {
    paid: "Оплачено",
    pending: "Ожидает",
    partial: "Частично",
    overdue: "Должен",
  };
  return labels[payment.status] ?? payment.status;
}

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(
  value: string | number,
  type: "String" | "Number" = typeof value === "number" ? "Number" : "String",
  styleId?: string,
): string {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${style}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function row(cells: string): string {
  return `<Row>${cells}</Row>`;
}

function summaryRow(label: string, value: string | number): string {
  return row(`${cell(label, "String", "Label")}${cell(value)}`);
}

function headerRow(columns: string[]): string {
  return row(columns.map((title) => cell(title, "String", "Header")).join(""));
}

function moneyCells(values: Array<string | number>, startMoneyIndex: number) {
  return values
    .map((value, index) => {
      if (typeof value === "number" && index >= startMoneyIndex) {
        return cell(value, "Number", "Money");
      }
      return cell(value);
    })
    .join("");
}

function buildExcelXml(sheetName: string, tableRows: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
    <Alignment ss:Vertical="Center"/>
    <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="Title">
    <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1"/>
  </Style>
  <Style ss:ID="Label">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
  <Style ss:ID="Header">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
    <Interior ss:Color="#E8EEF7" ss:Pattern="Solid"/>
    <Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    </Borders>
  </Style>
  <Style ss:ID="Money">
    <NumberFormat ss:Format="#,##0"/>
  </Style>
</Styles>
<Worksheet ss:Name="${escapeXml(sheetName)}">
<Table>
<Column ss:Width="40"/>
<Column ss:Width="180"/>
<Column ss:Width="120"/>
<Column ss:Width="150"/>
<Column ss:Width="90"/>
<Column ss:Width="110"/>
<Column ss:Width="110"/>
<Column ss:Width="90"/>
<Column ss:Width="110"/>
<Column ss:Width="95"/>
<Column ss:Width="95"/>
<Column ss:Width="95"/>
<Column ss:Width="90"/>
${tableRows}
</Table>
</Worksheet>
</Workbook>`;
}

function payrollSection(
  teachers: TeacherPayrollRow[],
  totalPayroll: number,
): string {
  const parts = [
    row(cell("Зарплата учителей (50% от курса)", "String", "Title")),
    summaryRow("Всего ЗП (сум)", Math.round(totalPayroll)),
    "<Row></Row>",
    headerRow(PAYROLL_COLUMNS),
  ];

  teachers.forEach((teacher, index) => {
    parts.push(
      row(
        moneyCells(
          [
            index + 1,
            teacher.teacher_name,
            teacher.teacher_code,
            teacher.student_count,
            teacher.course_total,
            teacher.salary,
          ],
          4,
        ),
      ),
    );
  });

  return parts.join("\n");
}

async function paymentRows(
  payments: StudentPayment[],
  basis: PayrollBasis,
): Promise<Array<Array<string | number>>> {
  const assignments = await getTeacherAssignmentsByStudentIds(
    payments.map((p) => p.student_id),
  );

  return payments.map((p, index) => {
    const debt = Math.max(0, p.amount_due - p.amount_paid);
    const teacher = assignments.get(p.student_id);
    return [
      index + 1,
      p.student_name,
      p.student_code,
      teacher?.teacher_name ?? "Без учителя",
      statusLabel(p),
      Math.round(p.amount_due),
      Math.round(p.amount_paid),
      Math.round(debt),
      studentPayrollAmount(p, basis),
      formatDateRu(p.due_date),
      formatDateRu(p.paid_at),
      formatDateRu(p.start_date),
      p.has_invoice ? "Да" : "Нет",
    ];
  });
}

async function buildReportBody(
  title: string,
  summaryLines: Array<[string, string | number]>,
  payments: StudentPayment[],
  basis: PayrollBasis,
  incomeForNet: number,
): Promise<string> {
  const payroll = await buildTeacherPayrollReport(
    payments,
    basis,
    incomeForNet,
  );
  const rows = await paymentRows(payments, basis);
  const parts: string[] = [];

  parts.push(row(cell(title, "String", "Title")));
  for (const [label, value] of summaryLines) {
    parts.push(summaryRow(label, value));
  }
  parts.push(
    summaryRow("ЗП учителей (сум)", Math.round(payroll.total_payroll)),
    summaryRow("Чистая прибыль (сум)", Math.round(payroll.net_after_payroll)),
    summaryRow(
      "Ставка ЗП",
      `${Math.round(TEACHER_SALARY_RATE * 100)}% от курса`,
    ),
  );
  parts.push("<Row></Row>");
  parts.push(headerRow(PAYMENT_COLUMNS));

  for (const dataRow of rows) {
    parts.push(row(moneyCells(dataRow, 5)));
  }

  parts.push("<Row></Row>", payrollSection(payroll.teachers, payroll.total_payroll));

  return parts.join("\n");
}

export async function buildMonthReportExcel(input: {
  periodMonth: string;
  filter: PaymentListFilter;
  search: string;
}) {
  const all = await getOwnerPaymentsForMonth(input.periodMonth);
  const payments = sortOwnerPayments(
    filterOwnerPayments(all, input.filter, input.search),
  );
  const summary = summarizeOwnerPayments(payments);

  const tableRows = await buildReportBody(
    "Lang Center — отчёт владельца",
    [
      ["Период", monthLabel(input.periodMonth)],
      ["Фильтр", FILTER_LABELS[input.filter]],
      ["Поиск", input.search || "—"],
      ["Записей", payments.length],
      ["Получено (сум)", Math.round(summary.total_income)],
      ["Ожидалось (сум)", Math.round(summary.total_expected)],
      ["Долг (сум)", Math.round(summary.total_debt)],
    ],
    payments,
    "course",
    summary.total_income,
  );

  const filename = `lang-center-${input.periodMonth.slice(0, 7)}-${input.filter}.xls`;
  return {
    content: buildExcelXml("Отчёт", tableRows),
    filename,
  };
}

export async function buildDayReportExcel(input: {
  date: string;
  section: DailyReportSection;
  search: string;
}) {
  const [received, due] = await Promise.all([
    listPaymentsReceivedOnDate(input.date),
    getDuePaymentsOnDate(input.date),
  ]);

  const source = input.section === "received" ? received : due;
  const payments = sortOwnerPayments(
    filterOwnerPayments(source, "all", input.search),
  );

  const summaryLines: Array<[string, string | number]> = [
    ["День", formatDateRu(input.date)],
    ["Раздел", SECTION_LABELS[input.section]],
    ["Поиск", input.search || "—"],
    ["Записей", payments.length],
  ];

  let basis: PayrollBasis = "course";
  let incomeForNet = 0;

  if (input.section === "received") {
    const receivedSummary = summarizeDailyReceived(payments);
    summaryLines.push(
      ["Получено (сум)", Math.round(receivedSummary.received_total)],
      ["Платежей", receivedSummary.received_count],
    );
    basis = "paid";
    incomeForNet = receivedSummary.received_total;
  } else {
    const dueSummary = summarizeDailyDue(payments);
    summaryLines.push(
      ["Срок сегодня (сум)", Math.round(dueSummary.due_today_total)],
      ["Учеников", dueSummary.due_today_count],
      ["Не оплатили (сум)", Math.round(dueSummary.due_today_unpaid_total)],
      ["Не оплатили (чел.)", dueSummary.due_today_unpaid_count],
    );
  }

  const sectionSlug = input.section === "received" ? "polucheno" : "srok";
  const filename = `lang-center-${input.date}-${sectionSlug}.xls`;
  return {
    content: buildExcelXml(
      "Отчёт",
      await buildReportBody(
        "Lang Center — отчёт за день",
        summaryLines,
        payments,
        basis,
        incomeForNet,
      ),
    ),
    filename,
  };
}

/** @deprecated Use buildMonthReportExcel */
export async function buildMonthReportCsv(input: {
  periodMonth: string;
  filter: PaymentListFilter;
  search: string;
}) {
  const result = await buildMonthReportExcel(input);
  return { csv: result.content, filename: result.filename };
}

/** @deprecated Use buildDayReportExcel */
export async function buildDayReportCsv(input: {
  date: string;
  section: DailyReportSection;
  search: string;
}) {
  const result = await buildDayReportExcel(input);
  return { csv: result.content, filename: result.filename };
}