export default function Card({ title, children, footer }){
	return (
		<div className="panel transition-transform duration-100 ease-out hover:-translate-y-px hover:shadow-md">
			{title && <div className="font-semibold mb-2 text-ink-900">{title}</div>}
			{children}
			{footer && <div className="mt-3">{footer}</div>}
		</div>
	)
}
