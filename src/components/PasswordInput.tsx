"use client"

import { useState, InputHTMLAttributes, forwardRef } from "react"

export type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label?: string
  showToggleLabel?: boolean
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, id, showToggleLabel = false, ...props }, ref) => {
    const [show, setShow] = useState(false)

    const base = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
    const inputClass = className ? `${base} ${className}` : base

    return (
      <div className="relative">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          type={show ? "text" : "password"}
          className={inputClass}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          {/* Eye icon */}
          {show ? (
            // Eye off
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.53-1.2 1.25-2.31 2.12-3.28" />
              <path d="M22.94 11.94c-.5 1.17-1.2 2.26-2.06 3.2" />
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M1 1l22 22" />
            </svg>
          ) : (
            // Eye
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
          {showToggleLabel && (
            <span className="ml-1 text-xs">{show ? "Hide" : "Show"}</span>
          )}
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export default PasswordInput

