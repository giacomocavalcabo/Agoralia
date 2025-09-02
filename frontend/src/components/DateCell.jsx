import { formatInTz, effectiveTz } from "../lib/time";
import { useAuth } from "../lib/useAuth";
import { useWorkspace } from "../lib/workspace";

export default function DateCell({ isoUtc, options = {} }) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const tz = effectiveTz(user?.tz, workspace?.timezone);
  
  return (
    <span title={`${isoUtc} UTC`}>
      {formatInTz(isoUtc, tz, { 
        dateStyle: "medium", 
        timeStyle: "short",
        ...options 
      })}
    </span>
  );
}
