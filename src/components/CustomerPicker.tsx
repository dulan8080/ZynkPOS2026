import { useState, useMemo, useEffect, useRef } from 'react'
import { X, Search, UserCheck, Users, Phone, Mail, UserPlus, Loader2, Building2, User, Briefcase, MapPin, FileText, AlertCircle } from 'lucide-react'
import { usePOS } from '../store'
import type { Customer } from '../types'
import { apiCreateCustomer, apiCheckCustomerPhone } from '../api'

type Category = 'Individual' | 'Professional' | 'Government'

interface CreateForm {
  phone: string
  phone2: string
  category: Category
  firstName: string
  lastName: string
  governmentSector: string
  company: string
  email: string
  address: string
  city: string
  notes: string
}

const EMPTY_FORM: CreateForm = {
  phone: '', phone2: '', category: 'Individual',
  firstName: '', lastName: '', governmentSector: '',
  company: '', email: '', address: '', city: '', notes: '',
}

export function CustomerPicker({ initialMode = 'search' }: { initialMode?: 'search' | 'create' }) {
  const { customers, selectedCustomer, setCustomer, setShowCustomerPicker, setCustomers } = usePOS()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'search' | 'create'>(initialMode)

  // New customer form state
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [phoneChecking, setPhoneChecking] = useState(false)
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const phoneCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = (k: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Phone handler — digits only, max 10, trigger duplicate check at 10
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm(f => ({ ...f, phone: digits }))
    setExistingCustomer(null)
    setCreateError(null)
    if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current)
    if (digits.length === 10) {
      phoneCheckTimer.current = setTimeout(async () => {
        setPhoneChecking(true)
        try {
          const result = await apiCheckCustomerPhone(digits)
          if (result.exists) setExistingCustomer(result.customer)
        } catch {}
        finally { setPhoneChecking(false) }
      }, 400)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return customers.slice(0, 20)
    const q = search.toLowerCase()
    return customers.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q),
    ).slice(0, 20)
  }, [customers, search])

  function select(customer: Customer) {
    setCustomer(customer)
    setShowCustomerPicker(false)
  }

  function clear() {
    setCustomer(null)
    setShowCustomerPicker(false)
  }

  function openCreate() {
    setMode('create')
    setForm(EMPTY_FORM)
    setCreateError(null)
    setExistingCustomer(null)
    setTimeout(() => phoneRef.current?.focus(), 60)
  }

  function validate(): string | null {
    if (!form.phone.trim()) return 'Primary phone is required'
    if (form.phone.length !== 10) return 'Phone number must be exactly 10 digits'
    if (existingCustomer) return 'A customer with this phone already exists — use them or change the phone number'
    if (form.category === 'Individual' || form.category === 'Professional') {
      if (!form.firstName.trim()) return 'First name is required'
      if (!form.lastName.trim()) return 'Last name is required'
    }
    if (form.category === 'Government' && !form.governmentSector.trim()) {
      return 'Government sector is required'
    }
    return null
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setCreateError(err); return }
    setCreating(true)
    setCreateError(null)
    try {
      const created = await apiCreateCustomer({
        phone: form.phone.trim(),
        phone2: form.phone2.trim() || undefined,
        category: form.category,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        governmentSector: form.governmentSector.trim() || undefined,
        company: form.company.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      setCustomers([created, ...customers])
      setCustomer(created)
      setShowCustomerPicker(false)
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create customer')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (mode === 'create') { setMode('search'); return }
        setShowCustomerPicker(false)
      }
      if (e.key === 'F7') {
        e.preventDefault()
        e.stopPropagation()
        openCreate()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [mode])

  const inputCls = 'w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/60'
  const labelCls = 'block text-text-3 text-xs mb-1'
  const reqStar = <span className="text-red-400"> *</span>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-elevated border border-border rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-xl mx-4 animate-scale-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center">
              {mode === 'create' ? <UserPlus className="w-4 h-4 text-accent" /> : <Users className="w-4 h-4 text-accent" />}
            </div>
            <h2 className="text-text-1 font-bold text-base">
              {mode === 'create' ? 'New Customer' : 'Select Customer'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'search' && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-all"
                title="New Customer (F7)"
              >
                <UserPlus className="w-3.5 h-3.5" />
                New <span className="opacity-60 text-[10px]">F7</span>
              </button>
            )}
            <button
              onClick={() => mode === 'create' ? setMode('search') : setShowCustomerPicker(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {mode === 'create' ? (
          /* ── New Customer Form ── */
          <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Contact */}
            <div>
              <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-2">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Primary Phone{reqStar} <span className="text-text-3 font-normal">(10 digits)</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
                    <input
                      ref={phoneRef}
                      type="tel"
                      inputMode="numeric"
                      value={form.phone}
                      onChange={handlePhoneChange}
                      maxLength={10}
                      placeholder="0XXXXXXXXX"
                      className={`${inputCls} pl-9 pr-8 ${form.phone.length > 0 && form.phone.length < 10 ? 'border-amber-500/70' : form.phone.length === 10 && !existingCustomer ? 'border-green-500/60' : ''}`}
                    />
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ${form.phone.length === 10 ? 'text-green-400' : 'text-text-3'}`}>
                      {form.phone.length}/10
                    </span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Secondary Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
                    <input type="tel" value={form.phone2} onChange={set('phone2')}
                      placeholder="Optional"
                      className={`${inputCls} pl-9`} />
                  </div>
                </div>
              </div>

              {/* Phone checking indicator */}
              {phoneChecking && (
                <div className="flex items-center gap-2 mt-2 text-text-3 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking for existing customer…
                </div>
              )}

              {/* Existing customer banner */}
              {existingCustomer && (
                <div className="mt-2 border border-amber-500/40 bg-amber-500/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-amber-300 text-xs font-semibold">Customer already exists with this phone number</p>
                  </div>
                  <div className="bg-bg-card rounded-lg px-3 py-2 text-sm">
                    <p className="text-text-1 font-semibold">{existingCustomer.name}</p>
                    {existingCustomer.phone && <p className="text-text-3 text-xs">{existingCustomer.phone}</p>}
                    {existingCustomer.company && <p className="text-text-3 text-xs">{existingCustomer.company}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { select(existingCustomer) }}
                      className="flex-1 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all"
                    >
                      Use This Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExistingCustomer(null)
                        setForm(f => ({ ...f, phone: '' }))
                        setTimeout(() => phoneRef.current?.focus(), 30)
                      }}
                      className="flex-1 py-2 rounded-lg border border-border text-text-2 text-xs font-semibold hover:bg-bg-hover transition-all"
                    >
                      Create New (different phone)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-2">Category{reqStar}</p>
              <div className="grid grid-cols-3 gap-2">
                {(['Individual', 'Professional', 'Government'] as Category[]).map(cat => (
                  <button key={cat} type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border transition-all
                      ${form.category === cat
                        ? 'bg-accent text-white border-accent'
                        : 'bg-bg-card text-text-2 border-border hover:border-accent/40'}`}>
                    {cat === 'Individual' && <User className="w-3.5 h-3.5" />}
                    {cat === 'Professional' && <Briefcase className="w-3.5 h-3.5" />}
                    {cat === 'Government' && <Building2 className="w-3.5 h-3.5" />}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Personal Info */}
            <div>
              <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-2">
                {form.category === 'Government' ? 'Contact Person' : 'Personal Information'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name{reqStar}</label>
                  <input value={form.firstName} onChange={set('firstName')}
                    className={inputCls} placeholder="e.g. Kamal" />
                </div>
                <div>
                  <label className={labelCls}>Last Name{reqStar}</label>
                  <input value={form.lastName} onChange={set('lastName')}
                    className={inputCls} placeholder="e.g. Perera" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
                    <input type="email" value={form.email} onChange={set('email')}
                      placeholder="Optional" className={`${inputCls} pl-9`} />
                  </div>
                </div>

                {form.category === 'Professional' && (
                  <div className="col-span-2">
                    <label className={labelCls}>Company Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
                      <input value={form.company} onChange={set('company')}
                        placeholder="e.g. ABC Pvt Ltd" className={`${inputCls} pl-9`} />
                    </div>
                  </div>
                )}

                {form.category === 'Government' && (
                  <div className="col-span-2">
                    <label className={labelCls}>Government Sector{reqStar}</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
                      <input value={form.governmentSector} onChange={set('governmentSector')}
                        placeholder="e.g. Ministry of Health" className={`${inputCls} pl-9`} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-2">Address</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Street Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
                    <input value={form.address} onChange={set('address')}
                      placeholder="Optional" className={`${inputCls} pl-9`} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input value={form.city} onChange={set('city')}
                    placeholder="Optional" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-3.5 h-3.5 text-text-3" />
                <textarea value={form.notes} onChange={set('notes')} rows={2}
                  placeholder="Optional"
                  className={`${inputCls} pl-9 resize-none`} />
              </div>
            </div>

            {createError && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{createError}</p>
            )}

            <div className="flex gap-2 pt-1 sticky bottom-0 bg-bg-elevated pb-1">
              <button
                type="button"
                onClick={() => setMode('search')}
                className="flex-1 py-2.5 rounded-xl border border-border text-text-2 text-sm font-semibold hover:bg-bg-hover transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {creating ? 'Saving…' : 'Create & Select'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Search */}
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, phone, email…"
                  autoFocus
                  className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>

            {/* Walk-in option */}
            <div className="px-4 py-2 flex-shrink-0 border-b border-border">
              <button
                onClick={clear}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bg-hover transition-all text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-text-3/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-text-3" />
                </div>
                <div>
                  <p className="text-text-1 text-sm font-semibold">Walk-in Customer</p>
                  <p className="text-text-3 text-xs">No customer attached — prints as "CASH CUSTOMER"</p>
                </div>
              </button>
            </div>

            {/* Customer list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-text-2 text-sm">No customers found</p>
                  <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    Create "{search}"
                  </button>
                </div>
              ) : (
                filtered.map((customer) => {
                  const isSelected = selectedCustomer?.id === customer.id
                  return (
                    <button
                      key={customer.id}
                      onClick={() => select(customer)}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left
                        ${isSelected
                          ? 'bg-accent/10 border border-accent/25'
                          : 'hover:bg-bg-hover border border-transparent'
                        }
                      `}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                          isSelected ? 'bg-accent/20 text-accent' : 'bg-bg-card text-text-2'
                        }`}
                      >
                        {(customer.name || customer.company || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-text-1 text-sm font-semibold truncate">{customer.name || customer.company || `Customer #${customer.id}`}</p>
                          {isSelected && <UserCheck className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {customer.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-text-3">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1 text-[11px] text-text-3">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </span>
                          )}
                        </div>
                        {customer.company && (
                          <p className="text-[11px] text-text-3 truncate">{customer.company}</p>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
