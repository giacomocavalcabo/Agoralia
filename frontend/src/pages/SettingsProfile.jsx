import tzdata from "@/lib/timezones.json";
import { patchMe, getMe } from "@/lib/api";
import React, { useEffect, useState } from "react";

export default function SettingsProfile() {
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => setMe(await getMe()))();
  }, []);

  const onSave = async () => {
    setSaving(true);
    await patchMe({ tz: me.tz }); // se esiste PATCH /api/auth/me o endpoint equivalente
    setSaving(false);
  };

  if (!me) return null;

  return (
    <div className="max-w-xl space-y-4">
      {/* name, email, etc. */}
      <div>
        <label className="block text-sm font-medium mb-1">Your timezone</label>
        <select
          className="w-full border rounded-md px-3 py-2"
          value={me.tz || "UTC"}
          onChange={(e) => setMe({ ...me, tz: e.target.value })}
        >
          {tzdata.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>
      <button
        className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50"
        disabled={saving}
        onClick={onSave}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
