import {
  filterOwnerPayments,
  getDuePaymentsOnDate,
  getOwnerPaymentsForMonth,
  listPaymentsReceivedOnDate,
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

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatDateRu(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
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

function paymentRows(payments: StudentPayment[]): string[][] {
  return payments.map((p) => {
    const debt = Math.max(0, p.amount_due - p.amount_paid);
    return [
      p.student_name,
      p.student_code,
      statusLabel(p),
      String(Math.round(p.amount_due)),
      String(Math.round(p.amount_paid)),
      String(Math.round(debt)),
      formatDateRu(p.due_date),
      formatDateRu(p.paid_at),
      formatDateRu(p.start_date),
      p.has_invoice ? "Да" : "Нет",
    ];
  });
}

function buildCsv(lines: string[][]): string {
  return `\uFEFF${lines.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

const COLUMNS = [
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

export async function buildMonthReportCsv(input: {
  periodMonth: string;
  filter: PaymentListFilter;
  search: string;
}) {
  const all = await getOwnerPaymentsForMonth(input.periodMonth);
  const payments = filterOwnerPayments(all, input.filter, input.search);
  const summary = summarizeOwnerPayments(payments);
  const [y, m] = input.periodMonth.slice(0, 7).split("-");
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  const periodLabel = `${months[Number(m) - 1]} ${y}`;

  const lines: string[][] = [
    ["Lang Center — отчёт владельца"],
    ["Период", periodLabel],
    ["Фильтр", FILTER_LABELS[input.filter]],
    ["Поиск", input.search || "—"],
    ["Записей", String(payments.length)],
    ["Получено (сум)", String(Math.round(summary.total_income))],
    ["Ожидалось (сум)", String(Math.round(summary.total_expected))],
    ["Долг (сум)", String(Math.round(summary.total_debt))],
    [],
    COLUMNS,
    ...paymentRows(payments),
  ];

  const filename = `lang-center-${input.periodMonth.slice(0, 7)}-${input.filter}.csv`;
  return { csv: buildCsv(lines), filename };
}

export async function buildDayReportCsv(input: {
  date: string;
  section: DailyReportSection;
  search: string;
}) {
  const [received, due] = await Promise.all([
    listPaymentsReceivedOnDate(input.date),
    getDuePaymentsOnDate(input.date),
  ]);

  const source = input.section === "received" ? received : due;
  const payments = filterOwnerPayments(source, "all", input.search);

  const lines: string[][] = [
    ["Lang Center — отчёт за день"],
    ["День", formatDateRu(input.date)],
    ["Раздел", SECTION_LABELS[input.section]],
    ["Поиск", input.search || "—"],
    ["Записей", String(payments.length)],
  ];

  if (input.section === "received") {
    const receivedSummary = summarizeDailyReceived(payments);
    lines.push(
      ["Получено (сум)", String(Math.round(receivedSummary.received_total))],
      ["Платежей", String(receivedSummary.received_count)],
    );
  } else {
    const dueSummary = summarizeDailyDue(payments);
    lines.push(
      ["Срок сегодня (сум)", String(Math.round(dueSummary.due_today_total))],
      ["Учеников", String(dueSummary.due_today_count)],
      ["Не оплатили (сум)", String(Math.round(dueSummary.due_today_unpaid_total))],
      ["Не оплатили (чел.)", String(dueSummary.due_today_unpaid_count)],
    );
  }

  lines.push([], COLUMNS, ...paymentRows(payments));

  const sectionSlug = input.section === "received" ? "polucheno" : "srok";
  const filename = `lang-center-${input.date}-${sectionSlug}.csv`;
  return { csv: buildCsv(lines), filename };
}