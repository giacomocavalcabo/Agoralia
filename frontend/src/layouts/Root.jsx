import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import AppHeader from '../components/AppHeader.jsx'
import Sidebar from '../components/Sidebar.jsx'

export default function Root() {
	const location = useLocation()
	
	// Apply dark theme only to Dashboard
	useEffect(() => {
		const isDashboard = location.pathname === '/'
		document.body.classList.toggle('dark', isDashboard)
		
		return () => {
			document.body.classList.remove('dark')
		}
	}, [location.pathname])
	
	return (
		<div className="min-h-screen bg-bg-app">
			<div className="grid grid-cols-[auto_1fr]">
				<Sidebar />
				<div className="flex flex-col">
					<AppHeader />
					<main className="flex-1 p-6">
						<Outlet />
					</main>
				</div>
			</div>
		</div>
	)
}
