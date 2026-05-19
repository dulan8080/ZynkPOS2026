import { useState } from 'react'
import { ShoppingBag, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
import { apiLogin, apiGetSettings } from '../api'
import { useAuth } from '../store'

const LIVE_API_HOST = 'my.lassanapata.com'

export function LoginScreen() {
  const { login, apiBase, setApiBase, companyName, setCompanyName, setCurrentSection } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(!apiBase)
  const [apiUrl, setApiUrl] = useState(apiBase)
  const [companyPhone, setCompanyPhone] = useState('')
  const isLiveServer = apiBase.toLowerCase().includes(LIVE_API_HOST)

  function normalizeApiUrl(input: string): string {
    const trimmed = input.trim().replace(/\/+$/, '')
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!apiBase) { setError('Please configure the server URL first.'); setShowSettings(true); return }
    if (!email.trim() || !password) { setError('Enter your email/username and password'); return }
    setError('')
    setLoading(true)
    try {
      const { token, user, sections } = await apiLogin(email.trim(), password)
      login(user, token)
      // Pick the section based on user's pos_section_id, then default, then first
      if (sections && sections.length > 0) {
        const targetSec = user.pos_section_id
          ? (sections.find((s: any) => s.id === user.pos_section_id) || sections.find((s: any) => s.is_default === 1) || sections[0])
          : (sections.find((s: any) => s.is_default === 1) || sections[0])
        const sec = { id: targetSec.id, name: targetSec.name, code: targetSec.short_code || targetSec.prefix, color: targetSec.color }
        setCurrentSection(sec)
        setCompanyName(targetSec.name)
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveApiUrl() {
    const normalized = normalizeApiUrl(apiUrl)
    if (!normalized) return
    setCompanyName('ZYNKPOS')
    setCompanyPhone('')
    setApiBase(normalized)
    setApiUrl(normalized)
    setShowSettings(false)
    // Fetch company info immediately after saving the server URL
    try {
      const s = await apiGetSettings()
      if (s.company_name) setCompanyName(s.company_name)
      if (s.company_phone) setCompanyPhone(s.company_phone)
    } catch {
      // Server unreachable — keep default branding
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-hidden">
      <div className="absolute top-[-22%] left-[-8%] w-[520px] h-[520px] rounded-full bg-accent/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-24%] right-[-8%] w-[620px] h-[620px] rounded-full bg-sky-500/10 blur-[140px] pointer-events-none" />

      <div className="relative min-h-screen w-full max-w-[1320px] mx-auto px-4 py-4 sm:px-8 sm:py-8 flex items-center">
        <div className="w-full grid lg:grid-cols-2 bg-bg-card/60 border border-border rounded-[28px] overflow-hidden shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="p-6 sm:p-10 lg:p-14">
            <div className="max-w-md">
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/25 mb-4 shadow-[0_0_30px_rgba(91,141,247,0.2)]">
                  <ShoppingBag className="w-8 h-8 text-accent" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-text-1 tracking-tight">{companyName}</h1>
                <p className="mt-2 text-text-2 text-sm sm:text-base">Secure sign-in for your counter workstation</p>
                {isLiveServer && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-300">
                    LIVE SERVER: transactions affect production data
                  </div>
                )}
              </div>

              <div className="bg-bg-elevated/80 border border-border rounded-2xl p-5 sm:p-7">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
                      Email or Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 transition-all"
                        placeholder="Enter your email or username"
                        autoFocus
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-bg-card border border-border rounded-xl pl-10 pr-12 py-3 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 transition-all"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2 transition-colors"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(91,141,247,0.4)]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>
              </div>

              <div className="mt-6 text-left">
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className="text-xs text-text-3 hover:text-text-2 transition-colors"
                >
                  {apiBase ? `Server: ${apiBase}` : 'No server configured — click to set'}
                </button>
              </div>

              {showSettings && (
                <div className="mt-3 bg-bg-card border border-border rounded-xl p-4 animate-slide-down">
                  <p className="text-xs text-text-2 mb-2">API Server URL</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveApiUrl() }}
                      className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-1 text-sm focus:outline-none focus:border-accent/60"
                      placeholder="https://your-server.com"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveApiUrl}
                      disabled={!apiUrl.trim()}
                      className="px-3 py-2 bg-accent/15 text-accent text-sm rounded-lg hover:bg-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-xs text-text-3 mt-2">
                    This must point to your POS server.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex relative items-center justify-center p-10 border-l border-border/80 bg-[linear-gradient(145deg,rgba(17,17,32,0.92),rgba(14,34,58,0.95))]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(91,141,247,0.18),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(56,189,248,0.16),transparent_42%)] pointer-events-none" />
            <div className="relative w-full max-w-[560px]">
              <img
                src="/login-side-art.svg"
                alt="Retail dashboard illustration"
                className="w-full h-auto rounded-2xl border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
              />
              <div className="mt-6 px-2">
                <p className="text-xs uppercase tracking-[0.22em] text-sky-300/80 font-semibold">POS Terminal</p>
                <h2 className="mt-2 text-2xl font-bold text-white leading-tight">Fast billing, clear day sessions, stable counter workflow</h2>
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-white/60">© Zynknet Technology Solutions</p>
                  <p className="text-sm text-white/60">+94 774066636</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
