"use client";

import { useCallback, useEffect, useState } from "react";

type Org = { id: string; name: string; slug: string };

type OrgSwitcherProps = {
  onChanged?: () => void;
  className?: string;
};

export function OrgSwitcher({ onChanged, className = "" }: OrgSwitcherProps) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/org", { credentials: "include" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    const list: Org[] = data.organizations ?? [];
    setOrgs(list);
    if (data.current_id) {
      setCurrentId(data.current_id);
    } else if (list[0]) {
      setCurrentId(list[0].id);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function switchOrg(orgId: string) {
    if (orgId === currentId) return;
    setSaving(true);
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ organization_id: orgId }),
    });
    setSaving(false);
    if (!res.ok) return;
    setCurrentId(orgId);
    onChanged?.();
    // reload data-heavy admin pages
    window.location.reload();
  }

  if (loading || orgs.length <= 1) {
    if (orgs.length === 1) {
      return (
        <div
          className={`rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 ${className}`}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Филиал
          </span>
          <p className="font-semibold text-slate-900">{orgs[0]!.name}</p>
          <p className="mt-0.5 text-xs text-amber-700">
            Второй филиал появится после настройки базы
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white px-3 py-2 ${className}`}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Филиал
      </label>
      <select
        value={currentId}
        disabled={saving}
        onChange={(e) => switchOrg(e.target.value)}
        className="lc-input mt-1 py-2 text-sm font-semibold"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
