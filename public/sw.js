self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json()
      
      const options = {
        body: data.body || 'New notification from FleetGuard',
        icon: '/images/icons/icon-192x192.png',
        badge: '/images/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/dashboard'
        }
      }
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'FleetGuard', options)
      )
    } catch (e) {
      console.error('Error parsing push data', e)
      // Fallback for plain text push
      event.waitUntil(
        self.registration.showNotification('FleetGuard', {
          body: event.data.text(),
          data: { url: '/dashboard' }
        })
      )
    }
  }
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  
  const urlToOpen = event.notification.data.url || '/dashboard'
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(windowClients) {
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen) {
          matchingClient = windowClient;
          break;
        }
      }

      if (matchingClient) {
        return matchingClient.focus()
      } else {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
