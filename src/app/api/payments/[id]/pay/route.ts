import { NextRequest, NextResponse } from "next/server";
import { markPaymentPaid } from "@/lib/payments";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const amountPaid =
      body.amount_paid !== undefined ? Number(body.amount_paid) : undefined;
    const payment = await markPaymentPaid(id, amountPaid);
    return NextResponse.json({ payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}