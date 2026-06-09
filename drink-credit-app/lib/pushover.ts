type PushoverPayload = {
  title: string;
  message: string;
  priority?: number;
  url?: string;
  url_title?: string;
};

export async function sendPushoverNotification({
  title,
  message,
  priority = 0,
  url,
  url_title,
}: PushoverPayload) {
  const token = process.env.PUSHOVER_APP_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;

  if (!token || !user) {
    console.warn('Pushover non configurato: mancano PUSHOVER_APP_TOKEN o PUSHOVER_USER_KEY');
    return;
  }

  try {
    const body = new URLSearchParams();

    body.set('token', token);
    body.set('user', user);
    body.set('title', title);
    body.set('message', message);
    body.set('priority', String(priority));

    if (url) {
      body.set('url', url);
    }

    if (url_title) {
      body.set('url_title', url_title);
    }

    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Errore Pushover:', text);
    }
  } catch (error) {
    console.error('Errore invio notifica Pushover:', error);
  }
}