import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function SourceUrlForm({ kbId, onQueued }) {
  const { t } = useTranslation();
  const [seedUrl, setSeedUrl] = useState("");
  const [depth, setDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(15);
  const [sameDomainOnly, setSameDomainOnly] = useState(true);
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);

  async function startCrawl() {
    setLoading(true);
    try {
      const res = await apiFetch("/kb/crawl/start", {
        method: "POST",
        body: {
          seed_url: seedUrl,
          depth,
          max_pages: maxPages,
          same_domain_only: sameDomainOnly,
          include: include ? include.split(",").map(s => s.trim()).filter(Boolean) : [],
          exclude: exclude ? exclude.split(",").map(s => s.trim()).filter(Boolean) : [],
          target_kb_id: kbId,
        }
      });
      setJobId(res.job_id);
      onQueued?.(res);
    } finally {
      setLoading(false);
    }
  }

  const { data: status } = useQuery({
    queryKey: ["kb_crawl_status", jobId],
    queryFn: async () => jobId ? apiFetch(`/kb/crawl/${jobId}`) : null,
    enabled: !!jobId,
    refetchInterval: jobId ? 1500 : false
  });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t("kb.sources.seed_url")}
        </label>
        <input 
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
          placeholder="https://www.example.com" 
          value={seedUrl} 
          onChange={e => setSeedUrl(e.target.value)} 
        />
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("kb.sources.depth")}
          </label>
          <input 
            type="number" 
            min={0} 
            max={3} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
            value={depth} 
            onChange={e => setDepth(+e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("kb.sources.max_pages")}
          </label>
          <input 
            type="number" 
            min={1} 
            max={200} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
            value={maxPages} 
            onChange={e => setMaxPages(+e.target.value)} 
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={sameDomainOnly} 
              onChange={e => setSameDomainOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {t("kb.sources.same_domain_only")}
            </span>
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("kb.sources.include_patterns")}
          </label>
          <input 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
            placeholder="/blog, /docs" 
            value={include} 
            onChange={e => setInclude(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("kb.sources.exclude_patterns")}
          </label>
          <input 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
            placeholder="/privacy, /admin" 
            value={exclude} 
            onChange={e => setExclude(e.target.value)} 
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" 
          disabled={!seedUrl || loading} 
          onClick={startCrawl}
        >
          {loading ? t("common.working") : t("kb.sources.start_crawl")}
        </button>
        
        {status && (
          <div className="text-sm text-gray-600">
            {t("kb.sources.status")}: {status.status} • {status.pages_processed}/{Math.max(status.pages_enqueued, status.pages_processed)} {t("kb.sources.pages")}
          </div>
        )}
      </div>
    </div>
  );
}
