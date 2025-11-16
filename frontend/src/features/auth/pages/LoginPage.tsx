import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLogin, useRegister } from '../hooks'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'Password minimo 6 caratteri'),
})

const registerSchema = loginSchema.extend({
  name: z.string().optional(),
  admin_secret: z.string().optional(),
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const registerMutation = useRegister()

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data)
  }

  const onRegister = (data: RegisterForm) => {
    registerMutation.mutate(data)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Agoralia</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Accedi al tuo account' : 'Crea un nuovo account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button
              variant={mode === 'login' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('login')}
            >
              Login
            </Button>
            <Button
              variant={mode === 'register' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('register')}
            >
              Registrati
            </Button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  {...loginForm.register('email')}
                  placeholder="tu@esempio.com"
                />
                {loginForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-destructive">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  {...loginForm.register('password')}
                  placeholder="••••••"
                />
                {loginForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-destructive">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                loading={loginMutation.isPending}
                disabled={loginMutation.isPending}
              >
                Accedi
              </Button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="mb-1 block text-sm font-medium">
                  Nome (opzionale)
                </label>
                <Input
                  id="reg-name"
                  {...registerForm.register('name')}
                  placeholder="Mario Rossi"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="mb-1 block text-sm font-medium">
                  Email
                </label>
                <Input
                  id="reg-email"
                  type="email"
                  {...registerForm.register('email')}
                  placeholder="tu@esempio.com"
                />
                {registerForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-destructive">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="reg-password" className="mb-1 block text-sm font-medium">
                  Password
                </label>
                <Input
                  id="reg-password"
                  type="password"
                  {...registerForm.register('password')}
                  placeholder="••••••"
                />
                {registerForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-destructive">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="admin-secret" className="mb-1 block text-sm font-medium">
                  Admin Secret (opzionale)
                </label>
                <Input
                  id="admin-secret"
                  type="password"
                  {...registerForm.register('admin_secret')}
                  placeholder="Secret per account admin"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                loading={registerMutation.isPending}
                disabled={registerMutation.isPending}
              >
                Crea Account
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

