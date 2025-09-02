// frontend/src/components/BindControls.jsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAgents, bindNumber } from "../lib/telephonyApi";
import { useTranslation } from "react-i18next";

export default function BindControls({ number }) {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const { data: agents = [] } = useQuery(["tel_agents"], listAgents);

  const isExternal = number.origin === "external_forward" || (number.provider && number.provider !== "retell");
  const isHosted = number.hosted !== false; // Default to true if not specified
  const isVerified = number.verified_cli === true;
  const canOutbound = (isHosted || isVerified) && !isExternal;

  const [inboundEnabled, setInboundEnabled] = React.useState(!!number.inbound_enabled);
  const [outboundEnabled, setOutboundEnabled] = React.useState(!!number.outbound_enabled && canOutbound);
  const [inboundAgent, setInboundAgent] = React.useState(number.inbound_agent_id || "");
  const [outboundAgent, setOutboundAgent] = React.useState(number.outbound_agent_id || "");

  const m = useMutation({
    mutationFn: bindNumber,
    onSuccess: () => qc.invalidateQueries(["numbers"]),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm w-24">{t("telephony.bind.inbound")}</label>
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
          {t("telephony.bind.outbound")}
        </label>
        <input
          type="checkbox"
          checked={outboundEnabled}
          onChange={(e) => setOutboundEnabled(e.target.checked)}
          disabled={!canOutbound}
          title={!canOutbound ? t("telephony.outbound_requires_verification") : ""}
        />
        <select
          className="input"
          value={outboundAgent}
          onChange={(e) => setOutboundAgent(e.target.value)}
          disabled={!canOutbound || !outboundEnabled}
        >
          <option value="">{t("common.none")}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {!canOutbound && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            {t("telephony.outbound_requires_verification")}
          </span>
        )}
      </div>

      {isExternal && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          {t("telephony.bind.outbound_locked")}
        </div>
      )}

      <button
        className="btn btn-primary w-fit"
        onClick={() =>
          m.mutate({
            number_id: number.id,
            inbound_enabled: inboundEnabled,
            outbound_enabled: canOutbound ? outboundEnabled : false,
            inbound_agent_id: inboundAgent || null,
            outbound_agent_id: canOutbound ? (outboundAgent || null) : null,
          })
        }
      >
        {t("telephony.bind.save")}
      </button>
    </div>
  );
}
