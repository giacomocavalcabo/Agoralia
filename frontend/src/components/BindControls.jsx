// frontend/src/components/BindControls.jsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAgents, bindNumber } from "../lib/numbersApi";
import { useTranslation } from "react-i18next";

export default function BindControls({ number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: agents = [] } = useQuery(["tel_agents"], listAgents);

  const isExternal = number.origin === "external_forward" || (number.provider && number.provider !== "retell");

  const [inboundEnabled, setInboundEnabled] = React.useState(!!number.inbound_enabled);
  const [outboundEnabled, setOutboundEnabled] = React.useState(!!number.outbound_enabled && !isExternal);
  const [inboundAgent, setInboundAgent] = React.useState(number.inbound_agent_id || "");
  const [outboundAgent, setOutboundAgent] = React.useState(number.outbound_agent_id || "");

  const m = useMutation({
    mutationFn: bindNumber,
    onSuccess: () => qc.invalidateQueries(["numbers"]),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm w-24">{t("settings.telephony.bind.inbound")}</label>
        <input
          type="checkbox"
          checked={inboundEnabled}
          onChange={(e) => setInboundEnabled(e.target.checked)}
        />
        <select
          className="input"
          value={inboundAgent}
          onChange={(e) => setInboundAgent(e.target.value)}
        >
          <option value="">{t("common.none")}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm w-24">
          {t("settings.telephony.bind.outbound")}
        </label>
        <input
          type="checkbox"
          checked={outboundEnabled}
          onChange={(e) => setOutboundEnabled(e.target.checked)}
          disabled={isExternal}
          title={isExternal ? t("settings.telephony.bind.outbound_locked") : ""}
        />
        <select
          className="input"
          value={outboundAgent}
          onChange={(e) => setOutboundAgent(e.target.value)}
          disabled={isExternal || !outboundEnabled}
        >
          <option value="">{t("common.none")}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {isExternal && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          {t("settings.telephony.bind.outbound_locked")}
        </div>
      )}

      <button
        className="btn btn-primary w-fit"
        onClick={() =>
          m.mutate({
            number_id: number.id,
            inbound_enabled: inboundEnabled,
            outbound_enabled: isExternal ? false : outboundEnabled,
            inbound_agent_id: inboundAgent || null,
            outbound_agent_id: isExternal ? null : (outboundAgent || null),
          })
        }
      >
        {t("settings.telephony.bind.save")}
      </button>
    </div>
  );
}
