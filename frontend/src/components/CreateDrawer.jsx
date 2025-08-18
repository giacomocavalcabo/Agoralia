import { useEffect, useState } from 'react'
import Drawer from './Drawer.jsx'
import { useNavigate } from 'react-router-dom'

export default function CreateDrawer(){
	const [open, setOpen] = useState(false)
	const nav = useNavigate()
	useEffect(()=>{
		function onOpen(){ setOpen(true) }
		document.addEventListener('open-create-drawer', onOpen)
		return ()=> document.removeEventListener('open-create-drawer', onOpen)
	},[])
	return (
		<Drawer open={open} onClose={()=> setOpen(false)} title="Create" width={420}>
			<div className="grid gap-2">
				<button className="rounded-xl border border-line px-3 py-2 text-left hover:bg-bg-app" onClick={()=>{ setOpen(false); nav('/campaigns') }}>New campaign</button>
				<button className="rounded-xl border border-line px-3 py-2 text-left hover:bg-bg-app" onClick={()=>{ setOpen(false); nav('/leads') }}>Add lead</button>
				<button className="rounded-xl border border-line px-3 py-2 text-left hover:bg-bg-app" onClick={()=>{ setOpen(false); nav('/import') }}>Import CSV</button>
			</div>
		</Drawer>
	)
}


