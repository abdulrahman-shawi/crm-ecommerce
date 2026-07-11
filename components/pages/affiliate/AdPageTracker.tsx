'use client';

import * as React from 'react';

type AdPageTrackerProps = {
  productId: number;
};

export default function AdPageTracker({ productId }: AdPageTrackerProps) {
  React.useEffect(() => {
    if (!productId) {
      return;
    }

    const pathname = window.location.pathname;
    const sessionKey = `ad-track:${productId}:${pathname}`;

    try {
      if (window.sessionStorage.getItem(sessionKey) === '1') {
        return;
      }

      window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      return;
    }

    void fetch('/api/ad/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        path: pathname,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [productId]);

  return null;
}