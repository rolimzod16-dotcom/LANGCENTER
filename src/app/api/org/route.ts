import { NextRequest, NextResponse } from "next/server";
import { updateAdminOrg } from "@/lib/auth/admin";
import { getAdminOrgId, listOrganizations } from "@/lib/org";

export async function GET() {
  try {
    const [organizations, current_id] = await Promise.all([
      listOrganizations(),
      getAdminOrgId(),
    ]);
    return NextResponse.json({
      organizations,
      current_id: current_id ?? organizations[0]?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orgId = String(body.organization_id ?? "").trim();
    if (!orgId) {
      return NextResponse.json(
        { error: "organization_id обязателен" },
        { status: 400 },
      );
    }

    const organizations = await listOrganizations();
    const found = organizations.find((o) => o.id === orgId);
    if (!found) {
      return NextResponse.json({ error: "Филиал не найден" }, { status: 404 });
    }

    await updateAdminOrg(orgId);
    return NextResponse.json({ ok: true, organization: found });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
