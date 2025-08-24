import React from 'react'
import { Outlet } from 'react-router-dom'
import SettingsNav from './SettingsNav'

export default function SettingsLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <SettingsNav />
      <main className="flex-1 px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
