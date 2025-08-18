import LanguageSwitcher from './LanguageSwitcher.jsx'
import UsageBar from './UsageBar.jsx'
import AvatarMenu from './AvatarMenu.jsx'
import { useI18n } from '../lib/i18n.jsx'
import { Bell, HelpCircle } from 'lucide-react'

export default function AppHeader(){
	const { t } = useI18n()
	return (
		<header className="sticky top-0 z-40 border-b border-line bg-bg-card/90 backdrop-blur">
			<div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center gap-3">
				<div className="flex-1 min-w-0">
					<nav className="text-sm text-ink-600">{t('ui.nav.breadcrumbs') || 'Dashboard / Overview'}</nav>
				</div>
				<div className="hidden md:flex flex-1 justify-center">
					<input id="global-search" placeholder={t('ui.search.placeholder') || 'Search…'} className="w-[520px] rounded-xl border border-line bg-bg-app px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" aria-label={t('ui.search.aria') || 'Search'} />
				</div>
				<div className="flex items-center gap-2">
					<span className="rounded-full bg-bg-app px-3 py-1 text-xs text-ink-600 border border-line">{t('ui.indicators.test_mode') || 'Test mode'}</span>
					<button className="rounded-xl bg-brand-600 px-3.5 py-2 text-white text-sm hover:bg-brand-500" onClick={()=> document.dispatchEvent(new CustomEvent('open-create-drawer'))}>{t('ui.actions.create') || '+ Create'}</button>
					<button className="h-9 w-9 rounded-xl border border-line bg-bg-app text-ink-600 hover:text-ink-900 grid place-items-center" aria-label="Notifications"><Bell className="h-4 w-4"/></button>
					<button className="h-9 w-9 rounded-xl border border-line bg-bg-app text-ink-600 hover:text-ink-900 grid place-items-center" aria-label="Help"><HelpCircle className="h-4 w-4"/></button>
					<LanguageSwitcher />
					<UsageBar />
					<AvatarMenu />
				</div>
			</div>
		</header>
	)
}


