'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

// Helper to convert VAPID public key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkSubscription() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsLoading(false)
        return
      }
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
      } catch (e) {
        console.error('Error checking subscription', e)
      } finally {
        setIsLoading(false)
      }
    }
    checkSubscription()
  }, [])

  async function handleToggle() {
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready

      if (isSubscribed) {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          })
        }
        setIsSubscribed(false)
      } else {
        // Subscribe
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
          throw new Error('VAPID public key is not set')
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        })
        setIsSubscribed(true)
      }
    } catch (error) {
      console.error('Push toggle error:', error)
      alert('Failed to toggle push notifications. Ensure permissions are granted.')
    } finally {
      setIsLoading(false)
    }
  }

  // Only render if push is supported
  if (typeof window !== 'undefined' && !('serviceWorker' in navigator && 'PushManager' in window)) {
    return null
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      title={isSubscribed ? "Disable Push Notifications" : "Enable Push Notifications"}
      className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
        isSubscribed 
          ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700' 
          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:shadow'
      }`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="w-4 h-4" />
      ) : (
        <BellOff className="w-4 h-4" />
      )}
    </button>
  )
}
