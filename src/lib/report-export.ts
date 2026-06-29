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

const COLUMNS = [
  "№",
  "ФИО",
  "Код",
  "Статус",
  "К оплате (сум)",
  "Оплачено (сум)",
  "Долг (сум)",
  "Срок оплаты",
  "Дата получения",
  "Дата начала",
  "Счёт выставлен",
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

function paymentRows(payments: StudentPayment[]): Array<Array<string | number>> {
  return payments.map((p, index) => {
    const debt = Math.max(0, p.amount_due - p.amount_paid);
    return [
      index + 1,
      p.student_name,
      p.student_code,
      statusLabel(p),
      Math.round(p.amount_due),
      Math.round(p.amount_paid),
      Math.round(debt),
      formatDateRu(p.due_date),
      formatDateRu(p.paid_at),
      formatDateRu(p.start_date),
      p.has_invoice ? "Да" : "Нет",
    ];
  });
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
<Column ss:Width="90"/>
<Column ss:Width="110"/>
<Column ss:Width="110"/>
<Column ss:Width="90"/>
<Column ss:Width="95"/>
<Column ss:Width="95"/>
<Column ss:Width="95"/>
<Column ss:Width="90"/>
${tableRows}
</Table>
</Worksheet>
</Workbook>`;
}

function buildTableSection(
  title: string,
  summaryLines: Array<[string, string | number]>,
  payments: StudentPayment[],
): string {
  const parts: string[] = [];

  parts.push(row(cell(title, "String", "Title")));
  for (const [label, value] of summaryLines) {
    parts.push(summaryRow(label, value));
  }
  parts.push("<Row></Row>");
  parts.push(
    row(COLUMNS.map((title) => cell(title, "String", "Header")).join("")),
  );

  for (const dataRow of paymentRows(payments)) {
    const cells = dataRow
      .map((value, index) => {
        if (index >= 4 && index <= 6) {
          return cell(value, "Number", "Money");
        }
        return cell(value);
      })
      .join("");
    parts.push(row(cells));
  }

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

  const tableRows = buildTableSection(
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

  if (input.section === "received") {
    const receivedSummary = summarizeDailyReceived(payments);
    summaryLines.push(
      ["Получено (сум)", Math.round(receivedSummary.received_total)],
      ["Платежей", receivedSummary.received_count],
    );
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
      buildTableSection("Lang Center — отчёт за день", summaryLines, payments),
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