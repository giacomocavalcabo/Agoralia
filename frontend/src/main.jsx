import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { I18nProvider } from './lib/i18n.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import QueryProvider from './providers/QueryProvider.jsx'
import StripeProvider from './providers/StripeProvider.jsx'
import Root from './layouts/Root.jsx'

const modules = import.meta.glob('./pages/*.jsx', { eager: true })
modules['./pages/Numbers.jsx'] ||= { default: (await import('./pages/Numbers.jsx')).default }
const pages = Object.entries(modules).map(([path, mod]) => {
	const file = path.split('/').pop() || ''
	const name = file.replace(/\.jsx$/,'')
	return { name, Component: mod.default }
})

// Import KB routes
import { kbRoutes } from './routes/kbRoutes.jsx'

function slugify(name){ return name.toLowerCase() }
function Placeholder({ name }){
	return <div className="panel"><h1 style={{ marginTop:0 }}>{name}</h1><p className="kpi-title">This page will appear here once its component is exported.</p></div>
}

const rootEl = document.getElementById('root')
if (rootEl) {
	createRoot(rootEl).render(
		<QueryProvider>
			<StripeProvider>
				<ToastProvider>
					<I18nProvider>
						<BrowserRouter>
							<Routes>
								<Route element={<Root />}> {/* layout */}
									{pages.map(({ name, Component }) => (
										name === 'Dashboard'
											? <Route key={name} index element={Component ? <Component /> : <Placeholder name={name} />} />
											: <Route key={name} path={slugify(name)} element={Component ? <Component /> : <Placeholder name={name} />} />
									))}
									
									{/* KB Routes */}
									{kbRoutes.map((route, index) => (
										<Route 
											key={`kb-${index}`} 
											path={route.path} 
											element={route.element} 
										/>
									))}
									
									<Route path="*" element={<Navigate to="/" replace />} />
								</Route>
							</Routes>
						</BrowserRouter>
					</I18nProvider>
				</ToastProvider>
			</StripeProvider>
		</QueryProvider>
	)
}

// Cmd/Ctrl+K focus global search
window.addEventListener('keydown', (e)=>{
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k'){
        e.preventDefault()
        const el = document.getElementById('global-search')
        if (el) el.focus()
    }
})
