import { useState, type FormEvent } from 'react'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { AUTH_CREDENTIALS, STORAGE_KEYS } from '../lib/constants'

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password) {
      localStorage.setItem(STORAGE_KEYS.loggedIn, 'true')
      setError('')
      onLogin()
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة')
    }
  }

  return (
    <div className="min-h-screen bg-oxygen-black-deep text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <img src="/icon-noBG.png" alt="Oxygen Gym" className="h-28 w-28 object-contain" />
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-oxygen-silver-light">Oxygen Gym</h1>
          <p className="mt-1 text-oxygen-silver font-medium">تسجيل الدخول إلى النظام</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-oxygen-silver-light">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="h-12 rounded-xl bg-oxygen-black px-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
              placeholder="أدخل اسم المستخدم"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-oxygen-silver-light">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-12 w-full rounded-xl bg-oxygen-black px-4 pl-12 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
                placeholder="أدخل كلمة المرور"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 left-3 flex items-center text-oxygen-silver transition-colors hover:text-oxygen-silver-light"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-oxygen-red/15 px-3 py-2 text-sm font-medium text-oxygen-red-light">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark"
          >
            <LogIn className="h-5 w-5" />
            دخول
          </button>
        </form>
      </div>
    </div>
  )
}
